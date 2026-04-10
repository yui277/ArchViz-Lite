/**
 * CustomShaders.js — 自定义分析着色器集（教育参考版本）
 * 
 * 本文件包含建筑可视化分析中常用的 GLSL 着色器定义，
 * 基于生产项目 ArchViz Lite 的内联着色器提炼而成。
 * 
 * 应用场景：
 *   - HeightMapShader（高度热力图）：用于建筑体量分析，
 *     将模型各点的世界空间高度映射为冷暖色谱，直观展示建筑高度分布。
 *     常用于城市设计中的建筑限高分析、日照分析辅助、场地竖向分析等。
 * 
 *   - DepthMapShader（深度可视化）：用于空间深度分析，
 *     将模型各点相对于相机的距离映射为灰度或伪彩色，
 *     可辅助理解空间进深关系、遮挡关系，也可作为后处理特效的输入（如景深 DoF）。
 * 
 *   - PixelShader（像素化滤镜）：后处理全屏滤镜，
 *     将画面降采样为像素艺术风格，用于复古/风格化建筑表现图。
 * 
 * GLSL 代码已完整保留，作为图形学学习材料。
 * 每个着色器步骤配有详细的图形学原理注释。
 * 
 * Copyright (c) 2025 Lichengfu2003
 * Educational Reference — Not for production use
 */

import * as THREE from 'three';

// ============================================================================
// 1. 高度热力图着色器 (Height Map Shader)
// ============================================================================

/**
 * HeightMapShader — 高度热力图分析着色器
 * 
 * 原理概述：
 *   将模型顶点在世界空间中的高度值（Y 轴或 Z 轴，取决于模型坐标系约定）
 *   归一化到 [0, 1] 区间后，通过分段线性插值映射到冷暖色谱：
 *     蓝(低) → 青 → 绿 → 黄 → 红(高)
 *   这是经典的「科学可视化伪彩色映射」(Scientific Visualization Pseudocolor Mapping)。
 * 
 * Uniforms:
 *   - uMin {float}: 高度范围下限（通常为模型包围盒 min.y）
 *   - uMax {float}: 高度范围上限（通常为模型包围盒 max.y）
 *   - uAxis {int}: 高度轴选择，0 = Y轴（默认），1 = Z轴（部分软件以Z为上方向）
 * 
 * 颜色映射算法：
 *   采用 5 段线性插值（Piecewise Linear Interpolation），
 *   将归一化高度 t ∈ [0,1] 分为 4 个等宽区间 [0,0.25), [0.25,0.5), [0.5,0.75), [0.75,1]，
 *   每段在两个关键色之间做 mix 线性混合。
 *   此方法计算简单、GPU 友好，适合实时渲染。
 *   高级方案可替换为纹理查找表 (Color Ramp Texture / LUT) 实现任意色谱。
 */
