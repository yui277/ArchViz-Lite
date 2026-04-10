/**
 * ArchViz-Core — Core Rendering Engine
 *
 * Manages the full lifecycle of a Three.js architectural visualization scene:
 * scene graph, dual-camera system, WebGL renderer, orbit/transform controls,
 * post-processing pipeline, helper overlays, and the render loop.
 *
 * @version 1.2.4
 * @license MIT
 * @copyright 2025-2026 Lichengfu2003
 *
 * Implementation details for rendering pipeline internals are documented in
 * docs/RENDERING-PIPELINE.md and are intentionally omitted from this file.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

/**
 * @typedef {Object} EngineState
 * @property {THREE.Scene}               scene
 * @property {THREE.WebGLRenderer}       renderer
 * @property {THREE.Camera}              activeCamera
 * @property {{ ortho: THREE.OrthographicCamera, persp: THREE.PerspectiveCamera }} cameras
 * @property {OrbitControls}             controls
 * @property {TransformControls|null}    transformControl
 * @property {THREE.EffectComposer|null} composer
 */

export class ArchVizEngine {

    // ────────────────────────────────────────────────────────────────────
    //  Construction
    // ────────────────────────────────────────────────────────────────────

    /**
     * Create an ArchViz engine instance.
     *
     * @param {string} containerID - DOM element ID that will host the WebGL canvas.
     * @param {object} config      - Merged configuration object (see src/config.js).
     */
    constructor(containerID, config) {
        /** @type {object} Merged runtime configuration */
        this.config = config;

        /** @type {HTMLElement|null} DOM container for the renderer canvas */
        this.container = document.getElementById(containerID);

        // ── Core Three.js objects ──
        /** @type {THREE.Scene|null} */
        this.scene = null;

        /** @type {THREE.WebGLRenderer|null} */
        this.renderer = null;

        /** @type {THREE.Camera|null} Currently active camera */
        this.activeCamera = null;

        /** Dual-camera system for architectural visualization */
        this.cameras = {
            /** @type {THREE.OrthographicCamera|null} Used for plan / section / axonometric views */
            ortho: null,
            /** @type {THREE.PerspectiveCamera|null} Used for perspective / two-point-perspective views */
            persp: null
        };

        // ── Controls ──
        /** @type {OrbitControls|null} */
        this.controls = null;

        /** @type {TransformControls|null} */
        this.transformControl = null;

        // ── Post-processing ──
        /** @type {THREE.EffectComposer|null} Managed by PostProcessing module */
        this.composer = null;

        // ── Scene graph groups ──
        /** Hierarchical group structure: main → pivot → model / stencil */
        this.groups = {
            main: null,
            pivot: null,
            model: null,
            cap: null,
            stencil: null
        };

        // ── Helpers & overlays ──
        this.helpers = {
            gridMajor: null,
            gridMinor: null,
            boundingBox: null,
            rulerLine: null,
            rulerPoints: null,
            capPlane: null,
            human: null,
            selectionBox: null,
            transformGizmo: null
        };

        // ── Clipping ──
        /** @type {THREE.Plane[]} Active clipping planes for section cuts */
        this.clipPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];

        // ── Stencil materials (for section-cap rendering) ──
        this.stencilMats = { back: null, front: null, cap: null };

        // ── Shadow receiver ──
        /** @type {THREE.Mesh|null} */
        this.shadowPlane = null;

        // ── Runtime metrics ──
        this.stats = { lastFrame: 0, frames: 0 };

        // ── Interaction state ──
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.currentModelSize = 100;
        this.modelBounds = new THREE.Box3();
        this.hiddenObjects = [];

