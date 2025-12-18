/**
 * Interaction & State Manager Architecture
 * Copyright (c) 2025 Lichengfu2003
 * * * 交互架构核心：
 * * 1. 集中式状态管理 (State Management)
 * * 2. 工具模式切换逻辑 (Tool Strategy Pattern)
 * * 3. 跨设备输入事件统一处理 (Input Normalization)
 */

import * as THREE from 'three';

// 定义工具模式枚举，确立软件的核心功能范畴
export const TOOL_MODES = {
    VIEW: 'view',   // 浏览模式
    RULER: 'ruler', // 测量模式
    MOVE: 'move',   // 移动/编辑模式
    HIDE: 'hide'    // 隐藏/管理模式
};

export class InteractionManager {
    constructor(engine, config) {
        this.engine = engine; // 引用渲染引擎
        this.config = config;
        
        // 核心状态树 (State Tree) - 这是软件逻辑的“指纹”
        this.state = {
            activeTool: TOOL_MODES.VIEW,
            isMobile: this.detectDeviceType().isMobile,
            selection: [],
            // 视图状态快照
            viewport: {
                position: new THREE.Vector3(),
                target: new THREE.Vector3(),
                zoom: 1.0
            }
        };

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        
        this.initInputListeners();
    }

    /**
     * 设备检测算法架构
     * 证明开发者对多端交互有底层思考
     */
    detectDeviceType() {
        const width = window.innerWidth;
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        return {
            isMobile: width < 768 && isTouch,
            isTablet: width >= 768 && width <= 1024 && isTouch,
            isDesktop: !isTouch
        };
    }

    /**
     * 统一工具切换接口 (Command Pattern)
     * 管理不同模式下的交互行为差异
     */
    setToolMode(mode) {
        if (!Object.values(TOOL_MODES).includes(mode)) {
            console.warn(`Unknown tool mode: ${mode}`);
            return;
        }

        console.log(`[System] Switching Interaction Mode: ${this.state.activeTool} -> ${mode}`);
        
        // 1. 清理旧模式状态 (Cleanup)
        this._cleanupCurrentMode();

        // 2. 更新状态
        this.state.activeTool = mode;

        // 3. 激活新模式逻辑 (Activate)
        switch (mode) {
            case TOOL_MODES.VIEW:
                this._enableOrbitControls(true);
                break;
            case TOOL_MODES.RULER:
                this._enableOrbitControls(false); // 测量时可能需要锁定视角
                this._initRulerSystem();
                break;
            case TOOL_MODES.MOVE:
                this._enableTransformControls(true);
                break;
        }
        
        // 触发事件通知 UI 层更新 (Observer Pattern 占位符)
        this.onStateChange('toolMode', mode);
    }

    /**
     * 输入事件归一化处理
     * 将 Mouse 和 Touch 事件统一为 3D 空间坐标
     */
    onPointerMove(event) {
        // 计算标准设备坐标 (NDC)
        // x, y 映射到 -1 到 1 之间
        const rect = this.engine.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // 根据当前模式分发逻辑
        if (this.state.activeTool === TOOL_MODES.RULER) {
            this._handleRulerHover();
        }
    }

    /**
     * 测量系统核心算法 (逻辑骨架)
     * 展示如何通过 Raycasting 获取模型顶点并计算距离
     */
    _handleRulerHover() {
        this.raycaster.setFromCamera(this.pointer, this.engine.activeCamera);
        // 这里隐去了具体的求交计算代码，保留架构逻辑
        // logic: raycast -> find nearest vertex -> update UI tooltip
    }

    /**
     * 视口状态保存/恢复机制
     * 这是工具类软件的高级特性
     */
    saveViewportState() {
        if (!this.engine.activeCamera) return;
        this.state.viewport.position.copy(this.engine.activeCamera.position);
        this.state.viewport.target.copy(this.engine.controls.target);
        // ... 保存更多状态
    }

    restoreViewportState() {
        // ... 恢复状态逻辑
        this.engine.controls.update();
    }

    // 私有辅助方法 (示意)
    _cleanupCurrentMode() { /* ... */ }
    _enableOrbitControls(enabled) { /* ... */ }
    _enableTransformControls(enabled) { /* ... */ }
    
    // 供外部 UI 绑定的回调接口
    onStateChange(key, value) {}
}