export const HeightMapShader = {

    uniforms: {
        /** @type {float} 高度范围最小值（世界空间单位） */
        uMin: { value: 0.0 },
        /** @type {float} 高度范围最大值（世界空间单位） */
        uMax: { value: 10.0 },
        /**
         * @type {int} 高度采样轴
         * 0 = 使用世界空间 Y 分量（Y-Up 坐标系，Three.js 默认）
         * 1 = 使用世界空间 Z 分量（Z-Up 坐标系，Rhino/Blender 默认导出）
         */
        uAxis: { value: 0 },
        /**
         * @type {THREE.Texture|null} 可选的颜色查找表纹理 (Color Ramp)
         * 当提供此纹理时，可替代硬编码的分段插值，实现自定义色谱。
         * 纹理应为 1D 横向渐变图，UV.x 对应归一化高度 t。
         */
        colorRamp: { value: null }
    },

    vertexShader: /* glsl */`
        // === Vertex Shader: 高度值传递 ===
        
        // varying 变量：从顶点着色器传递到片段着色器的插值数据
        // vHeight 将在光栅化阶段被 GPU 自动插值，
        // 确保每个片段获得其所在三角面上的正确高度值
        varying float vHeight;
        
        // uniform：由 CPU 端（JavaScript）设置的全局常量
        // uAxis 控制使用 Y 轴还是 Z 轴作为高度方向
        uniform int uAxis;

        void main() {
            // Step 1: 将顶点从模型局部空间变换到世界空间
            // modelMatrix 包含了模型的位移、旋转、缩放变换
            // position 是顶点在模型空间中的坐标（Three.js 内置 attribute）
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            
            // Step 2: 根据 uAxis 选择高度采样轴
            // Y-Up (uAxis=0): 建筑学中常用的坐标系约定，Y 指向天空
            // Z-Up (uAxis=1): CAD 软件（如 Rhino）常用的坐标系约定
            if (uAxis == 0) {
                vHeight = worldPos.y;
            } else {
                vHeight = worldPos.z;
            }
            
            // Step 3: 将世界空间坐标变换到裁剪空间
            // viewMatrix: 世界空间 → 相机空间（观察空间）
            // projectionMatrix: 相机空间 → 裁剪空间（NDC）
            // 注意：这里使用 viewMatrix 而非 modelViewMatrix，
            // 因为我们已经手动应用了 modelMatrix
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,

    fragmentShader: /* glsl */`
        // === Fragment Shader: 高度 → 颜色映射 ===
        
        uniform float uMin;    // 高度范围下限
        uniform float uMax;    // 高度范围上限
        varying float vHeight;  // 从顶点着色器插值得到的世界空间高度

        void main() {
            // Step 1: 将高度值归一化到 [0, 1] 区间
            // t = 0 表示最低处，t = 1 表示最高处
            // 当 uMin == uMax 时会产生除零，实际使用时需确保范围有效
            float t = (vHeight - uMin) / (uMax - uMin);
            
            // clamp 防止超出 [0,1] 范围（模型可能部分超出包围盒）
            t = clamp(t, 0.0, 1.0);
            
            // Step 2: 分段线性插值颜色映射
            // 经典科学可视化「喷射」色谱 (Jet Colormap):
            //   t=0.00 → 纯蓝 (0,0,1) — 最低温/最低处
            //   t=0.25 → 青色 (0,1,1)
            //   t=0.50 → 纯绿 (0,1,0) — 中间值
            //   t=0.75 → 黄色 (1,1,0)
            //   t=1.00 → 纯红 (1,0,0) — 最高温/最高处
            //
            // mix(a, b, f) = a * (1-f) + b * f，即线性插值
            // 每段将 t 重新映射到局部 [0,1]: 例如 t∈[0,0.25] → f = t*4
            vec3 color = vec3(0.0);
            
            if (t < 0.25) {
                // 蓝 → 青：低温区域
                color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), t * 4.0);
            } else if (t < 0.5) {
                // 青 → 绿：中低温区域
                color = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.25) * 4.0);
            } else if (t < 0.75) {
                // 绿 → 黄：中高温区域
                color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.5) * 4.0);
            } else {
                // 黄 → 红：高温区域
                color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.75) * 4.0);
            }
            
            // 输出最终颜色，alpha = 1.0（不透明）
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

// ============================================================================
// 2. 深度可视化着色器 (Depth Map Shader)
// ============================================================================

