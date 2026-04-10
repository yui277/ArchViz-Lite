/**
 * InteractionManager.js — 交互管理器（教育参考版本）
 * 
 * 本文件是 ArchViz-Core 的交互管理架构抽象。
 * 基于生产项目 ArchViz Lite 的 ui.js 模块提炼而成，展示了：
 *   - 跨设备输入归一化策略（指针/触摸统一处理）
 *   - 工具模式状态机（Strategy Pattern）
 *   - 三维拾取与选择管理
 *   - 视口快照与恢复机制
 *   - 快捷键注册系统
 * 
 * 本文件保留完整的接口签名与架构注释，
 * 关键业务实现以 TODO 标记，不可直接运行。
 * 
 * Copyright (c) 2025 Lichengfu2003
 * Educational Reference — Not for production use
 */

import * as THREE from 'three';

// ============================================================================
// 工具模式枚举 (Tool Mode Enum)
// 确立软件的核心功能范畴，每种模式对应独立的交互行为策略
// ============================================================================

export const TOOL_MODES = {
    /** 浏览模式 — 轨道控制器激活，用于模型观察与导航 */
    VIEW: 'view',
    /** 测量模式 — 通过 Raycasting 拾取模型表面顶点，计算边长距离 */
    RULER: 'ruler',
    /** 移动模式 — 激活 TransformControls，允许拖拽编辑对象位置 */
    MOVE: 'move',
    /** 隐藏模式 — 点击对象切换可见性，用于剖析内部结构 */
    HIDE: 'hide',
    /** 剖切模式 — 交互式剖切平面操控，用于建筑截面分析 */
    SECTION: 'section'
};

// ============================================================================
// 预设快捷键映射 (Preset Shortcuts)
// 数字键 0-9 绑定风格预设，字母键绑定工具切换
// ============================================================================

export const PRESET_SHORTCUTS = {
    // --- 数字键：风格预设快速切换 ---
    'Digit1': { action: 'applyPreset', preset: 'Original',  label: '材质模式' },
    'Digit2': { action: 'applyPreset', preset: 'Clay',      label: '素模模式' },
    'Digit3': { action: 'applyPreset', preset: 'Blueprint',  label: '蓝图模式' },
    'Digit4': { action: 'applyPreset', preset: 'XRay',      label: 'X光模式' },
    'Digit5': { action: 'applyPreset', preset: 'Ghosted',   label: '消隐模式' },
    'Digit6': { action: 'applyPreset', preset: 'Shaded',    label: '着色模式' },
    'Digit7': { action: 'applyPreset', preset: 'Tech',      label: '赛博模式' },
    'Digit8': { action: 'applyPreset', preset: 'Sketch',    label: '手绘模式' },
    'Digit9': { action: 'applyPreset', preset: 'Height',    label: '高度热力' },
    'Digit0': { action: 'applyPreset', preset: 'Comic',     label: '漫画模式' },

    // --- 字母键：工具模式切换 ---
    'KeyV': { action: 'setTool', mode: TOOL_MODES.VIEW,    label: '浏览模式' },
    'KeyR': { action: 'setTool', mode: TOOL_MODES.RULER,   label: '测量模式' },
    'KeyM': { action: 'setTool', mode: TOOL_MODES.MOVE,    label: '移动模式' },
    'KeyH': { action: 'setTool', mode: TOOL_MODES.HIDE,    label: '隐藏模式' },
    'KeyC': { action: 'setTool', mode: TOOL_MODES.SECTION, label: '剖切模式' },

    // --- 功能键 ---
    'KeyF':   { action: 'fitCamera',         label: '居中适配' },
    'Escape': { action: 'cancelCurrentTool',  label: '退出当前工具' },
    'KeyS':   { action: 'captureViewport',    label: '保存视口快照', modifier: 'ctrlOrMeta' },
    'KeyL':   { action: 'restoreViewport',    label: '恢复视口快照', modifier: 'ctrlOrMeta' }
};

// ============================================================================
// 设备检测模块 (Device Detection)
// ============================================================================

