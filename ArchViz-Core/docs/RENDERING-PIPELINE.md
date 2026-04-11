# 渲染管线技术文档

> 架构概览参见 [整体架构文档](./ARCHITECTURE.md)。

## 1. WebGL 渲染器配置

### 1.1 渲染流程概览

```
场景图(Scene Graph)                 相机(Camera)
    │                                   │
    ├── 灯光                            │
    ├── 模型网格                         │
    ├── 辅助几何体                       │
    └── 后期处理组合器                    │
         │                              │
         ▼                              ▼
    ┌─────────────────────────────────────┐
    │        WebGL 渲染器                  │
    │  (WebGLRenderer)                    │
    │                                     │
    │  顶点着色器 → 光栅化 → 片段着色器    │
    │        → 深度测试 → 模板测试         │
    │            → 混合 → 帧缓冲          │
    └─────────────────┬───────────────────┘
                      │
                      ▼
                ┌───────────┐
                │   屏幕     │
                └───────────┘
```

### 1.2 渲染器初始化配置

渲染器初始化的关键配置：

| 选项 | 值 | 设计理由 |
|------|-----|---------|
| `antialias` | `true` | 建筑模型的直线边缘对锯齿极其敏感，MSAA 是性价比最高的方案 |
| `alpha` | `true` | 支持透明背景导出，便于后期合成 |
| `preserveDrawingBuffer` | `true` | 必须保留帧缓冲内容才能执行 `toDataURL()` 截图 |
| `logarithmicDepthBuffer` | `true` | 建筑模型尺度跨度大（室内家具 vs 城市天际线），对数深度缓冲有效减少 Z-fighting |
| `stencil` | `true` | 剖切盖面渲染依赖 Stencil Buffer |

**对数深度缓冲的取舍**：建筑场景 near/far 比值大（near=0.1, far=100000），线性深度缓冲会导致远处严重 Z-fighting。对数深度缓冲将精度均匀分布，代价是微小性能开销和某些后处理效果的兼容性问题。

阴影贴图类型选择 `VSMShadowMap`，产生天然软阴影边缘，比 PCF 更平滑，通过 `shadow.radius` 控制模糊程度。

## 2. 双相机系统

### 2.1 相机切换的状态同步

切换相机时的核心问题是视点连续性：

```javascript
// 伪代码：相机切换策略
function switchCamera(targetMode) {
    // 1. 从旧相机复制位置和朝向
    newCamera.position.copy(oldCamera.position)
    newCamera.quaternion.copy(oldCamera.quaternion)

    // 2. 特殊处理：两点透视锁定极角
    if (targetMode === '2pt') {
        controls.minPolarAngle = PI / 2  // 锁定水平
        controls.maxPolarAngle = PI / 2
        newCamera.position.y = controls.target.y  // 对齐目标高度
    }

    // 3. 更新所有引用（控制器、后处理、变换控件）
    controls.object = newCamera
    transformControl.camera = newCamera
    renderPass.camera = newCamera

    // 4. 重新计算投影矩阵
    onResize()
}
```

### 2.2 两点透视的极角锁定

锁定 OrbitControls 极角为 π/2，强制相机 Y 坐标对齐目标点，确保视线水平、垂直线不汇聚。

### 2.3 正交相机的视锥体管理

根据模型包围盒尺寸和缩放值动态计算视锥体：

```
frustumHalfSize = modelSize / viewZoom
left   = -frustumHalfSize × aspect / 2
right  =  frustumHalfSize × aspect / 2
top    =  frustumHalfSize / 2
bottom = -frustumHalfSize / 2
```

这确保了无论模型大小如何，"居中适配"后模型总是合理地填充视口。

## 3. 光照模型

### 3.1 太阳光 + 四方向填充光

```
              ☀️ Sun Light
              │  (方向可调、投射阴影)
              │
              ▼
    ┌─────────────────────┐
    │                     │
←── Fill ──   模型   ── Fill ──→
    │                     │
    └─────────────────────┘
              │
              ▼
         ── Fill ──
              │
         Top Light ↓
         (从正上方柔和补光)
```

- **太阳光**（DirectionalLight）：唯一投射阴影的光源，方位角 0-360° 可调，模拟一天中太阳位置的变化
- **顶部补光**：消除模型顶面的过暗区域
- **四方向填充光**：±X、±Z 四个方向各一盏，强度较低，确保模型各面都有基础照明

### 3.2 阴影系统

