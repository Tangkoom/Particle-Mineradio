# Particle-Mineradio

<p align="center">
  <img src="/public/icon.png" width="128" height="128" alt="Particle-Mineradio" />
</p>

Particle-Mineradio 是一款 Windows 桌面沉浸式音乐播放器，结合天气电台、网易云搜索播放、歌词舞台、粒子视觉和沉浸式 3D 背景，提供更接近现场感的私人音乐空间。

项目基于 Tauri 2 构建，前端界面与 Rust 桌面能力分层开发，重点关注轻量桌面体验、视觉表现、播放稳定性和本地隐私。

## 核心特性

- 天气电台：基于高德 IP 定位城市与天气状态组织播放体验。
- 网易云搜索与播放：登录网易云音乐账号，搜索单曲、播放歌单、每日推荐与最近播放。
- 歌词舞台：歌词同步滚动、沉浸式样式与播放态联动。
- 沉浸式视觉：Three.js 粒子线条、音乐可视化、天气、视频四类背景主题。
- 桌面能力：无边框窗口控制、系统集成、系统托盘（最小化到托盘 / 退出应用）。
- 网易云桥接：通过隐藏 WebView2 窗口在同源上下文发起网易云接口请求，Cookie 由 WebView2 跨窗口共享与持久化（含 HttpOnly 的 `MUSIC_U`）。

## 技术栈

- Tauri 2、Rust、WebView2
- pnpm
- Vite、TypeScript、Vue 3、Vue Router、Pinia、pinia-plugin-persistedstate、Vue I18n
- Tailwind CSS v4、Sass、reka-ui
- Three.js（WebGL 粒子 / 音乐可视化）
- @amap/amap-jsapi-loader（高德天气 / 定位）、@tauri-apps/plugin-geolocation
- 系统托盘（Tauri `tray-icon` feature）

## 本地开发

准备环境：

- Windows 10/11
- Windows WebView2 Runtime
- pnpm
- Rust stable
- Tauri 2 CLI

开发前提：

- 前往Tauri官网查看前置要求，根据前置要求配置环境后再进行下面步骤。

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
pnpm lint            # ESLint 检查
pnpm lint:fix        # ESLint 自动修复
pnpm build           # vue-tsc 类型检查 + Vite 构建
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

当前模块声明的脚本以 `package.json` 为准。

## 安装正式版

正式安装包只从本仓库的 [GitHub Releases](https://github.com/Tangkoom/Particle-Mineradio) 获取。Windows 可能显示 SmartScreen 提示；请先确认下载页面和安装包来源确实是上述官方仓库，再按系统提示手动确认运行。不要为安装本应用关闭 Defender 或 SmartScreen。

## 项目结构

```text
Particle-Mineradio/
├─ public/                 # 应用图标等静态资源
│  ├─ icon.ico
│  └─ icon.png
├─ src/
│  ├─ main.ts              # Vue 桌面应用入口
│  ├─ App.vue
│  ├─ api/                 # 接口封装
│  ├─ assets/              # 字体、视频等资源
│  │  ├─ font/
│  │  └─ video/
│  ├─ components/          # 通用组件（如 ComDialog）
│  ├─ layouts/             # 布局模块
│  │  ├─ header/           # 顶栏：登录、搜索、设置、窗口控制
│  │  ├─ nav-music/        # 歌单 / 歌曲列表
│  │  ├─ bottom-bar/       # 底部播放控制条
│  │  └─ three-bg/         # Three.js 沉浸式视觉背景
│  ├─ pages/               # 路由页面
│  ├─ router/              # Vue Router 配置
│  ├─ stores/              # Pinia 状态（user、player）
│  ├─ styles/              # 全局样式
│  ├─ types/               # 自动生成的类型声明
│  └─ utils/               # 工具：高德、网易云、窗口创建、请求
├─ src-tauri/
│  ├─ Cargo.toml           # Rust 依赖
│  ├─ tauri.conf.json      # Tauri 配置
│  ├─ capabilities/        # 权限能力声明
│  ├─ icons/               # 应用图标资源
│  └─ src/
│     ├─ main.rs           # Tauri 桌面应用入口
│     └─ lib.rs            # Rust 命令、托盘、插件注册
└─ README.md
```

## 开发原则

- Vue 负责界面状态和用户操作。
- Tauri / Rust 负责窗口、系统能力、系统托盘与进程退出。
- 网易云接口通过隐藏桥接窗口在同源上下文请求，Cookie 由 WebView2 跨窗口共享与持久化。
- 用户 Cookie、Token、日志和本地隐私数据不得进入仓库。

## 第三方音乐平台说明

- Particle-Mineradio 是一个非官方的音乐播放器，与网易云音乐无关。
- Particle-Mineradio 不是网易云音乐的官方客户端，也不隶属于任何音乐平台。

项目中的第三方平台接入仅用于个人学习、本地客户端体验和用户自有账号的播放辅助。请遵守对应平台的用户协议、版权规则和会员权益规则。项目不会提供绕过付费、绕过会员、破解音质或重新分发音乐内容的能力。

## 用户数据与隐私

登录 Cookie、搜索历史、自定义封面、自定义歌词、节奏分析缓存和诊断日志等数据应保存在本机应用数据目录或本地存储中。

提交 Issue、PR、日志或截图前，请确认没有包含 Cookie、Token、账号信息、私密链接、本地隐私路径或可识别个人身份的信息。

## 参与贡献

欢迎提交 Issue、PR、测试反馈和文档改进。

## 致谢

Particle-Mineradio 由 XxHuberrr 的 Mineradio 灵感二创开发，源项目见 [GitHub](https://github.com/XxHuberrr/Mineradio)。

## 版权与授权

Copyright (C) 2026 XxHuberrr.

本项目原创核心代码采用 GPL-3.0-only 授权。Particle-Mineradio 名称、界面视觉设计与原创视觉表达归作者所有；第三方依赖和第三方服务分别遵循其各自授权与服务条款。
