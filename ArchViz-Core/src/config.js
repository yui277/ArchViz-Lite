/**
 * ArchViz-Core Configuration Module
 * 
 * ⚠️ EDUCATIONAL REFERENCE VERSION
 * This is a structural reference for the ArchViz-Core engine configuration.
 * You MUST fill in your own API keys, endpoints, and domain-specific values
 * before the application can function in a production environment.
 * 
 * @version 1.2.4
 * @license MIT
 * @see README.md for setup instructions
 */

// ============================================================================
//  ⛔ DO NOT COMMIT REAL API KEYS TO VERSION CONTROL
//  Use environment variables, .env files, or runtime injection instead.
// ============================================================================

export const CONFIG = {

    // ── Application ─────────────────────────────────────────────────────
    /** Core application settings */
    APP: {
        /** When true, auto-loads a predefined model on startup */
        showcaseMode: false,
        /** URL or path to the showcase model (only used when showcaseMode is true) */
        modelUrl: './assets/demo.3dm',
        /** Semantic version string */
        version: '1.2.4-BETA',
        /** Application display name */
        name: 'ArchViz Lite'
    },

    // ── Scene Defaults ──────────────────────────────────────────────────
    /** Default values for scene state. Grouped by domain for clarity. */
    DEFAULTS: {

        /** Background & environment */
        background: {
            type: 'Grid',          // 'Solid' | 'Grid' | 'Image' | 'Camera'
            color: '#f0f0f0',
            fogEnabled: false,
            fogColor: '#f0f0f0',
            fogDensity: 0.005
        },

        /** Model appearance */
        model: {
            baseType: 'Clay',      // 'Clay' | 'Original' | 'Blueprint' | …
            baseOpacity: 1.0,
            baseColor: '#fafafa',
            showEdges: true,
            edgeColor: '#2b2b2b',
            edgeThreshold: 15,
            edgeOpacity: 0.8,
            edgeWidth: 1,
            showWireframe: false,
            wireColor: '#666666',
            wireOpacity: 0.2,
            showBounds: false,
            showComposition: false,
            fixUpAxis: false,
            heatAxis: 'Y-Axis'
        },

        /** Lighting presets */
        lighting: {
            sunEnabled: true,
            sunIntensity: 1.8,
            sunAngle: 45,
            topLightEnabled: true,
            topIntensity: 0.7,
            fillLightEnabled: true,
            fillIntensity: 0.5,
            shadowResolution: 4096,
            shadowRadius: 4,
            /** Tweak per-scene; typical range [-0.001, -0.0001] */
            shadowBias: '<CONFIGURE_PER_SCENE>',
            shadowNormalBias: '<CONFIGURE_PER_SCENE>',
            shadowOpacity: 0.25,
            showGroundShadow: true
        },

        /** Camera & controls */
        camera: {
            autoRotate: false,
            autoSunAnimation: false,
            rotationSpeed: 1.0,
            sunSpeed: 1.0,
            zoomSensitivity: 1.0,
            rotateSensitivity: 1.0,
            rotateY: 0,
            viewZoom: 1.0
        },

        /** Post-processing */
        postProcess: {
            mode: 'None',          // 'None' | 'Sketch' | 'Bloom' | 'Halftone' | 'Pixel'
            pixelSize: 6.0
        },

        /** Grid helper */
        grid: {
            size: 90,
            divisions: 50,
            height: 0,
            color: '#888888',
            surfGridScale: 1.0,
            surfGridColor: '#000000'
        },

        /** Section / clipping */
        section: {
            active: false,
            axis: 'y',            // 'x' | 'y' | 'z'
            offset: 0,
            invert: false,
            cap: false,
            capColor: '#808080'
        },

        /** Reference human */
        human: {
            show: false,
            position: [0, 0, 0]
        }
    },

    // ── API Endpoints ───────────────────────────────────────────────────
    /**
     * Service endpoints for AI features.
     * Replace placeholder URLs with your own proxy / direct endpoints.
     */
    API_ENDPOINTS: {
        /** DeepSeek Chat Completions (used by AI Animation) */
        DEEPSEEK: '<YOUR_DEEPSEEK_ENDPOINT>',
        /** Aliyun DashScope (used by Smart Export AI Rendering) */
        ALIYUN: '<YOUR_ALIYUN_ENDPOINT>',
        /** Black Forest Labs Flux (used by Smart Export AI Rendering) */
        FLUX: '<YOUR_FLUX_ENDPOINT>',
        /** Volcano Engine / Jimeng (used by Smart Export AI Rendering) */
        VOLCANO: {
            baseUrl: '<YOUR_VOLCANO_BASE_URL>',
            proxyUrl: '<YOUR_VOLCANO_PROXY_URL>',
            service: 'cv',
            region: 'cn-north-1',
            action: 'ImageGenerationCreateTask',
            version: '2024-02-01'
        }
    },

    // ── API Keys ────────────────────────────────────────────────────────
    // ⛔ DO NOT COMMIT REAL API KEYS — use environment variables!
    API_KEYS: {
        DEEPSEEK:    process.env.DEEPSEEK_API_KEY    || '',
        ALIYUN:      process.env.ALIYUN_API_KEY      || '',
        FLUX:        process.env.FLUX_API_KEY         || '',
        VOLCANO_AK:  process.env.VOLCANO_AK           || '',
        VOLCANO_SK:  process.env.VOLCANO_SK           || ''
    },

    // ── AI Animation ────────────────────────────────────────────────────
    /**
     * Configuration skeleton for the AI-driven animation pipeline.
     * The full system prompt and shot-plan protocol are intentionally
     * reduced to a framework example — extend for your own use case.
     */
    AI_ANIMATION: {
        /** LLM model identifier for the director agent */
        model: 'deepseek-chat',
        /** Sampling temperature (0 = deterministic, 1 = creative) */
        temperature: 0.7,
        /** Maximum tokens for a single LLM response */
        maxTokens: 4096,

        /** Retry policy */
        maxRetries: 2,
        directorMaxRetries: 1,

        /** Safety bounds */
        minActionDuration: 0.05,
        maxActions: 48,
        maxShots: 8,

        /** Base animation protocol sent to the LLM */
        animationProtocol: {
            version: '1.1',
            metadata: { title: 'AI Generated Animation', duration: 24, fps: 30 },
            timeline: []
        },

        /**
         * System prompt — simplified framework example.
         * In production this contains full action-type references,
         * capability lists, and output-format constraints.
         * @see docs/AI-INTEGRATION.md for the complete prompt design.
         */
        systemPrompt: [
            'You are a professional 3D architectural visualization animation director.',
            'Convert the user\'s animation description into a standardized JSON script.',
            '',
            'Available action types:',
            '  setCamera, moveCamera, lookAt, rotateObject, sectionCut,',
            '  applyPreset, setSunAngle, toggleBounds, toggleGrid',
            '',
            'Output format: { "version":"1.1", "metadata":{...}, "timeline":[...] }',
            '',
            '// TODO: Add full capability list, examples, and constraints'
        ].join('\n'),

        /** Example user descriptions for UI hint display */
        exampleDescriptions: [
            '缓慢旋转一圈展示模型整体',
            '从上往下剖切展示内部结构',
            '环绕模型展示不同角度',
            '切换不同视觉风格',
            '生长动画：从底部逐渐显示完整模型'
        ]
    },

    // ── Smart Export ────────────────────────────────────────────────────
    /**
     * Configuration skeleton for the smart (AI-enhanced) export pipeline.
     * The full batch-config library is omitted — only the structural
     * schema and channel list are provided.
     */
    SMART_EXPORT: {
        /** Available AI rendering channels */
        channels: ['aliyun', 'flux', 'volcano'],

        /** CORS proxy list for cross-origin image fetching */
        corsProxies: [
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest=',
            'https://api.allorigins.win/raw?url='
        ],

        /** Prompt presets — map of display-name → prompt string */
        promptPresets: {
            '超写实渲染': '超写实建筑渲染，4K细节，自然光影，材质真实感…',
            '白模表现':   '建筑白模风格，干净简洁，体积感强…',
            '概念草图':   '概念设计草图，手绘风格，氛围感…'
            // Add more presets as needed
        },

        /**
         * Batch configuration type enumeration.
         * Each type corresponds to a pre-defined array of camera setups.
         * The actual config arrays are omitted — implement per your needs.
         */
        batchConfigTypes: [
            'axonometric',          // 轴测视图组（正交相机，8方位）
            'elevation',            // 正立面/侧立面/俯仰视图（正交，6方向）
            'perspective',          // 透视视图组（透视相机，8方位）
            'section',              // 剖切视图组（X/Y/Z轴，多偏移量）
            'twoPointPerspective',  // 两点透视组（5方位）
            'stylePresets'          // 风格预设组（10种视觉风格）
        ]

        // TODO: Populate BATCH_CONFIGS[type] arrays with camera position,
        //       rotation, viewAngle, fov, section params, etc.
        //       See source project for the full batch-config library.
    }
};

// ============================================================================
//  Utility: Config Validation
// ============================================================================

/**
 * Validates the runtime configuration and reports missing / invalid entries.
 *
 * @param {object} config - The CONFIG object (or a merged user override).
 * @returns {{ valid: boolean, errors: string[] }}
 *
 * TODO: Implement validation rules:
 *   - Ensure all API_KEYS are non-empty strings when their feature is enabled
 *   - Ensure API_ENDPOINTS contain valid URL patterns
 *   - Ensure DEFAULTS values are within acceptable ranges
 *   - Ensure AI_ANIMATION.maxActions > 0 and <= 100
 *   - Return structured error list for UI display
 */
export function validateConfig(config) {
    // TODO: Implement validation logic
    const errors = [];

    // Example stub:
    // if (!config.API_KEYS.DEEPSEEK) {
    //     errors.push('Missing DEEPSEEK API key — AI Animation will be unavailable.');
    // }

    return { valid: errors.length === 0, errors };
}
