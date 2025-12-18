/**
 * Custom Shader Definitions
 * Copyright (c) 2025 Lichengfu2003
 * * 包含用于视觉分析的自定义 GLSL 着色器。
 */

import * as THREE from 'three';

// 1. 像素化艺术滤镜 (Pixel Art Shader)
// 用于生成复古/像素风格的建筑表现图
export const PixelShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'resolution': { value: new THREE.Vector2() },
        'pixelSize': { value: 6.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float pixelSize;
        varying vec2 vUv;
        void main() {
            vec2 dxy = pixelSize / resolution;
            vec2 coord = dxy * floor( vUv / dxy );
            gl_FragColor = texture2D(tDiffuse, coord);
        }
    `
};

// 2. 高度分析着色器 (Height Analysis Shader)
// 根据模型 Y 轴高度进行热力图着色，用于建筑体量分析
export const HeightAnalysisShader = {
    vertexShader: `
        varying float vY; 
        uniform int uAxis; 
        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            if (uAxis == 0) { vY = worldPos.y; } else { vY = worldPos.z; }
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        uniform float uMin; 
        uniform float uMax; 
        varying float vY;
        void main() {
            float t = (vY - uMin) / (uMax - uMin); 
            t = clamp(t, 0.0, 1.0);
            vec3 color = vec3(0.0);
            // 热力图渐变逻辑: 蓝 -> 青 -> 绿 -> 黄 -> 红
            if(t < 0.25) color = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), t * 4.0);
            else if(t < 0.5) color = mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.25) * 4.0);
            else if(t < 0.75) color = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.5) * 4.0);
            else color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.75) * 4.0);
            gl_FragColor = vec4(color, 1.0);
        }
    `
};

// 3. 深度分析着色器 (Depth Analysis Shader)
// 基于相机距离的深度图渲染
export const DepthShader = {
    vertexShader: `
        varying float vDepth;
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            vDepth = -mvPosition.z; 
        }
    `,
    fragmentShader: `
        uniform float uNear; 
        uniform float uFar; 
        varying float vDepth;
        void main() {
            float d = (vDepth - uNear) / (uFar - uNear);
            d = clamp(d, 0.0, 1.0);
            gl_FragColor = vec4(vec3(d), 1.0);
        }
    `
};