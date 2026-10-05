# iBMSC

[English](README.md) · **简体中文** · [日本語](README.ja.md) · [한국어](README.ko.md)

基于 **Electron** 框架的免费跨平台 **BMS / PMS** 谱面编辑器，源代码公开。移植自 [iBMSC 3.0.5 Delta](https://github.com/aqtq314/iBMSC)，由 **SeaRay** 维护。

- 支持 SINGLE、DOUBLE 和 PMS 九键谱面。
- 提供 NT / BMSE 输入、长音符编辑和内置音频预览。
- 支持查找替换、统计、MyO2 工具及自定义皮肤。
- 界面提供英语、简体中文、日语和韩语。

## 下载

[在线使用](https://rm-801.github.io/iBMSC-electron/) · 直接在浏览器中打开；加载音源时需选择对应文件或文件夹。

当前版本：[Beta 1 · 0.1.38](https://github.com/RM-801/iBMSC-electron/releases/tag/v0.1.38-beta.1)

| 版本 | 使用方式 |
| --- | --- |
| [Windows x64 安装版](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-setup-x64.exe) | 运行安装程序。 |
| [Windows x64 便携版](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-portable-x64.exe) | 无需安装，双击运行。 |
| [macOS Apple Silicon](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-mac-arm64.dmg) | M 系列 Mac；打开 DMG，将应用拖入 Applications。 |
| [macOS Intel](https://github.com/RM-801/iBMSC-electron/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-mac-x64.dmg) | Intel Mac；打开 DMG，将应用拖入 Applications。 |

无需安装 Node.js。更新需手动下载新版本；Linux 安装包暂未提供。Windows 包未签名，macOS 包未经过 Apple 公证。

## 开始使用

网页版首次使用时跟随浏览器语言，未支持的语言回退到英文，并记住手动选择。桌面版将在下一版本支持跟随系统语言。

1. 打开已解压的谱面，保留谱面目录及子目录中的音源，程序会按 WAV 定义关联。
2. **F2 / F3** 切换选择 / 写入工具，**F5 / F7** 播放 / 停止，**Ctrl＋滚轮** 缩放编辑区。
3. 保存默认使用 **UTF-8**；兼容 LR2 等旧播放器时可选择 **Shift-JIS**。PMS 自动使用 Pomu 九键皮肤，默认保存为 `.pms`。

## Beta 注意事项

- 请先用谱面副本测试。部分原版功能和旧工程兼容仍在完善中。
- 暂不支持 `LNTYPE 2`；内置预览不显示 BGA 图片 / 视频；条件分支只保留原文，不展开执行。
- GBK 谱面需显式选择读取编码，不能保证自动识别。

[完整发布说明](docs/releases/v0.1.38-beta.1.md) · [反馈问题](https://github.com/RM-801/iBMSC-electron/issues)（请附版本、系统和复现步骤）

原作：**iBMS / iBMS.[4th Age]**。本项目为后续维护分支。[原作与贡献者、授权说明](CREDITS.md) · [第三方声明](THIRD_PARTY_NOTICES.md) · [开发文档](docs/DEVELOPMENT.md)
