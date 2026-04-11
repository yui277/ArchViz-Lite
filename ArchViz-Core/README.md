# ArchViz-Core

**轻量级 3D 建筑可视化引擎 -- 技术解析版本**

`v1.2.4 (260410)`

---

> **重要声明**
>
> 本项目为技术解析版本，展示 WebGL 建筑可视化工具的架构设计与工程实践。源代码经过抽象化处理，不可直接用于生产环境。

---

## 项目简介

ArchViz Lite（小蜡烛）是一个基于 Three.js 的轻量级建筑可视化工具。本仓库（ArchViz-Core）提取了生产项目的核心架构与模块接口，以开源形式分享其工程设计模式。

主要能力包括：

- 多格式 3D 模型加载（.3dm / .glb / .gltf / .obj），原生支持 Rhino 文件
- 10+ 种风格化视觉预设（素模、蓝图、手绘、X光、像素风等）
- AI 动画生成（自然语言 -> 相机脚本 -> 动画播放）
- AI 智能出图（多渠道图生图渲染）
- 实时剖切分析（Stencil Buffer 三步渲染）
- 后期处理管线（Bloom / 像素化 / 边缘检测 / 半调网点）
- 跨设备交互适配（桌面 / 平板 / 手机）

## 技术栈

| 类别 | 技术 |
|------|------|
| 渲染引擎 | Three.js (r160+) / WebGL 2.0 |
| 模块系统 | ES Modules (原生浏览器 import) |
| AI 集成 | DeepSeek (动画) / 通义万相 / Flux / 火山引擎 (出图) |
| 后端 | PHP (未包含在本仓库中) |
| 许可证 | CC BY-NC-SA 4.0 |

## 项目结构

```
ArchViz-Core/
├── src/
│   ├── config.js                    # 分区式配置中心（APP/DEFAULTS/API/AI/EXPORT）
│   ├── InteractionManager.js        # 交互管理器：设备检测、工具模式状态机、快捷键系统
│   ├── core/
│   │   └── ArchVizEngine.js         # 渲染引擎核心：场景、双相机、控制器、渲染循环
│   ├── modules/
│   │   ├── AIAnimation.js           # AI 动画模块：双阶段架构（Planner + Executor）
│   │   ├── ModelLoader.js           # 模型加载器：多格式加载、坐标系检测、灯光系统
│   │   ├── SmartExport.js           # 智能导出：抽象工厂模式、三渠道 AI 出图
│   │   ├── PostProcessing.js        # 后期处理：EffectComposer 管线管理
│   │   └── SectionCut.js            # 剖切分析：Stencil Buffer 截面渲染
│   └── shaders/
│       └── CustomShaders.js         # 自定义 GLSL 着色器（高度热力图/深度图/像素化）
├── docs/                            # 技术文档目录
│   ├── ARCHITECTURE.md              # 整体架构设计文档
│   ├── AI-INTEGRATION.md            # AI 集成与提示工程指南
│   ├── RENDERING-PIPELINE.md        # 渲染管线技术文档
│   ├── MODEL-LOADING.md             # 模型加载策略文档
│   └── API-DESIGN-PATTERNS.md       # 后端 API 设计模式文档
├── LICENSE                          # CC BY-NC-SA 4.0 许可证
├── README.md                        # 本文件
└── CHANGELOG.md                     # 变更日志
```

## 核心模块说明

### ArchVizEngine -- 渲染引擎核心

`src/core/ArchVizEngine.js`

管理 Three.js 场景的完整生命周期：场景图、双相机系统（正交 + 透视）、WebGL 渲染器、轨道/变换控制器、后期处理管道、辅助覆盖层和渲染循环。支持正交、透视、两点透视三种相机模式的无缝切换。

### ModelLoader -- 多格式模型加载

`src/modules/ModelLoader.js`

统一的 3D 资产加载管线，自动检测文件格式并分发到对应的 Three.js 加载器。内置坐标系检测（Z-up / Y-up）、单位转换（mm -> m）、几何优化、性能预警。同时包含 LightingSystem 类，提供可配置的太阳光 + 填充光照明系统。

### InteractionManager -- 交互与设备适配