        /** @type {object|null} Reference to loaded module registry (PostProcessing, Lighting…) */
        this._modules = null;
    }

    // ────────────────────────────────────────────────────────────────────
    //  Initialization
    // ────────────────────────────────────────────────────────────────────

    /**
     * Bootstrap the entire engine: scene → renderer → cameras → controls →
     * post-processing → helpers → groups → event listeners → render loop.
     *
     * Call this once after construction. Throws on critical failure.
     *
     * @param {object} [modules] - External module registry (PostProcessing, Lighting, etc.)
     * @returns {void}
     */
    init(modules) {
        this._modules = modules || {};

        // 1. Scene
        this.setupScene();

        // 2. Renderer
        this.setupRenderer();

        // 3. Camera system (ortho + perspective)
        this.setupCameras();

        // 4. Controls (orbit + transform)
        this.setupControls();

        // 5. Post-processing pipeline (delegates to PostProcessing module)
        this.setupPostProcessing();

        // 6. Stencil materials for section-cap rendering
        this._initStencilMaterials();

        // 7. Scene graph groups
        this._initGroups();

        // 8. Helper overlays (grid, shadow plane, ruler, reference human…)
        this.setupHelpers();

        // 9. DOM & window event bindings
        this._bindEvents();

        // 10. Start render loop
        this.animate();
    }

    // ────────────────────────────────────────────────────────────────────
    //  Scene
    // ────────────────────────────────────────────────────────────────────

    /**
     * Create the Three.js scene with background colour and optional fog.
     * Background type (solid / gradient / transparent) is driven by config.
     */
    setupScene() {
        this.scene = new THREE.Scene();

        // Background colour from config defaults
        const bgColor = this.config?.DEFAULTS?.background?.color ?? '#f0f0f0';
        this.scene.background = new THREE.Color(bgColor);

        // Fog — disabled by default; parameters from config
        const fog = this.config?.DEFAULTS?.background;
        if (fog?.fogEnabled) {
            // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
            // Fog near/far are calculated relative to the model bounding sphere
            this.scene.fog = new THREE.Fog(fog.fogColor, /* near */ 500, /* far */ 2000);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Renderer
    // ────────────────────────────────────────────────────────────────────

    /**
     * Configure the WebGL renderer.
     *
     * Key options:
     *  - antialias          : MSAA for smoother edges
     *  - alpha              : transparent canvas background support
     *  - preserveDrawingBuffer : required for screenshot / export features
     *  - logarithmicDepthBuffer : prevents z-fighting on large architectural models
     *  - stencil            : required for section-cap rendering
     *
     * Shadow map type uses VSMShadowMap for soft shadow edges.
     * Local clipping is enabled for section-cut planes.
     */
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            logarithmicDepthBuffer: true,
            stencil: true
        });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Clamp pixel ratio to avoid performance issues on high-DPI screens
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Shadow mapping
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;

        // Section clipping support
        this.renderer.localClippingEnabled = true;

        // Mount to DOM
        if (this.container) {
            this.container.appendChild(this.renderer.domElement);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Camera System
    // ────────────────────────────────────────────────────────────────────

    /**
     * Initialise the dual-camera system.
     *
     * - **Orthographic** camera for plan views, axonometric projections,
     *   elevation drawings, and section analysis.
     * - **Perspective** camera for eye-level renders, fly-throughs,
     *   and two-point-perspective compositions.
     *
     * Both cameras start at the same default position; frustum and FOV
     * values are derived from config or sensible architectural defaults.
     */
    setupCameras() {
        const aspect = window.innerWidth / window.innerHeight;

        // ── Orthographic camera ──
        // Frustum half-size = 50 world units; near/far span large enough
        // for architectural models (±1e6).
        this.cameras.ortho = new THREE.OrthographicCamera(
            -50 * aspect, 50 * aspect, 50, -50,
            -1e6, 1e6
        );

        // ── Perspective camera ──
        // FOV, near, far chosen for typical building-scale scenes.
        // Concrete values should come from config.DEFAULTS.camera.
        this.cameras.persp = new THREE.PerspectiveCamera(
            /* fov */ 45,
            aspect,
            /* near */ 0.1,
            /* far */ 100000
        );

        // Default position — isometric-ish overview
        const defaultPos = new THREE.Vector3(100, 100, 100);
        [this.cameras.ortho, this.cameras.persp].forEach(cam => {
            cam.position.copy(defaultPos);
            cam.lookAt(0, 0, 0);
        });

        // Start with orthographic (standard for architectural analysis)
        this.activeCamera = this.cameras.ortho;
    }

    // ────────────────────────────────────────────────────────────────────
    //  Controls
    // ────────────────────────────────────────────────────────────────────

    /**
     * Set up OrbitControls and TransformControls.
     *
     * OrbitControls mapping:
     *  - Left mouse  → Pan
     *  - Middle mouse → Dolly (zoom)
     *  - Right mouse  → Rotate
     *  - Touch: single = rotate, two-finger = dolly + pan
     *
     * TransformControls provide translate/rotate/scale gizmos for
     * individual mesh manipulation.
     */
    setupControls() {
        // ── Orbit controls ──
        this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;

        // Button mapping — architectural convention: LMB = pan
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };

        // Sensitivity from config
        const camCfg = this.config?.DEFAULTS?.camera ?? {};
        this.controls.zoomSpeed = camCfg.zoomSensitivity ?? 1.0;
        this.controls.rotateSpeed = camCfg.rotateSensitivity ?? 1.0;

        // ── Transform controls ──
        try {
            this.transformControl = new TransformControls(
                this.activeCamera,
                this.renderer.domElement
            );

            // Disable orbit while dragging a gizmo
            this.transformControl.addEventListener('dragging-changed', (event) => {
                this.controls.enabled = !event.value;
            });

            this.transformControl.setMode('translate');
            this.transformControl.setSpace('local');
            this.transformControl.setSize(0.65);
            this.transformControl.enabled = true;

            // Retrieve the visual helper (API varies across Three.js versions)
            const helper = (typeof this.transformControl.getHelper === 'function')
                ? this.transformControl.getHelper()
                : this.transformControl;
            this.helpers.transformGizmo = helper;
            this.scene.add(helper);
        } catch (error) {
            this.transformControl = null;
            this.helpers.transformGizmo = null;
            console.error('TransformControls initialisation failed; move mode disabled.', error);
        }

        // ── Selection box helper ──
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
    }

    // ────────────────────────────────────────────────────────────────────
    //  Post-Processing
    // ────────────────────────────────────────────────────────────────────

    /**
     * Initialise the post-processing pipeline.
     *
     * Delegates to the external PostProcessing module which manages:
     *  - RenderPass (base scene)
     *  - Sobel / edge-detection pass (Sketch mode)
     *  - DotScreen / halftone pass
     *  - UnrealBloomPass (glow)
     *  - Custom PixelShader pass
     *
     * Falls back to direct renderer output if initialisation fails.
     */
    setupPostProcessing() {
        if (!this._modules?.PostProcessing) {
            // No PostProcessing module registered — skip
            this.composer = null;
            return;
        }

        try {
            this._modules.PostProcessing.init(
                this.renderer,
                this.scene,
                this.activeCamera
            );
            this.composer = this._modules.PostProcessing.composer ?? null;
        } catch (error) {
            console.error('PostProcessing init failed; falling back to basic rendering.', error);
            this.composer = null;
            // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────────────────────────────

    /**
     * Create all visual helper overlays:
     *  - **Grid** (major + minor lines)
     *  - **Shadow plane** (receives ground shadows)
     *  - **Ruler** (edge-length measurement line + points)
     *  - **Section cap plane** (stencil-based cross-section fill)
     *  - **Reference human** (~1.75 m figure for scale)
     *
     * Each helper is created hidden by default and toggled via state flags.
     */
    setupHelpers() {
        // ── Grid ──
        this._updateGridHelper();

        // ── Reference human ──
        this._initHumanHelper();

        // ── Shadow ground plane ──
        // A large invisible plane that only receives shadow.
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md

        // ── Ruler line + endpoint markers ──
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md

        // ── Section cap plane ──
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
    }

    // ────────────────────────────────────────────────────────────────────
    //  Render Loop
    // ────────────────────────────────────────────────────────────────────

    /**
     * Main animation / render loop (called via requestAnimationFrame).
     *
     * Per-frame responsibilities:
     *  1. Update OrbitControls (damping, auto-rotate)
     *  2. Advance sun animation if enabled
     *  3. Update selection-box overlay
     *  4. Update HUD debug readouts (camera position, FPS)
     *  5. Sync bounds-label screen positions
     *  6. Sync reference-human visibility
     *  7. Render via EffectComposer or direct renderer
     *  8. Increment frame counter
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // Controls update (damping + auto-rotate)
        if (this.controls) {
            // Auto-rotate speed and enable flag are bound to reactive state
            // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
            this.controls.update();
        }

        // Sun animation — increments sunAngle each frame when enabled
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md

        // Selection-box tracking
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md

        // ── Render ──
        if (this.renderer && this.scene && this.activeCamera) {
            if (this.composer) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.activeCamera);
            }
        }

        this.stats.frames++;
    }

    // ────────────────────────────────────────────────────────────────────
    //  Viewport Resize
    // ────────────────────────────────────────────────────────────────────

    /**
     * Handle window / container resize.
     *
     * For **orthographic** cameras the frustum is recalculated from the
     * current model bounding-box size and zoom level so that the model
     * fills the viewport consistently.
     *
     * For **perspective** cameras only the aspect ratio is updated.
     *
     * Also resizes the renderer and post-processing composer.
     */
    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const aspect = w / h;

        if (this.activeCamera.isOrthographicCamera) {
            // Frustum is derived from model size and current zoom level
            // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
            const size = this.currentModelSize || 100;
            const f = size; // simplified — actual formula includes zoom factor
            this.activeCamera.left = -f * aspect / 2;
            this.activeCamera.right = f * aspect / 2;
            this.activeCamera.top = f / 2;
            this.activeCamera.bottom = -f / 2;
        } else {
            this.activeCamera.aspect = aspect;
        }

        this.activeCamera.updateProjectionMatrix();
        this.renderer.setSize(w, h);

        // Resize post-processing buffers
        if (this._modules?.PostProcessing) {
            this._modules.PostProcessing.resize(w, h);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    //  Camera Switching
    // ────────────────────────────────────────────────────────────────────

    /**
     * Switch the active camera between orthographic, perspective,
     * and two-point-perspective modes.
     *
     * Position and quaternion are copied from the outgoing camera so the
     * viewpoint is preserved across switches.
     *
     * Two-point-perspective locks the polar angle to the horizon
     * (minPolarAngle = maxPolarAngle = π/2) to simulate the architectural
     * convention of keeping verticals parallel.
     *
     * @param {'ortho' | 'persp' | '2pt'} type - Target camera mode.
     */
    switchCamera(type) {
        const oldCam = this.activeCamera;
        const newCam = (type === 'ortho') ? this.cameras.ortho : this.cameras.persp;

        // Carry over viewpoint
        newCam.position.copy(oldCam.position);
        newCam.quaternion.copy(oldCam.quaternion);

        // Two-point perspective: lock vertical rotation
        if (type === '2pt') {
            this.controls.minPolarAngle = Math.PI / 2;
            this.controls.maxPolarAngle = Math.PI / 2;
            // Align camera Y to target Y for a true two-point effect
            newCam.position.y = this.controls.target.y;
        } else {
            this.controls.minPolarAngle = 0;
            this.controls.maxPolarAngle = Math.PI;
        }

        this.activeCamera = newCam;
        this.controls.object = newCam;

        // Update transform gizmo camera reference
        if (this.transformControl) {
            this.transformControl.camera = newCam;
        }

        // Update post-processing render pass camera
        if (this.composer) {
            const renderPass = this.composer.passes.find(p => p instanceof RenderPass);
            if (renderPass) renderPass.camera = newCam;
        }

        this.onResize();
        this.controls.update();
    }

    // ────────────────────────────────────────────────────────────────────
    //  Resource Disposal
    // ────────────────────────────────────────────────────────────────────

    /**
     * Release all GPU resources, detach event listeners, and nullify
     * references to allow garbage collection.
     *
     * Call this when the engine instance is no longer needed (e.g. SPA
     * route change, hot-module-replacement teardown).
     */
    dispose() {
        // Stop render loop
        // (relies on the animate() self-reference being broken by nullifying renderer)

        // Remove event listeners
        window.removeEventListener('resize', this._boundOnResize);
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md

        // Dispose controls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        if (this.transformControl) {
            this.transformControl.dispose();
            this.transformControl = null;
        }

        // Dispose post-processing
        if (this.composer) {
            // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
            this.composer = null;
        }

        // Traverse scene and dispose geometries / materials / textures
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];
                    materials.forEach(mat => {
                        Object.values(mat).forEach(val => {
                            if (val instanceof THREE.Texture) val.dispose();
                        });
                        mat.dispose();
                    });
                }
            });
            this.scene = null;
        }

        // Dispose renderer & remove canvas from DOM
        if (this.renderer) {
            this.renderer.dispose();
            if (this.container && this.renderer.domElement.parentNode === this.container) {
                this.container.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }

        this.activeCamera = null;
        this.cameras.ortho = null;
        this.cameras.persp = null;
    }

    // ────────────────────────────────────────────────────────────────────
    //  Private Helpers
    // ────────────────────────────────────────────────────────────────────

    /**
     * Build the scene-graph group hierarchy.
     * @private
     */
    _initGroups() {
        this.groups.main = new THREE.Group();
        this.groups.pivot = new THREE.Group();
        this.groups.model = new THREE.Group();
        this.groups.cap = new THREE.Group();
        this.groups.stencil = new THREE.Group();

        this.scene.add(this.groups.main);
        this.groups.main.add(this.groups.pivot);
        this.groups.pivot.add(this.groups.model);
        this.groups.pivot.add(this.groups.stencil);
        this.scene.add(this.groups.cap);
    }

    /**
     * Create stencil materials used for section-cap rendering.
     * Uses increment-wrap / decrement-wrap stencil ops on back / front
     * faces, then renders the cap where stencil ≠ 0.
     * @private
     */
    _initStencilMaterials() {
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
        // Back-face pass:  stencilOp = IncrementWrap on all fail/zfail/zpass
        // Front-face pass: stencilOp = DecrementWrap on all fail/zfail/zpass
        // Cap pass:        renders where stencil ≠ 0 with configurable cap colour
    }

    /**
     * Create or update the grid helper pair (major + minor).
     * Grid size, divisions, colour, and height are read from config.
     * @private
     */
    _updateGridHelper() {
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
        // Creates two THREE.GridHelper instances with different opacity
        // for major (10-cell spacing) and minor (1-cell spacing) lines.
    }

    /**
     * Create a simple ~1.75 m reference human figure for scale.
     * Composed of a cylinder (body) and sphere (head).
     * @private
     */
    _initHumanHelper() {
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
        // Body:  CylinderGeometry(0.25, 0.2, 1.45)
        // Head:  SphereGeometry(0.2)
        // Added to this.groups.pivot, initially hidden.
    }

    /**
     * Bind DOM and window event listeners.
     * @private
     */
    _bindEvents() {
        this._boundOnResize = this.onResize.bind(this);
        window.addEventListener('resize', this._boundOnResize);

        // Pointer events for ruler / selection / hide mode
        // Implementation detail omitted - see docs/RENDERING-PIPELINE.md
    }
}
