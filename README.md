# mineRadio

<p align="center">
  <img src="/public/icon.png" width="128" height="128" alt="mineRadio" />
</p>

mineradio 是一款 Windows 桌面沉浸式音乐播放器，结合天气电台、搜索播放、歌词舞台、粒子视觉和 3D 歌单架，提供更接近现场感的私人音乐空间。

项目主线基于 Tauri2 构建，前端、桌面能力、本地服务和共享类型分层开发，重点关注轻量桌面体验、视觉表现、播放稳定性和本地隐私。

## 核心特性

- 天气电台：根据位置、城市和天气状态组织播放体验。
- 多源搜索与播放：支持网易云音乐和 QQ 音乐相关能力。
- 歌词舞台：支持歌词同步、视觉层级、样式和播放状态联动。
- 沉浸式视觉：粒子舞台、Canvas/WebGL、GSAP 动画和播放态视觉。
- 3D 歌单架：面向歌单浏览、选择和播放队列的空间化交互。
- 桌面能力：窗口控制、桌面歌词、系统集成和 Windows 体验。
- 本地服务：通过 sidecar 处理 provider、音乐 API、天气、音频代理、缓存和诊断。
- 应用更新：固定 GitHub Releases，由签名校验的 Rust Update Runtime 负责检查、下载与安装。

## 技术栈

- Tauri 2、Rust、WebView2
- Bun workspace
- Vite、TypeScript、Vue 3、Pinia
- Bun sidecar runtime
- shared types、zod
- Canvas / WebGL / GSAP visual engine
- Rust Update Runtime + GitHub Releases + Minisign

## 本地开发

准备环境：

- Windows 10/11
- Windows WebView2 Runtime
- pnpm
- Rust stable
- Tauri 2 CLI

安装依赖：

```powershell
pnpm install
```

启动开发环境：

```powershell
pnpm tauri dev
```

构建：

```powershell
pnpm tauri build
```

常用检查：

```powershell
pnpm typecheck
pnpm test
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
```

不同 workspace 或 package 可能有更具体的脚本，请以当前模块声明的脚本为准。

## 安装正式版

正式安装包只从本仓库的 [GitHub Releases](https://github.com/Tangkoom/mineradio) 获取。Windows 可能显示 SmartScreen 提示；请先确认下载页面和安装包来源确实是上述官方仓库，再按系统提示手动确认运行。不要为安装本应用关闭 Defender 或 SmartScreen。

## 项目结构

```text
mineradio/
├─ .github/
│  └─ ISSUE_TEMPLATE/   # Issue 模板
├─ src/
│  └─ main.ts            # vue 桌面应用入口
├─ assets/
│  └─ font/             # 应用字体源文件
├─ src-tauri/
│  ├─ main.rs            # tauri 桌面应用入口
└─ README.md
```

## 开发原则

- Vue 负责界面状态和用户操作。
- Vue/Tauri 负责窗口、系统能力、sidecar 生命周期和更新。
- shared 包负责跨层类型、zod schema 和 API 契约。
- 用户 Cookie、Token、日志和本地隐私数据不得进入仓库。

## 第三方音乐平台说明

- mineradio 是一个非官方的音乐播放器，与网易云音乐、QQ 音乐或腾讯音乐娱乐集团无关。
- mineradio 不是网易云音乐、QQ 音乐或腾讯音乐娱乐集团的官方客户端，也不隶属于任何音乐平台。

项目中的第三方平台接入仅用于个人学习、本地客户端体验和用户自有账号的播放辅助。请遵守对应平台的用户协议、版权规则和会员权益规则。项目不会提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力。

## 用户数据与隐私

登录 Cookie、搜索历史、自定义封面、自定义歌词、节奏分析缓存和诊断日志等数据应保存在本机应用数据目录或本地存储中。

提交 Issue、PR、日志或截图前，请确认没有包含 Cookie、Token、账号信息、私密链接、本地隐私路径或可识别个人身份的信息。

## 参与贡献

欢迎提交 Issue、PR、测试反馈和文档改进。开始前请阅读 [贡献指南](./CONTRIBUTING.md)。

## 致谢

mineradio 由 XxHuberrr的Minerdio改造而来[GitHub Releases](https://github.com/XxHuberrr/Mineradio)。

## 版权与授权

Copyright (C) 2026 XxHuberrr.

本项目原创核心代码采用 GPL-3.0-only 授权。Sonic Topography 视觉层基于已记录的来源链、维护者审阅的公开合作证据与项目决策进行迁移，并保留其单独的 `Non-Commercial Learning License` 与个人非商业限制；该证据不等于额外书面授权、再许可或许可放宽。完整来源链、适用范围和许可正文见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

mineradio 名称、界面视觉设计与原创视觉表达归作者所有；第三方依赖和第三方服务分别遵循其各自授权与服务条款。
