/**
 * ArchViz Lite Core Engine
 * Copyright (c) 2025 Lichengfu2003
 * * 核心渲染引擎逻辑：负责 Three.js 场景构建、渲染循环、后期处理管道管理。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PixelShader } from '../shaders/CustomShaders.js';

export class ArchVizEngine {
    constructor(containerId, config) {
        this.config = config;
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.controls = null;
        
        // 渲染状态
        this.state = {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: Math.min(window.devicePixelRatio, 2)
        };

        this.init();
    }

    init() {
        // 1. 场景初始化
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.colors.background);
        
        // 2. 渲染器设置
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true, 
            preserveDrawingBuffer: true, // 允许截图
            logarithmicDepthBuffer: true 
        });
        this.renderer.setSize(this.state.width, this.state.height);
        this.renderer.setPixelRatio(this.state.pixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        
        if (this.container) {
            this.container.appendChild(this.renderer.domElement);
        }

        // 3. 相机系统 (正交/透视切换逻辑)
        this.setupCameras();

        // 4. 后期处理管道 (核心视觉表现)
        this.setupPostProcessing();

        // 5. 光照系统
        this.setupLighting();

        // 6. 启动循环
        this.animate();
        
        window.addEventListener('resize', this.onResize.bind(this));
    }

    setupCameras() {
        const aspect = this.state.width / this.state.height;
        // 初始化正交相机用于建筑分析图
        this.orthoCamera = new THREE.OrthographicCamera(-50*aspect, 50*aspect, 50, -50, -1e6, 1e6);
        this.orthoCamera.position.set(100, 100, 100);
        this.orthoCamera.lookAt(0, 0, 0);
        
        this.activeCamera = this.orthoCamera;
        
        // 控制器
        this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.activeCamera));

        // Bloom Pass (光晕效果)
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.state.width, this.state.height), 
            1.5, 0.4, 0.85
        );
        this.bloomPass.enabled = false;
        this.composer.addPass(this.bloomPass);

        // Pixel Art Pass (像素化滤镜 - 自定义Shader)
        this.pixelPass = new ShaderPass(PixelShader);
        this.pixelPass.uniforms['resolution'].value.set(this.state.width, this.state.height);
        this.pixelPass.uniforms['pixelSize'].value = 6.0;
        this.pixelPass.enabled = false;
        this.composer.addPass(this.pixelPass);
    }

    setupLighting() {
        // 专业的建筑布光设置：主光 + 补光 + 顶光
        const sun = new THREE.DirectionalLight(0xffffff, 1.8);
        sun.position.set(100, 150, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 4096; // 高质量阴影
        sun.shadow.mapSize.height = 4096;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);
        
        const ambient = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambient);
    }

    // 核心渲染循环
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        this.controls.update();
        
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.activeCamera);
        }
    }

    onResize() {
        this.state.width = window.innerWidth;
        this.state.height = window.innerHeight;
        
        this.activeCamera.updateProjectionMatrix();
        this.renderer.setSize(this.state.width, this.state.height);
        this.composer.setSize(this.state.width, this.state.height);
    }
}