/**
 * DepthMapShader — 深度可视化分析着色器
 * 
 * 原理概述：
 *   将模型顶点在相机空间（View Space）中的 Z 值（即距相机的深度）
 *   归一化到 [0, 1] 后映射为灰度或伪彩色输出。
 * 
 * 关于线性深度 vs 对数深度：
 *   - 线性深度 (Linear Depth)：
 *     d = (-viewPos.z - near) / (far - near)
 *     深度值在 [near, far] 范围内均匀分布。
 *     优点：视觉直观，近处和远处的分辨率一致。
 *     本着色器使用此方案。
 * 
 *   - 对数深度 (Logarithmic Depth)：
 *     d = log(viewZ / near) / log(far / near)
 *     深度值在对数空间分布，近处精度更高。
 *     适用于场景跨度极大的情况（如城市级场景 near=0.1, far=100000）。
 *     Three.js 可通过 renderer.logarithmicDepthBuffer = true 启用。
 * 
 *   - 透视投影原生深度 (NDC Z / gl_FragCoord.z)：
 *     GPU 默认使用非线性深度缓冲（1/z 分布），近处精度高，远处精度低。
 *     不适合直接作为可视化输出。
 * 
 * Uniforms:
 *   - uNear {float}: 近裁剪面距离
 *   - uFar {float}: 远裁剪面距离
 *   - depthMode {int}: 深度可视化模式（0=灰度, 1=伪彩色）
 */