/**
 * 检测当前设备类型
 * 通过 CSS Media Query 级别的指针精度检测 + 触摸能力判定，
 * 区分桌面端、平板端、手机端，用于自适应交互策略选择。
 * 
 * 设计思路（源自 ui.js getDeviceType）：
 *  - 优先判断指针精度（fine pointer = 鼠标/触控板，coarse pointer = 手指）
 *  - 精细指针且无粗指针 → 桌面设备（即使窗口尺寸小，如 PC 端缩放浏览器）
 *  - 触摸设备按屏幕宽度细分为 phone / tablet / tablet-pro
 * 
 * @returns {{ type: string, isMobile: boolean, isTouch: boolean, hasFinePointer: boolean }}
 */
export function detectDeviceType() {
    const width = window.innerWidth;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isTouch = 'ontouchstart' in window ||
                    navigator.maxTouchPoints > 0 ||
                    navigator.msMaxTouchPoints > 0;

    let type = 'desktop';

    // 拥有精细指针且没有粗指针 → 桌面设备（即使窗口很窄）
    if (hasFinePointer && !hasCoarsePointer) {
        type = 'desktop';
    } else if (isTouch) {
        if (width < 768) type = 'phone';
        else if (width <= 1024) type = 'tablet';
        else if (navigator.maxTouchPoints > 0) type = 'tablet-pro';
    } else if (width <= 1024) {
        type = 'desktop-small';
    }

    return {
        type,
        isMobile: ['phone', 'tablet', 'tablet-pro', 'desktop-small'].includes(type),
        isTouch,
        hasFinePointer
    };
}

/**
 * 响应式断点判定
 * 根据视口宽度返回当前断点标识，供 UI 布局策略使用。
 * 
 * @returns {'phone' | 'tablet' | 'desktop'} 断点标识
 */