**Shadow Map 分辨率选择**：提供 2048px 和 4096px 两档。4096px 在桌面端提供清晰的阴影边缘，2048px 适合移动端或性能受限场景。

**Shadow Bias 策略**：

```
shadowBias:       -0.0005  (深度偏移，通常为负值)
shadowNormalBias:  0.02    (沿法线方向偏移，处理曲面伪影)
shadowRadius:      4       (VSM 模糊半径，控制阴影柔和度)
```

### 3.3 阴影相机的自适应包围盒

阴影贴图精度取决于阴影相机视锥体覆盖范围。根据模型尺寸动态调整：

```
effectiveSize = max(modelSize, 10)  // 最小保障
frustum = effectiveSize × 0.8       // 紧贴模型
near    = distance × 0.1
far     = distance × 3.0
```

保证小模型有高精度阴影，大模型不超出覆盖范围。

## 4. 后期处理链

### 4.1 EffectComposer 管道模式

```
RenderPass ──▶ EffectPass ──▶ ... ──▶ 屏幕输出
(基础场景)     (视觉效果)

具体管线配置：
┌────────────┐    ┌────────────┐    ┌────────────┐
│ RenderPass │ ──▶│ Sobel Pass │ ──▶│   输出      │  Sketch 模式
│            │    │ (边缘检测) │    │            │
└────────────┘    └────────────┘    └────────────┘

┌────────────┐    ┌────────────┐    ┌────────────┐
│ RenderPass │ ──▶│ Bloom Pass │ ──▶│   输出      │  Bloom 模式
│            │    │ (辉光)     │    │            │
└────────────┘    └────────────┘    └────────────┘

┌────────────┐    ┌────────────┐    ┌────────────┐
│ RenderPass │ ──▶│ DotScreen  │ ──▶│   输出      │  Halftone 模式
│            │    │ (网点)     │    │            │
└────────────┘    └────────────┘    └────────────┘

┌────────────┐    ┌────────────┐    ┌────────────┐
│ RenderPass │ ──▶│ Pixel Pass │ ──▶│   输出      │  PixelArt 模式
│            │    │ (像素化)   │    │            │
└────────────┘    └────────────┘    └────────────┘
```

设计要点：同一时刻只激活一种视觉效果 Pass，它们之间是**互斥**关系。RenderPass 始终作为管线的第一步。

### 4.2 Bloom 的 HDR 阈值策略

`threshold` 设为 0.85，只有亮度超过 85% 的像素参与辉光，避免整体发白。配合 Tech 风格的黑色背景和荧光色边缘，可营造赛博朋克氛围。

### 4.3 像素化效果

自定义 PixelShader 通过在片段着色器中量化 UV 坐标实现：

```
原理：
  pixelatedUV = floor(uv / pixelSize) × pixelSize
  color = texture(scene, pixelatedUV)
```

相比实际降低渲染分辨率，这种方式可保持 UI 层清晰度。

### 4.4 边缘检测

Sketch 模式使用 Sobel 算子进行边缘检测：

```
Sobel 核心：
  Gx = [-1 0 +1]    Gy = [-1 -2 -1]
       [-2 0 +2]          [ 0  0  0]
       [-1 0 +1]          [+1 +2 +1]

  edge = sqrt(Gx² + Gy²)
```

作用于 RenderPass 输出纹理，将三维场景转换为线稿。

## 5. 剖切渲染

### 5.1 ClippingPlane 配置

```
Y 轴剖切示意（俯视图）：

  剖切前:         offset=0(中间):     offset=25%(偏上):
  ┌──────────┐    ┌─────┬────┐        ┌───────┬──┐
  │          │    │可见 │裁剪│        │ 可见  │裁│
  │  模型    │    │     │    │        │       │剪│
  │          │    │     │    │        │       │  │
  └──────────┘    └─────┴────┘        └───────┴──┘
```

### 5.2 Stencil Buffer 三步渲染法

