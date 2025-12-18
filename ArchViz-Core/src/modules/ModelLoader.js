/**
 * Model Loader Module
 * Copyright (c) 2025 Lichengfu2003
 * * 资产加载核心：
 * * 1. 多格式支持 (Rhino .3dm, .glb, .obj)
 * * 2. 自动几何中心化与尺度归一化
 * * 3. 材质元数据保存 (用于风格切换)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class ModelLoader {
    constructor(scene) {
        this.scene = scene;
        
        // 核心容器：所有加载的模型都放入此组，便于统一旋转/缩放
        this.container = new THREE.Group();
        this.scene.add(this.container);

        // 状态数据
        this.modelBounds = new THREE.Box3();
        this.modelSize = 0;
        this.loaders = {};

        this._initLoaders();
    }

    /**
     * 初始化所有 3D 格式加载器
     * 配置 CDN 路径以支持 Draco 解压和 Rhino 运算
     */
    _initLoaders() {
        // 1. Draco Decoder (用于压缩的 glTF)
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');

        // 2. GLTF Loader
        this.loaders.gltf = new GLTFLoader();
        this.loaders.gltf.setDRACOLoader(dracoLoader);

        // 3. Rhino 3dm Loader
        this.loaders.rhino = new Rhino3dmLoader();
        this.loaders.rhino.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/');

        // 4. OBJ Loader
        this.loaders.obj = new OBJLoader();
    }

    /**
     * 加载本地文件 (File Object)
     * @param {File} file - 用户拖拽或选择的文件对象
     * @param {string} unit - 'm' | 'mm'
     */
    async loadFromFile(file, unit = 'm') {
        const url = URL.createObjectURL(file);
        const extension = file.name.split('.').pop().toLowerCase();

        try {
            return await this._loadByExtension(url, extension, unit);
        } finally {
            URL.revokeObjectURL(url); // 释放内存
        }
    }

    /**
     * 加载远程 URL
     * @param {string} url 
     * @param {string} unit 
     */
    async loadFromUrl(url, unit = 'm') {
        // 简单的扩展名检测
        const extension = url.split('?')[0].split('.').pop().toLowerCase();
        return await this._loadByExtension(url, extension, unit);
    }

    /**
     * 内部加载分发逻辑
     */
    async _loadByExtension(url, extension, unit) {
        console.log(`[Loader] Loading ${extension} model...`);
        this.container.clear(); // 清空旧模型

        let modelData;
        const loader = this._getLoader(extension);

        if (!loader) {
            throw new Error(`Unsupported file format: .${extension}`);
        }

        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (object) => {
                    // GLTF 返回的是一个包含 scene 的对象
                    const root = object.scene || object;
                    this._processModel(root, unit, extension === '3dm');
                    resolve(root);
                },
                (xhr) => {
                    // Progress callback (optional implementation)
                    // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                (error) => {
                    console.error('An error happened', error);
                    reject(error);
                }
            );
        });
    }

    _getLoader(ext) {
        if (ext.includes('glb') || ext.includes('gltf')) return this.loaders.gltf;
        if (ext.includes('3dm')) return this.loaders.rhino;
        if (ext.includes('obj')) return this.loaders.obj;
        return null;
    }

    /**
     * 模型后处理核心逻辑 (The "Secret Sauce")
     * 1. 单位统一化
     * 2. 计算包围盒
     * 3. 居中模型
     * 4. 保存原始材质引用
     */
    _processModel(root, unit, fixUpAxis) {
        // 1. 单位缩放
        if (unit === 'mm') {
            root.scale.set(0.001, 0.001, 0.001);
        } else {
            root.scale.set(1, 1, 1);
        }

        // 2. Rhino 模型修正 (Rhino Z-up vs Three.js Y-up)
        if (fixUpAxis) {
            root.rotation.x = -Math.PI / 2;
        }

        this.container.add(root);

        // 3. 几何分析与优化
        const box = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        
        box.getCenter(center);
        box.getSize(size);

        // 居中模型 (让旋转中心位于模型几何中心)
        // 注意：这里移动的是 root 的位置，抵消掉其原始坐标的偏移
        root.position.x += (root.position.x - center.x);
        root.position.y += (root.position.y - center.y);
        root.position.z += (root.position.z - center.z);
        
        // 如果是 Rhino 旋转过的，需要特殊处理 Y/Z 轴的居中逻辑
        if (fixUpAxis) {
            // 简单的修正逻辑，视具体情况微调
            root.position.y = 0; 
        }

        this.modelBounds.setFromObject(this.container);
        this.modelSize = Math.max(size.x, size.y, size.z);

        // 4. 材质预处理 (Material Pre-pass)
        root.traverse((node) => {
            if (node.isMesh) {
                // 开启投影
                node.castShadow = true;
                node.receiveShadow = true;

                // 备份原始材质，以便后续切换回 "Original" 风格
                if (node.material) {
                    node.userData.originalMat = Array.isArray(node.material) 
                        ? node.material.map(m => m.clone()) 
                        : node.material.clone();
                }

                // 自动生成边缘线数据 (为 Blueprint/Tech 风格做准备)
                // 注意：为了性能，这里只标记，实际几何体生成可延迟处理
                node.userData.isProcessable = true;
            }
        });

        console.log(`[Loader] Processed. Size: ${this.modelSize.toFixed(2)}m`);
    }

    /**
     * 获取模型当前信息
     */
    getModelInfo() {
        return {
            size: this.modelSize,
            bounds: this.modelBounds,
            vertexCount: this._countVertices()
        };
    }

    _countVertices() {
        let count = 0;
        this.container.traverse(node => {
            if (node.isMesh && node.geometry) {
                count += node.geometry.attributes.position.count;
            }
        });
        return count;
    }
}