`src/InteractionManager.js`

基于策略模式的交互管理器，定义了五种工具模式（浏览 / 测量 / 移动 / 隐藏 / 剖切）。集成了跨设备输入归一化（指针/触摸统一）、CSS Media Query 级设备能力检测、WebGL 图形能力探测、快捷键注册系统和视口快照机制。

### AIAnimation -- AI 动画生成

`src/modules/AIAnimation.js`

双阶段 AI 动画管线。Stage 1（Planner）将用户的自然语言描述通过 LLM 转化为导演级镜头计划；Stage 2（Executor）将镜头计划翻译为帧级动画时间线，驱动相机运动、风格切换、剖切动画等 10 种原子操作。

### SmartExport -- 智能 AI 出图

`src/modules/SmartExport.js`

基于抽象工厂模式的多渠道 AI 渲染导出系统。定义了统一的 AIRenderChannel 接口，实现了三个具体渠道（通义万相 / Flux / 火山引擎即梦）。支持视口截图、AI 图生图渲染、批量导出等工作流。

### PostProcessing -- 后期处理管线

`src/modules/PostProcessing.js`

基于 Three.js EffectComposer 的后期处理管线管理器。支持 Bloom 辉光、像素化、Sobel 边缘检测（手绘风格）、半调网点四种互斥的视觉效果 Pass，以及始终启用的 RenderPass 基础渲染。

### SectionCut -- 剖切分析系统

`src/modules/SectionCut.js`

基于 GPU Stencil Buffer 的实时建筑截面分析模块。采用三步渲染技术（背面模板写入 -> 正面模板擦除 -> 截面填充），支持 X/Y/Z 三轴剖切、偏移量动态调节、拓扑分析（水密性检测）。

### CustomShaders -- 自定义着色器

`src/shaders/CustomShaders.js`

三组自定义 GLSL 着色器，包含完整的图形学原理注释：高度热力图（HeightMapShader，分段线性插值伪彩色映射）、深度可视化（DepthMapShader，线性深度灰度/伪彩色）、像素化滤镜（PixelShader，UV 量化全屏后处理）。

## 技术文档索引

| 文档 | 说明 |
|------|------|
| `docs/ARCHITECTURE.md` | 整体架构设计：模块关系、数据流、生命周期管理 |
| `docs/AI-INTEGRATION.md` | AI 集成：动画管线、智能出图、Prompt 工程策略 |
| `docs/RENDERING-PIPELINE.md` | 渲染管线：WebGL 配置、阴影系统、Stencil 管线、后期处理链路 |
| `docs/MODEL-LOADING.md` | 模型加载：多格式适配、坐标系转换、几何优化、性能门控 |
| `docs/API-DESIGN-PATTERNS.md` | API 设计模式：抽象工厂、异步渠道接口、轮询策略 |

## 源码导读

建议阅读顺序：

1. `docs/ARCHITECTURE.md` → 整体架构和模块关系
2. `src/config.js` → 分区式配置架构
3. `src/core/ArchVizEngine.js` → 场景初始化、双相机、渲染循环
4. `src/InteractionManager.js` → 策略模式工具切换
5. `src/modules/ModelLoader.js` → 多格式加载管线、灯光系统
6. `src/modules/SectionCut.js` → Stencil Buffer 三步渲染
7. `src/modules/PostProcessing.js` → EffectComposer 管线组装
8. `src/shaders/CustomShaders.js` → GLSL 着色器实现
9. `src/modules/AIAnimation.js` + `SmartExport.js` → LLM 动画管线、抽象工厂导出
10. `docs/API-DESIGN-PATTERNS.md` → 异步渠道接口、轮询策略

## 许可证

本项目采用 **CC BY-NC-SA 4.0**（署名-非商业性使用-相同方式共享 4.0 国际）许可证。

- 允许：学习研究、教学用途、在相同协议下修改和分发
- 禁止：任何形式的商业用途（未经书面授权）

详见 [LICENSE](./LICENSE) 文件。

## 声明

本项目版权归原作者 Lichengfu2003 所有。

如需商业授权、企业私有化部署或数字孪生定制服务，请联系作者：lichengfu2003@outlook.com
