# AVA (ArchViz Lite)

> **Lightweight Engine | Native Rhino Support | Local Computing | Multi-Device | Stylized Visualization | Instant Analysis | AI Integration**
>
> **轻量引擎 · Rhino直读 · 本地计算 · 多端适配 · 风格化显示 · 分析动画直出 · AI集成**

### **Live Web / 在线体验**: [www.lichengfu2003.top/tools/ava.html](http://www.lichengfu2003.top/tools/ava.html)
### **Intro Doc / 详细介绍**: [www.lichengfu2003.top/tools/intro/ava_tool_intro.html](www.lichengfu2003.top/tools/intro/ava_tool_intro.html)

**If you are a professional developer in a related field and find my project interesting, feel free to contact me! Since programming isn't actually my major, and I'm more inclined to delve deeper into design in the future, I'm currently seeking strong partners to discuss the future development plans for this series of projects!**

**如果你是相关领域的专业开发者，觉得我的项目有趣，欢迎联系我！因为实际上编程并非我的主业，我在未来也更倾向于深耕艺术与设计，所以我目前也正在寻求强力的合作伙伴，不论是想个人对接个人还是企业对接企业，我都可以安排，交流关于这系列项目的未来开发计划！**


https://github.com/user-attachments/assets/2c40e095-2bb3-420f-bf1d-d1018787f09a


## Origin & Philosophy (项目初衷)

### The "Student" Pain Point (源于校园的真实需求)

The inception of AVA dates back to my sophomore year. Like many design students, I faced a dilemma: professional visualization software (like Lumion/D5) requires heavy workstation laptops, while existing web viewers often demand uploading files to public clouds, charging subscription fees, or failing to support raw `.3dm` files natively.

Designers needed a tool that respects their privacy, runs on any device (even an iPad on a dusty construction site), and visualizes design intent instantly without the "rendering tax."

项目的雏形诞生于大二时期。和许多建环专业学生一样，我发现市面上的商业化云渲染工具往往针对大型工程项目设计，不仅收费昂贵，还依赖将文件上传至云端服务器。对于学生或小型工作室而言，我们需要的不是繁重的渲染农场，而是一个**纯前端、零依赖、即开即用**的轻量化工具。

### The "Studio" Solution (解决事务所的汇报痛点)

In professional practice, small studios often rely on static PPTs for client presentations. When a client asks, *"What does it look like from that corner?"* or *"Can we see the section cut here?"*, designers awkwardly scramble to open Rhino on a laptop, disrupting the flow.

**AVA changes this.** It allows designers to embed interactive 3D models directly into presentation slides or share a secure link. It transforms a static pitch into a dynamic, interactive discussion, professionalizing the workflow for boutique firms. **In addition, the lightweight nature of the tool also allows team members to view and collaborate on projects anytime, anywhere.**

在小型事务所团队的汇报场景中，静态的 PPT 效果图往往难以应对甲方的突发提问（如“这个死角的视野是怎样的？”）。现场打开 Rhino 模型不仅缓慢，且容易打断汇报节奏。AVA 旨在解决这一痛点：它让 3D 交互能够像图片一样轻便，甚至直接嵌入 PPT，让每一次汇报都显得专业且从容。**此外，工具的轻量性也可以满足团队成员随时随地对项目进行查看与协作。**

## Target Scenarios (核心应用场景)

### 1. Academic & Education (高校与教学)

- **Instant Crits**: Students can show models to tutors on a tablet/phone instantly without carrying a gaming laptop.
- **Course Presentation**: Interactive diagrams and stylized analysis (Heatmaps, Blueprint mode) generated in seconds, replacing hours of rendering.
- **校园汇报**: 取代耗时的渲染图，用实时交互的轴测图、蓝图风格和热力图直接进行方案推敲与汇报。

### 2. Boutique Studios & Agile Teams (小型事务所与敏捷团队)

- **Interactive Pitching**: Embed the AVA web viewer link into slides. When clients have questions, switch to the live view instantly.
- **Site Visits & Collaboration**: Check complex Rhino details on an iPad while walking through the construction site, no internet required (Local mode). The lightweight nature of the tool also allows team members to view and collaborate on projects anytime, anywhere.
- **敏捷汇报与协作**: 在汇报现场实时响应甲方的视角需求，展现专业度。**此外，工具的轻量性也可以满足团队成员随时随地对项目进行查看与协作。**

### 3. Future Commercial Services (未来商业服务愿景)

- **Private Cloud Deployment**: Secure, password-protected sharing links (similar to Google Drive/Baidu Netdisk) for client deliverables, ensuring data never leaves the firm's control.
- **Digital Twin Customization**: For large-scale urban projects (e.g., street blocks), we can customize AVA into a "Lightweight Digital Twin" dashboard with specific UI, buttons, and analysis data, accessible via a single link.
- **私有化定制**: 为事务所提供类似网盘的加密分享链接服务，或为大型项目定制专属的“轻量化数字孪生”展示页。

## Core Features (技术特性)

### 1. Native Asset Support (原生资产支持)

- **Rhino Native**: Direct support for `.3dm` files (Rhino 5/6/7/8) via `rhino3dm.wasm`.
- **Universal Formats**: Full support for `.glb/.gltf` (Draco compressed) and `.obj`.
- **Smart Optimization**: Auto-detection of Z-up/Y-up axis, high-poly warning (>2M verts), and auto-scaling.