普通 ClippingPlane 裁剪后模型内部为空洞，建筑剖面通常需要填充实体色。采用 Stencil Buffer 实现：

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: 渲染背面                                         │
│                                                         │
│  对模型的每个三角面，只渲染背面（BackSide）                 │
│  关闭颜色写入、关闭深度写入                               │
│  Stencil 操作：每个通过的片段，计数器 +1                   │
│                                                         │
│  结果：Stencil Buffer 中记录了"被模型包围的区域"的计数     │
├─────────────────────────────────────────────────────────┤
│ Step 2: 渲染前面                                         │
│                                                         │
│  对模型的每个三角面，只渲染前面（FrontSide）               │
│  关闭颜色写入、关闭深度写入                               │
│  Stencil 操作：每个通过的片段，计数器 -1                   │
│                                                         │
│  结果：只有被剖切穿过的区域，计数器不为零                  │
├─────────────────────────────────────────────────────────┤
│ Step 3: 渲染盖面                                         │
│                                                         │
│  在剖切平面位置放置一个大平面                             │
│  Stencil 测试：只在计数器 ≠ 0 的像素位置渲染              │
│  渲染为用户指定的盖面颜色                                 │
│                                                         │
│  结果：剖切处出现填充色，表示被切割的实体                  │
└─────────────────────────────────────────────────────────┘
```

渲染顺序通过 `renderOrder` 严格控制：
- Stencil 写入网格：`renderOrder = 1.0`
- 盖面平面：`renderOrder = 1.1`
- 模型几何体：`renderOrder = 2.0`
- 叠加层（边缘线等）：`renderOrder = 3.0`

### 5.3 拓扑分析与盖面生成

只有封闭流形网格才能保证 Stencil 计数正确。通过拓扑分析预判：

```
1. 焊接顶点（合并位置相近的顶点）
2. 统计每条边被共享的次数：
   - 恰好 2 次 → 流形边
   - 1 次 → 开放边（网格不封闭）
   - >2 次 → 非流形边
3. 如果所有边都是流形边 → 网格封闭，可生成盖面
```

透明材质的薄片物体（如玻璃窗）即使几何封闭也跳过盖面生成。

### 5.4 多平面剖切扩展方向

当前为单平面剖切，多平面扩展需考虑：

- **交集模式**（AND）：所有平面都裁剪后才显示——用于“切出一个角”
- **并集模式**（OR）：任一平面裁剪即隐藏——用于"切掉多个部分"
- Stencil Buffer 的值域有限（通常 8 位），多平面需要更复杂的 Stencil 策略

## 6. 自定义着色器

### 6.1 高度图着色器的色谱映射

HeightMapShader 将模型顶点的世界空间高度映射为冷暖色谱：

```
颜色映射：

  高度(归一化)   0.0    0.25    0.5    0.75    1.0
  颜色          蓝     →  青   →  绿   →  黄   →  红
                (低)                              (高)

算法：分段线性插值（Piecewise Linear Interpolation）
  t ∈ [0, 0.25) → mix(蓝, 青, t×4)
  t ∈ [0.25, 0.5) → mix(青, 绿, (t-0.25)×4)
  t ∈ [0.5, 0.75) → mix(绿, 黄, (t-0.5)×4)
  t ∈ [0.75, 1.0] → mix(黄, 红, (t-0.75)×4)
```

支持 Y 轴（Three.js 默认上方向）和 Z 轴（Rhino 等 CAD 软件的上方向）。

### 6.2 深度图着色器

将相机空间深度线性映射为灰度：

```
原理：
  depth = -modelViewPosition.z  // 相机空间 Z 轴
  normalizedDepth = (depth - near) / (far - near)
  color = vec3(normalizedDepth)  // 灰度输出
```

近处为黑，远处为白，用于空间进深分析。

### 6.3 Uniform 管理

```javascript
// 伪代码：Uniform 更新模式
shader.uniforms = {
    uMin:  { value: modelBounds.min.y },  // 每次模型加载后更新
    uMax:  { value: modelBounds.max.y },  // 每次模型加载后更新
    uAxis: { value: 0 }                   // 用户切换时更新
}
```

Uniform 更新不会触发着色器重新编译，因此非常高效。但 `onBeforeCompile` 修改着色器源码的方式（如世界网格着色器）会导致材质重新编译，应避免频繁触发。

---

## 技术要点

1. **对数深度缓冲**：建筑场景 near/far 比值超过 1:10000 时解决 Z-fighting 的最有效方案。

2. **Stencil Buffer 三步渲染**：背面计数 → 前面反计数 → 条件填充，实现实心剖切面的经典技术。

3. **后处理互斥设计**：同一时刻只激活一种视觉效果 Pass，简化管线管理。

4. **阴影相机自适应**：视锥体紧贴模型包围盒，在有限 Shadow Map 分辨率下获取最佳阴影质量。

5. **拓扑分析作为安全网**：应用 Stencil 渲染前验证几何体拓扑合法性，避免视觉伪影。