export function getResponsiveBreakpoint() {
    const width = window.innerWidth;
    if (width < 768) return 'phone';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

/**
 * 浏览器图形能力检测
 * 检测 WebGL 版本、着色器精度、最大纹理尺寸等，
 * 用于运行时降级策略（如低端设备关闭阴影、降低分辨率）。
 * 
 * @returns {{ webglVersion: number, maxTextureSize: number, shaderPrecision: string, supportsFloat: boolean }}
 */
export function detectBrowserCapabilities() {
    const result = {
        webglVersion: 0,
        maxTextureSize: 0,
        shaderPrecision: 'unknown',
        supportsFloat: false
    };

    // TODO: 创建临时 canvas 获取 WebGL 上下文
    // const canvas = document.createElement('canvas');
    // const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    //
    // if (gl) {
    //     result.webglVersion = gl instanceof WebGL2RenderingContext ? 2 : 1;
    //     result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    //     
    //     // 查询片段着色器的最高浮点精度
    //     const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    //     result.shaderPrecision = highp && highp.precision > 0 ? 'highp' : 'mediump';
    //     
    //     // 检测浮点纹理支持（用于后处理效果）
    //     result.supportsFloat = !!gl.getExtension('OES_texture_float');
    // }

    return result;
}

// ============================================================================
// InteractionManager 类
// ============================================================================

export class InteractionManager {
    /**
     * @param {object} engine - 渲染引擎实例，需提供 renderer, activeCamera, controls, scene
     * @param {object} [config={}] - 可选配置
     * @param {number} [config.zoomSensitivity=1.0] - 缩放灵敏度
     * @param {number} [config.rotateSensitivity=1.0] - 旋转灵敏度
     */
    constructor(engine, config = {}) {
        /** @type {object} 渲染引擎引用 */
        this.engine = engine;

        /** @type {object} 配置项 */
        this.config = {
            zoomSensitivity: config.zoomSensitivity ?? 1.0,
            rotateSensitivity: config.rotateSensitivity ?? 1.0,
            ...config
        };

        // 核心状态树 (State Tree) — 软件逻辑的集中式状态管理
        /** @type {object} */
        this.state = {
            /** @type {string} 当前激活的工具模式 */
            activeTool: TOOL_MODES.VIEW,
            /** @type {boolean} 是否为移动端 */
            isMobile: detectDeviceType().isMobile,
            /** @type {THREE.Object3D[]} 当前选中的对象列表 */
            selection: [],
            /** @type {THREE.Object3D[]} 被隐藏的对象列表 */
            hiddenObjects: [],
            /** @type {boolean} 是否处于隐藏拾取状态 */
            isHiding: false,
            /** @type {object} 视口快照存储 */
            viewport: {
                position: new THREE.Vector3(),
                quaternion: new THREE.Quaternion(),
                target: new THREE.Vector3(),
                zoom: 1.0,
                cameraZoom: 1.0,
                pivotRotY: 0,
                saved: false
            }
        };

        /** @type {THREE.Raycaster} 射线投射器 */
        this.raycaster = new THREE.Raycaster();

        /** @type {THREE.Vector2} 归一化设备坐标 (NDC) */
        this.pointer = new THREE.Vector2();

        /** @type {Map<string, Function>} 已注册的快捷键回调 */
        this._shortcutMap = new Map();

        /** @type {Function|null} resize 防抖定时器引用 */
        this._resizeTimer = null;

        this._initInputListeners();
    }

    // ========================================================================
    // 交互事件处理 (Pointer Events)
    // ========================================================================

    /**
     * 初始化输入监听器
     * 统一 mouse/touch 事件为 pointer 事件体系，
     * 并注册窗口 resize / orientationchange 监听。
     * @private
     */
    _initInputListeners() {
        const domElement = this.engine.renderer?.domElement;
        if (!domElement) return;

        // 统一指针事件绑定
        domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        domElement.addEventListener('pointermove', (e) => this.onPointerMove(e));
        domElement.addEventListener('pointerup', (e) => this.onPointerUp(e));

        // 窗口尺寸变化 — 防抖后重新检测设备类型
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this.state.isMobile = detectDeviceType().isMobile;
                this.onStateChange('resize', { breakpoint: getResponsiveBreakpoint() });
            }, 250);
        });

        // 屏幕方向切换（移动端横竖屏）
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.state.isMobile = detectDeviceType().isMobile;
                this.onStateChange('orientation', detectDeviceType());
            }, 300);
        });
    }

    /**
     * 统一指针按下事件
     * 将 clientX/clientY 归一化为 NDC 坐标后，
     * 根据当前工具模式分发到对应处理逻辑。
     * 
     * @param {PointerEvent} event
     */
    onPointerDown(event) {
        this._updatePointerNDC(event);

        switch (this.state.activeTool) {
            case TOOL_MODES.RULER:
                // TODO: 拾取测量起点/终点
                // 参考 ui.js setupToolbar 中 ruler 模式的 click 拾取逻辑
                // 通过 raycast 获取最近表面点，记录到测量状态
                break;

            case TOOL_MODES.HIDE:
                // TODO: 拾取对象并切换可见性
                // 参考 ui.js setupGUI 中 toggleHide 的实现
                // raycast → 命中对象 → object.visible = false → 加入 hiddenObjects 列表
                break;

            case TOOL_MODES.SECTION:
                // TODO: 剖切平面交互拖拽起始
                // 拾取剖切平面辅助器，准备拖拽调整剖切位置
                break;

            case TOOL_MODES.MOVE:
                // TODO: TransformControls 在 pointerdown 时自行处理拾取
                break;

            default:
                // VIEW 模式：由 OrbitControls 自行处理
                break;
        }
    }

    /**
     * 统一指针移动事件
     * 持续更新 NDC 坐标，在测量模式下驱动悬停提示。
     * 
     * @param {PointerEvent} event
     */
    onPointerMove(event) {
        this._updatePointerNDC(event);

        if (this.state.activeTool === TOOL_MODES.RULER) {
            // TODO: 更新测量悬停提示（tooltip 跟随鼠标，显示最近顶点距离）
            // 参考 ui.js showAnnotation / _handleRulerHover
        }
    }

    /**
     * 统一指针抬起事件
     * 
     * @param {PointerEvent} event
     */
    onPointerUp(event) {
        this._updatePointerNDC(event);

        // TODO: 根据模式执行最终确认逻辑
        // RULER 模式下确认测量终点，SECTION 模式下结束拖拽
    }

    /**
     * 将屏幕坐标转换为 NDC（归一化设备坐标）
     * x, y 均映射到 [-1, 1] 区间，供 Raycaster 使用。
     * 
     * @param {PointerEvent} event
     * @private
     */
    _updatePointerNDC(event) {
        const rect = this.engine.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    // ========================================================================
    // 工具模式切换 (Tool Mode Switching)
    // ========================================================================

    /**
     * 切换工具模式
     * 实现 Strategy Pattern：每次切换先清理旧模式状态，再激活新模式。
     * 
     * 清理逻辑包含（源自 ui.js setTool）：
     *  - 隐藏测量辅助线和标注 (rulerLine, rulerPoints, annotation)
     *  - 分离 TransformControls (transformControl.detach)
     *  - 隐藏选择框 (selectionBox.visible = false)
     *  - 移除 body 上的 CSS 模式类 (mode-ruler, mode-hide)
     * 
     * @param {string} mode - TOOL_MODES 中的值
     */
    setToolMode(mode) {
        if (!Object.values(TOOL_MODES).includes(mode)) {
            console.warn(`[InteractionManager] Unknown tool mode: ${mode}`);
            return;
        }

        const previousMode = this.state.activeTool;
        if (previousMode === mode) return;

        console.log(`[InteractionManager] Tool switch: ${previousMode} → ${mode}`);

        // Step 1: 清理旧模式状态
        // TODO: 实现 _cleanupCurrentMode
        // - 隐藏测量辅助线 (rulerLine.visible = false)
        // - 隐藏测量标注点 (rulerPoints.visible = false)
        // - 调用 hideAnnotation() 关闭悬浮提示
        // - 若旧模式是 MOVE，detach TransformControls
        // - 若旧模式是 HIDE，移除 mode-hide CSS 类
        // - 隐藏选择边界框 (selectionBox.visible = false)
        this._cleanupCurrentMode();

        // Step 2: 更新状态
        this.state.activeTool = mode;

        // Step 3: 激活新模式
        switch (mode) {
            case TOOL_MODES.VIEW:
                // 启用轨道控制器，禁用其他交互
                this._enableOrbitControls(true);
                break;

            case TOOL_MODES.RULER:
                // 测量模式：可选择是否锁定视角旋转
                // 添加 mode-ruler CSS 类以改变光标样式
                this._enableOrbitControls(true);
                this._initRulerSystem();
                break;

            case TOOL_MODES.MOVE:
                // 启用 TransformControls，允许拖拽对象
                this._enableOrbitControls(true);
                this._enableTransformControls(true);
                break;

            case TOOL_MODES.HIDE:
                // 进入隐藏拾取状态
                this._enableOrbitControls(true);
                this.state.isHiding = true;
                break;

            case TOOL_MODES.SECTION:
                // 剖切交互模式：显示剖切平面辅助器，允许拖拽调整
                this._enableOrbitControls(true);
                this._initSectionInteraction();
                break;
        }

        // Step 4: 通知外部（Observer Pattern）
        this.onStateChange('toolMode', mode);
    }

    // ========================================================================
    // 三维拾取 (Raycasting)
    // ========================================================================

    /**
     * 执行射线投射拾取
     * 从当前 pointer NDC 坐标发出射线，与场景中的对象求交。
     * 
     * @param {THREE.Vector2} pointer - 归一化设备坐标
     * @param {THREE.Camera} camera - 当前活动相机
     * @param {THREE.Scene|THREE.Object3D} scene - 拾取目标（场景或特定组）
     * @returns {THREE.Intersection[]} 相交结果数组（按距离升序）
     */
    raycast(pointer, camera, scene) {
        this.raycaster.setFromCamera(pointer, camera);
        return this.raycaster.intersectObjects(scene.children, true);
    }

    /**
     * 更新选择状态
     * 根据 raycast 结果更新 state.selection 列表。
     * 
     * @param {THREE.Intersection[]} intersects - raycast 返回的相交结果
     */
    updateSelection(intersects) {
        // TODO: 实现选择更新逻辑
        // - 过滤辅助对象 (isHelper, isOverlay 等 userData 标记)
        // - 支持单选和多选（Shift 键）
        // - 更新选择边界框可视化
        // - 触发 onStateChange('selection', this.state.selection)

        if (intersects.length === 0) {
            this.state.selection = [];
            this.onStateChange('selection', []);
            return;
        }

        // 取第一个非辅助对象
        const hit = intersects.find(i =>
            i.object && !i.object.userData?.isHelper && !i.object.userData?.isOverlay
        );

        if (hit) {
            this.state.selection = [hit.object];
            this.onStateChange('selection', this.state.selection);
        }
    }

    // ========================================================================
    // 视图快照 (Viewport Snapshot)
    // ========================================================================

    /**
     * 保存当前视口状态快照
     * 记录相机位置、朝向、控制器目标点、缩放等完整视口状态，
     * 支持后续一键恢复（源自 ui.js setupGUI 中的 save/load 逻辑）。
     * 
     * @returns {{ position: THREE.Vector3, quaternion: THREE.Quaternion, target: THREE.Vector3, zoom: number, cameraZoom: number, pivotRotY: number }}
     */
    captureViewport() {
        const camera = this.engine.activeCamera;
        const controls = this.engine.controls;
        if (!camera || !controls) return null;

        const snapshot = this.state.viewport;
        snapshot.position.copy(camera.position);
        snapshot.quaternion.copy(camera.quaternion);
        snapshot.target.copy(controls.target);
        snapshot.cameraZoom = camera.zoom;
        // TODO: 读取全局 State.viewZoom 和 pivot.rotation.y
        // snapshot.zoom = State.viewZoom;
        // snapshot.pivotRotY = pivotGroup.rotation.y;
        snapshot.saved = true;

        return { ...snapshot };
    }

    /**
     * 恢复视口快照
     * 将相机、控制器目标点、缩放值恢复到快照记录的状态。
     * 
     * @param {object} [snapshot] - 可选，传入特定快照；不传则使用内部保存的快照
     * @returns {boolean} 是否恢复成功
     */
    restoreViewport(snapshot) {
        const vp = snapshot || this.state.viewport;
        if (!vp || !vp.saved) {
            console.warn('[InteractionManager] No viewport snapshot available.');
            return false;
        }

        const camera = this.engine.activeCamera;
        const controls = this.engine.controls;
        if (!camera || !controls) return false;

        camera.position.copy(vp.position);
        camera.quaternion.copy(vp.quaternion);
        controls.target.copy(vp.target);
        camera.zoom = vp.cameraZoom;
        camera.updateProjectionMatrix();

        // TODO: 恢复全局 State.viewZoom 和 pivot.rotation.y
        // State.viewZoom = vp.zoom;
        // pivotGroup.rotation.y = vp.pivotRotY;
        // engine.onResize(); // 触发视图缩放同步

        controls.update();
        return true;
    }

    // ========================================================================
    // 快捷键系统 (Keyboard Shortcuts)
    // ========================================================================

    /**
     * 注册快捷键映射
     * 支持组合键（Ctrl/Meta + Key），注册后通过 keydown 事件触发回调。
     * 
     * @param {Object<string, { handler: Function, modifier?: string, label?: string }>} keyMap
     *   键名使用 KeyboardEvent.code（如 'KeyV', 'Digit1', 'Escape'），
     *   modifier 可选值: 'ctrl', 'shift', 'alt', 'ctrlOrMeta'
     * 
     * @example
     * interaction.registerShortcuts({
     *     'KeyV': { handler: () => interaction.setToolMode(TOOL_MODES.VIEW), label: '浏览模式' },
     *     'Digit1': { handler: () => applyPreset('Original'), label: '材质预设' },
     *     'KeyS': { handler: () => interaction.captureViewport(), modifier: 'ctrlOrMeta', label: '保存视口' }
     * });
     */
    registerShortcuts(keyMap) {
        // 清理之前的监听器
        if (this._keydownListener) {
            document.removeEventListener('keydown', this._keydownListener);
        }

        // 合并到内部映射
        for (const [code, config] of Object.entries(keyMap)) {
            this._shortcutMap.set(code, config);
        }

        // 注册统一的 keydown 监听器
        this._keydownListener = (event) => {
            // 忽略输入框中的按键
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

            const binding = this._shortcutMap.get(event.code);
            if (!binding) return;

            // 检查修饰键
            if (binding.modifier) {
                const needCtrl = binding.modifier === 'ctrl' || binding.modifier === 'ctrlOrMeta';
                const needMeta = binding.modifier === 'meta' || binding.modifier === 'ctrlOrMeta';
                const needShift = binding.modifier === 'shift';
                const needAlt = binding.modifier === 'alt';

                if (needCtrl && !event.ctrlKey && !(needMeta && event.metaKey)) return;
                if (needShift && !event.shiftKey) return;
                if (needAlt && !event.altKey) return;
            } else {
                // 无修饰键要求时，若按了 Ctrl/Meta 则跳过（避免冲突系统快捷键）
                if (event.ctrlKey || event.metaKey) return;
            }

            event.preventDefault();
            binding.handler(event);
        };

        document.addEventListener('keydown', this._keydownListener);
    }

    // ========================================================================
    // 私有辅助方法 (Private Helpers)
    // ========================================================================

    /**
     * 清理当前模式的状态与 UI 痕迹
     * @private
     */
    _cleanupCurrentMode() {
        // TODO: 参考 ui.js setTool 中的清理逻辑
        // - 隐藏测量辅助几何体
        // - detach TransformControls
        // - 移除 CSS 模式类 (mode-ruler, mode-hide)
        // - 重置 isHiding 状态
        this.state.isHiding = false;
    }

    /**
     * 启用/禁用轨道控制器
     * @param {boolean} enabled
     * @private
     */
    _enableOrbitControls(enabled) {
        // TODO: this.engine.controls.enabled = enabled;
    }

    /**
     * 启用/禁用 TransformControls
     * @param {boolean} enabled
     * @private
     */
    _enableTransformControls(enabled) {
        // TODO: 创建或切换 TransformControls 的 attach/detach 状态
        // if (enabled && this.state.selection.length > 0) {
        //     this.engine.transformControl.attach(this.state.selection[0]);
        // } else {
        //     this.engine.transformControl.detach();
        // }
    }

    /**
     * 初始化测量系统
     * @private
     */
    _initRulerSystem() {
        // TODO: 初始化测量辅助线、标注点
        // 创建 Line 几何体用于可视化测量线段
        // 创建 Points 几何体标记拾取的顶点
    }

    /**
     * 初始化剖切交互
     * @private
     */
    _initSectionInteraction() {
        // TODO: 显示剖切平面辅助器
        // 允许沿指定轴拖拽调整 sectionOffset
        // 参考 ui.js setupGUI 中剖切分析部分的参数绑定
    }

    // ========================================================================
    // 事件回调接口 (Observer Interface)
    // ========================================================================

    /**
     * 状态变更回调（供外部 UI 层绑定）
     * 当交互状态发生变化时被调用，外部可覆写此方法实现 UI 同步。
     * 
     * @param {string} key - 变更的状态键名 ('toolMode' | 'selection' | 'resize' | 'orientation')
     * @param {*} value - 新值
     */
    onStateChange(key, value) {
        // 默认空实现，由使用者覆写
        // 例如：
        // interactionManager.onStateChange = (key, value) => {
        //     if (key === 'toolMode') updateToolbarUI(value);
        //     if (key === 'selection') updateSelectionPanel(value);
        // };
    }

    /**
     * 销毁管理器，移除所有事件监听
     */
    dispose() {
        if (this._keydownListener) {
            document.removeEventListener('keydown', this._keydownListener);
        }
        clearTimeout(this._resizeTimer);
        // TODO: 移除 pointer 事件监听
        // TODO: 销毁 TransformControls 等辅助对象
    }
}
