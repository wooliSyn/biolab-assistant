# BioLab 安卓版构建环境搭建清单（P1 前置）

> 适用机器：当前 Windows 开发机 | 目标：能 `npx tauri android build` 出 APK
> 现状探测（2026-07-28）：仅有 Java 8，无 Android SDK/NDK、无 cargo-ndk、无 Rust 安卓 target。

Tauri v2 安卓构建需要下面这套工具链。按顺序装，预计下载 3-5 GB、耗时 1-2 小时（视网速）。

---

## 第 1 步：JDK 17（必须，当前是 Java 8 太旧）

Tauri 安卓要求 JDK 17。

1. 下载 Microsoft Build of OpenJDK 17 或 Temurin 17（Windows x64 .msi）：
   - https://learn.microsoft.com/java/openjdk/download （选 17 LTS, Windows x64 msi）
2. 安装时勾选"Set JAVA_HOME"。
3. 验证：新开终端 `java -version` 应显示 17。
4. 设置环境变量（若安装器没设）：
   ```
   JAVA_HOME = C:\Program Files\Microsoft\jdk-17.x.x-hotspot
   ```

> 注意：保留 Java 8 无妨，但 JAVA_HOME 必须指向 17。

---

## 第 2 步：Android Studio（提供 SDK/NDK 管理器）

1. 下载：https://developer.android.com/studio （Windows .exe）
2. 安装，首次启动走 Setup Wizard，会自动装 Android SDK。
3. 记住 SDK 路径，默认：
   ```
   C:\Users\Wan\AppData\Local\Android\Sdk
   ```

---

## 第 3 步：用 SDK Manager 装齐组件

打开 Android Studio → More Actions → SDK Manager：

**SDK Platforms 选项卡**：勾选 Android 14 (API 34) 或更高。

**SDK Tools 选项卡**（勾选"Show Package Details"看版本）：
- Android SDK Build-Tools（最新）
- Android SDK Platform-Tools（含 adb）
- Android SDK Command-line Tools (latest)
- **NDK (Side by side)**：Tauri v2 当前要求 **NDK 25.x 或 26.x**，勾选其一（推荐 26.x）
- CMake（可选）

装完点 Apply 等待下载。

---

## 第 4 步：Rust 安卓 target

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

验证：`rustup target list --installed | findstr android` 应列出 4 个。

---

## 第 5 步：cargo-ndk

```bash
cargo install cargo-ndk
```

---

## 第 6 步：环境变量（系统级，永久生效）

```
JAVA_HOME      = C:\Program Files\Microsoft\jdk-17.x.x-hotspot
ANDROID_HOME   = C:\Users\Wan\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT = %ANDROID_HOME%
NDK_HOME       = %ANDROID_HOME%\ndk\26.x.x   （填实际 NDK 版本目录）
```

并把下面两项加入 PATH：
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

设完**重启终端**（或重启电脑）让变量生效。

验证（新终端）：
```bash
adb version          # 能输出版本
echo %ANDROID_HOME%  # 能输出路径
```

---

## 第 7 步：初始化安卓工程并构建

在 `biolab-desktop` 项目目录：

```bash
# 生成 gen/android 安卓工程（首次）
npx tauri android init

# 连接真机（开 USB 调试）或启动模拟器后，开发调试
npx tauri android dev

# 直接出 APK/AAB 安装包
npx tauri android build
```

产物位于：`src-tauri/gen/android/app/build/outputs/`（debug/release 的 apk）。

---

## 常见坑

| 问题 | 原因 / 解决 |
|------|------------|
| `JAVA_HOME is not set` 或指向 1.8 | JAVA_HOME 改指 JDK 17，重启终端 |
| NDK 版本报错 | Tauri 对 NDK 版本敏感，严格按其要求装 25.x/26.x |
| `adb` 找不到 | platform-tools 没进 PATH |
| 真机连不上 | 手机开"开发者选项 + USB 调试"，`adb devices` 能看到设备 |
| 首次 build 极慢 | Gradle 首次拉依赖，正常，后续快 |
| 模拟器卡顿 | 用 x86_64 镜像 + 开启 VT-x；或直接真机调试更省事 |

---

## 装好之后（回到开发）

工具链就绪后，P1 的实质工作：
1. `npx tauri android init` 生成工程
2. 在 `platform.js` 里把移动端的 TODO 桩替换为真实原生能力（本地通知、震动、文件）
3. 接 `tauri-plugin-notification`（移动端本地通知，后台计时核心）
4. 跑通"工具箱 + 计时 + 本地存储"最小闭环，验证后台通知能否按时响
