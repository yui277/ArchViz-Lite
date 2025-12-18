/**
 * Global Configuration
 * * ⚠️ SECURITY WARNING: 
 * Do NOT commit real API keys to GitHub. 
 * Use Environment Variables or user input in production.
 */

export const CONFIG = {
    // API Endpoints
    API_ENDPOINTS: {
        ALIYUN: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        DEEPSEEK: 'https://api.deepseek.com/v1/chat/completions',
        FLUX: 'https://api.blackforestlabs.com/v1/flux-pro'
    },

    // API Keys (Leave empty for open source release)
    API_KEYS: {
        ALIYUN: process.env.ALIYUN_API_KEY || '',
        DEEPSEEK: process.env.DEEPSEEK_API_KEY || '',
        FLUX: ''
    },

    // Default Visual Settings
    DEFAULTS: {
        colors: {
            background: '#f0f0f0',
            grid: '#888888',
            selection: '#107c10'
        },
        shadowResolution: 4096,
        pixelationSize: 6.0
    }
};