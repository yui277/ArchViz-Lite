# 变更日志

## v1.2.4 (260410) - 2026-04-10

### 新增
- PostProcessing 模块：后期处理管线架构（Bloom/像素化/边缘检测/轮廓）
- SectionCut 模块：剖切分析系统架构（Stencil Buffer 三步渲染）
- docs/ 技术文档目录：5 篇架构设计与技术分析文档
- CHANGELOG.md 变更日志

### 更新
- config.js：重构为分区式配置架构（APP/DEFAULTS/API/AI/EXPORT）
- ArchVizEngine.js：新增双相机系统、Transform 控制器、后期处理管道入口
- InteractionManager.js：新增 SECTION 工具模式、设备能力检测、快捷键系统
- AIAnimation.js：重构为双阶段架构（Planner + Executor）
- ModelLoader.js：新增 LightingSystem 类、坐标系检测、单位转换
- SmartExport.js：重构为抽象工厂模式（三渠道接口）
- CustomShaders.js：新增深度图着色器、GLSL 原理注释
- README.md：更新至 v1.2.4，新增学习指南和文档索引

### 架构改进
- 全面采用 ES Module 导出模式
- 统一 JSDoc 文档注释规范
- 引入策略模式（交互管理）和抽象工厂模式（智能导出）
- 配置与实现分离，支持环境变量注入

## v1.2.0 (260308) - 2026-03-08

### 初始发布
- ArchVizEngine 核心引擎
- InteractionManager 交互管理器
- AIAnimation AI 动画模块
- ModelLoader 模型加载器
- SmartExport 智能导出模块
- CustomShaders 自定义着色器
- CC BY-NC-SA 4.0 许可证