### 2. Visual Styles & Analysis (风格与分析)

Powered by custom GLSL shaders for instant artistic expression:

- **Artistic Modes**: Clay (素模), Blueprint (蓝图), Sketch (手绘), PixelArt (像素风), Retro (复古).
- **Analysis Modes**:
  - **Height Heatmap**: Visualization of building massing height (Y/Z axis).
  - **Real-time Sectioning**: 3-axis capping cuts with solid fills.
  - **X-Ray/Ghosted**: Internal structure inspection.

### 3. AI-Powered Workflow (AI 集成与实景分析)

Integrates Reality Synthesis, AI Rendering, and AI Animation to rapidly generate basic analysis diagrams.

集成 实景合成、AI出图、AI动画 等功能，帮助设计师 快速获得基础分析图。

- **Reality Synthesis (实景合成)**: Overlay 3D models on live camera feed for instant site context analysis (AR-Lite).
  - *调用设备摄像头作为背景，实现模型与现场实景的实时合成与分析。*
- **Smart Export (AI出图 / Aliyun & Flux)**: Image-to-Image AI rendering to turn basic viewport screenshots into photorealistic visuals.
  - *基于图生图技术，将简单的视口截图瞬间转化为高质量效果图。*
- **Generative Animation (AI动画 / DeepSeek)**: Natural language camera control (e.g., *"Rotate 360 and cut from top"*).
  - *AI 驱动的脚本生成，通过自然语言一键产出动态分析演示。*

### 4. Interaction Architecture (交互架构)

- **Smart Tools**: Intelligent edge measurement, bounding box info.
- **Camera System**: Seamless switching: Orthographic <-> Perspective <-> 2-Point Perspective.
- **Multi-Device**: Fully optimized for touch input (iPad/Mobile) with responsive Fluent Design UI.

## Technical Architecture (技术架构)

This project follows a strict Modular Architecture.

Note: The UI/CSS implementation is proprietary. This repository contains the core logic patterns.

> 本项目采用低耦合、高内聚的模块化设计。
>
> 注：UI与具体样式实现为闭源部分，本仓库开源了核心逻辑与架构模式。

```
graph TD
    A[User Input / Touch] --> B(InteractionManager);
    B --> C{Core Engine};
    C --> D[ModelLoader];
    C --> E[Lighting System];
    C --> F[Post-Processing];
    
    D --> |rhino3dm/Draco| G[3D Assets];
    
    H[AI Modules] -.-> |JSON Script| B;
    H -.-> |Img2Img| F;
```

### Directory Structure (目录结构)

- `src/core/`:
  - `ArchVizEngine.js`: WebGL loop, scene management.
  - `InteractionManager.js`: State management & Tool Strategy Pattern.
- `src/modules/`:
  - `ModelLoader.js`: Async asset pipeline (Unit/Axis fix).
  - `SmartExport.js`: Cloud API integration (Aliyun/Flux).
  - `AIAnimation.js`: LLM-based animation script logic.
- `src/shaders/`: Custom GLSL shaders (PixelArt, Heatmaps).

## Getting Started (本地运行)

Since this is a client-side web application, you can run it with any static file server.

1. **Clone the repository**

   ```
   git clone [https://github.com/lichengfu2003/ArchViz-Lite.git](https://github.com/lichengfu2003/ArchViz-Lite.git)
   ```

2. **Serve the files** (e.g., using Python)

   ```
   cd ArchViz-Lite
   python -m http.server 8000
   ```

3. Open Browser

   Visit http://localhost:8000

## License & Rights (版权与授权)

**Copyright © 2025 Lichengfu2003. All Rights Reserved.**

This project is licensed under the **CC BY-NC-SA 4.0** (Attribution-NonCommercial-ShareAlike 4.0 International).

- ✅ **Educational Use**: Free for students, teachers, and researchers.
- ✅ **Personal Study**: Free for individual developers to learn the architecture.
- ❌ **Commercial Use**: Strictly **PROHIBITED** without permission.

> **Commercial Licensing / Custom Deployment (商业合作)**
>
> If you are a design firm looking for **Private Cloud Deployment (私有云部署)**, **Digital Twin Customization (数字孪生定制)**, or secure project hosting services, please contact the author.
>
> **If you are a professional developer in a related field and find my project interesting, feel free to contact me! Since programming isn't actually my major, and I'm more inclined to delve deeper into design in the future, I'm currently seeking strong partners to discuss the future development plans for this series of projects!**
>
> 如需 **企业私有化部署**（加密文件分享）、**大型项目数字孪生定制** 或 **商业授权**，请联系作者。
>
> **如果你是相关领域的专业开发者，觉得我的项目有趣，欢迎联系我！因为实际上编程并非我的主业，我在未来也更倾向于深耕艺术与设计，所以我目前也正在寻求强力的合作伙伴，不论是想个人对接个人还是企业对接企业，我都可以安排，交流关于这系列项目的未来开发计划！**

## Contact (联系方式)

- **Author**: Lichengfu2003（黎城甫）
- **Email**: [lichengfu2003@outlook.com](mailto:lichengfu2003@outlook.com)
- **Website**: [lichengfu2003.top](https://www.lichengfu2003.top/)

*Developed with ❤️ by Lichengfu2003（黎城甫） @ Cell&Chord Design (Shenzhen).*