export const DepthMapShader = {

    uniforms: {
        /** @type {float} 近裁剪面距离（相机空间，正值） */
        nearPlane: { value: 0.1 },
        /** @type {float} 远裁剪面距离（相机空间，正值） */
        farPlane: { value: 1000.0 },
        /**
         * @type {int} 深度可视化模式
         * 0 = 灰度输出（近白远黑或近黑远白，取决于 d 的映射）
         * 1 = 伪彩色输出（复用类似 HeightMap 的色谱映射）
         */
        depthMode: { value: 0 }
    },

    vertexShader: /* glsl */`
        // === Vertex Shader: 相机空间深度计算 ===
        
        // varying：传递到片段着色器的深度值
        varying float vDepth;
        
        void main() {
            // Step 1: 将顶点变换到相机空间（View Space / Eye Space）
            // modelViewMatrix = viewMatrix * modelMatrix
            // 相机空间中，相机位于原点，看向 -Z 方向
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            // Step 2: 计算标准裁剪空间坐标
            gl_Position = projectionMatrix * mvPosition;
            
            // Step 3: 提取线性深度
            // 在相机空间中，物体在相机前方时 mvPosition.z 为负值
            // 取反得到正的深度值（距离相机越远，vDepth 越大）
            vDepth = -mvPosition.z;
        }
    `,

    fragmentShader: /* glsl */`
        // === Fragment Shader: 深度值可视化 ===
        
        uniform float nearPlane;  // 近裁剪面
        uniform float farPlane;   // 远裁剪面
        uniform int depthMode;    // 可视化模式：0=灰度, 1=伪彩色
        varying float vDepth;     // 从顶点着色器插值的线性深度

        void main() {
            // Step 1: 将线性深度归一化到 [0, 1]
            // d = 0 表示在近裁剪面处，d = 1 表示在远裁剪面处
            float d = (vDepth - nearPlane) / (farPlane - nearPlane);
            d = clamp(d, 0.0, 1.0);
            
            vec3 color;
            
            if (depthMode == 1) {
                // 伪彩色模式：复用科学可视化色谱
                // 近处（d→0）为冷色（蓝），远处（d→1）为暖色（红）
                if (d < 0.25) {
                    color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), d * 4.0);
                } else if (d < 0.5) {
                    color = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (d - 0.25) * 4.0);
                } else if (d < 0.75) {
                    color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (d - 0.5) * 4.0);
                } else {
                    color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (d - 0.75) * 4.0);
                }
            } else {
                // 灰度模式（默认）：
                // 近处亮（白），远处暗（黑），符合视觉直觉
                // 如需反转（近暗远亮），将 d 替换为 1.0 - d
                color = vec3(1.0 - d);
            }
            
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

// ============================================================================
// 3. 像素化艺术滤镜 (Pixel Art Post-Processing Shader)
// ============================================================================

/**
 * PixelShader — 像素化后处理滤镜
 * 
 * 这是一个全屏后处理 (Full-screen Post-processing) 着色器，
 * 通过降低采样精度实现复古像素艺术风格。
 * 
 * 原理：
 *   将 UV 坐标按 pixelSize 网格对齐（floor 量化），
 *   使得一个像素块内的所有片段采样同一个纹素，产生马赛克效果。
 * 
 * 配合 Three.js 的 EffectComposer / ShaderPass 使用。
 */
export const PixelShader = {
    uniforms: {
        /** @type {THREE.Texture} 输入纹理（前一 pass 的渲染结果） */
        tDiffuse: { value: null },
        /** @type {THREE.Vector2} 渲染目标分辨率（像素） */
        resolution: { value: new THREE.Vector2() },
        /** @type {float} 像素块大小（值越大，像素感越强） */
        pixelSize: { value: 6.0 }
    },

    vertexShader: /* glsl */`
        // 全屏后处理的顶点着色器通常很简单：
        // 直接传递 UV 坐标，顶点为全屏四边形的四个角
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;   // 输入画面纹理
        uniform vec2 resolution;       // 画面分辨率
        uniform float pixelSize;       // 像素块尺寸
        varying vec2 vUv;

        void main() {
            // 计算每个像素块在 UV 空间中的尺寸
            // dxy = pixelSize / resolution，即一个像素块覆盖的 UV 范围
            vec2 dxy = pixelSize / resolution;
            
            // 将 UV 坐标对齐到最近的像素块网格点
            // floor(vUv / dxy) * dxy 实现了「向下取整」量化
            // 同一个像素块内的所有片段会得到相同的 coord，
            // 从而采样到同一个纹素颜色，产生方块化效果
            vec2 coord = dxy * floor(vUv / dxy);
            
            gl_FragColor = texture2D(tDiffuse, coord);
        }
    `
};

// ============================================================================
// 工具函数：着色器材质创建
// ============================================================================

/**
 * 基于着色器定义对象创建 Three.js ShaderMaterial
 * 
 * 此工具函数封装了 ShaderMaterial 的创建流程，
 * 支持合并自定义 uniform 值、设置通用材质属性。
 * 
 * @param {object} shaderDef - 着色器定义对象（如 HeightMapShader、DepthMapShader）
 * @param {string} shaderDef.vertexShader - 顶点着色器 GLSL 代码
 * @param {string} shaderDef.fragmentShader - 片段着色器 GLSL 代码
 * @param {object} shaderDef.uniforms - 默认 uniform 定义
 * @param {object} [customUniforms={}] - 自定义 uniform 值覆盖（仅覆盖 value）
 * @param {object} [materialOptions={}] - 额外的 ShaderMaterial 选项（如 side, transparent 等）
 * @returns {THREE.ShaderMaterial} 配置好的着色器材质实例
 * 
 * @example
 * // 创建高度热力图材质，设置自定义高度范围
 * const heightMat = createShaderMaterial(HeightMapShader, {
 *     uMin: { value: -5.0 },
 *     uMax: { value: 25.0 },
 *     uAxis: { value: 0 }
 * });
 * mesh.material = heightMat;
 * 
 * @example
 * // 创建深度可视化材质（伪彩色模式）
 * const depthMat = createShaderMaterial(DepthMapShader, {
 *     nearPlane: { value: camera.near },
 *     farPlane: { value: camera.far },
 *     depthMode: { value: 1 }
 * }, { side: THREE.DoubleSide });
 */
export function createShaderMaterial(shaderDef, customUniforms = {}, materialOptions = {}) {
    // 深拷贝默认 uniforms，避免多个材质实例共享同一引用
    const mergedUniforms = THREE.UniformsUtils.clone(shaderDef.uniforms);

    // 合并自定义 uniform 值
    for (const [key, uniform] of Object.entries(customUniforms)) {
        if (mergedUniforms[key] !== undefined) {
            mergedUniforms[key].value = uniform.value;
        } else {
            // 允许添加新的 uniform（扩展用途）
            mergedUniforms[key] = { value: uniform.value };
        }
    }

    return new THREE.ShaderMaterial({
        uniforms: mergedUniforms,
        vertexShader: shaderDef.vertexShader,
        fragmentShader: shaderDef.fragmentShader,
        ...materialOptions
    });
}
