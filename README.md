# iBMSC

iBMSC 是面向 BMS / PMS 制谱的谱面编辑器。本项目基于 **iBMSC 3.0.5 Delta** 进行跨平台移植与后续维护，保留原版的名称、图标和轨道编辑方式，并改进缩放、菜单布局、编码选择与音频预览。

移植与维护：**SeaRay**。

**当前版本：[Beta 1 · 0.1.38](https://github.com/RM-801/ibmsc-node/releases/tag/v0.1.38-beta.1)**

[下载](#下载) · [主要功能](#主要功能) · [已知限制](#已知限制) · [问题反馈](https://github.com/RM-801/ibmsc-node/issues)

## 下载

| Windows x64 | 说明 |
| --- | --- |
| [安装版](https://github.com/RM-801/ibmsc-node/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-setup-x64.exe) | 可选择安装目录，创建桌面和开始菜单快捷方式。 |
| [便携版](https://github.com/RM-801/ibmsc-node/releases/download/v0.1.38-beta.1/iBMSC-0.1.38-portable-x64.exe) | 无需安装，双击 EXE 即可运行。 |

两种版本均自带运行环境，**无需安装 Node.js**。更新目前需要下载新版本，尚未接入自动更新。

[发布说明](docs/releases/v0.1.38-beta.1.md) · [SHA-256 校验文件](https://github.com/RM-801/ibmsc-node/releases/download/v0.1.38-beta.1/SHA256SUMS.txt) · [全部版本](https://github.com/RM-801/ibmsc-node/releases)

当前为 Beta 测试版，Windows 包尚未签名。建议先使用谱面副本，确认保存、重新打开及目标播放器播放符合预期。

## 开始使用

1. 安装或运行便携版，使用「文件 → 打开」选择已解压的谱面。
2. 将音源保留在谱面目录及其子目录中；桌面版会根据 WAV 定义自动关联音源。
3. 使用选择、写入工具编辑音符，通过内置预览或单击试听检查声音。
4. 保存时选择需要的格式和编码。默认使用 **UTF-8**；面向 LR2 等旧播放器时可选择 **Shift-JIS**。

文件头提供 **SINGLE、DOUBLE、PMS** 三种谱面类型。打开 PMS 会自动使用 Pomu 九键皮肤，并默认保存为 `.pms`。旧谱面的 Couple Play / Battle Play 文件头仍按兼容模式保留。

## 主要功能

- **谱面编辑**：选择、框选、写入、拖动、复制粘贴、镜像、撤销重做，以及小节插入、删除和变拍。
- **长音符**：NT / BMSE 输入方式、LNOBJ、长条整体选择及端点调整。
- **查找与检查**：按音符类型、小节、编号、数值和轨道查找替换；分别删除已选中音符或符合筛选条件的音符；统计与重叠检查。
- **视图**：动态 BGM 列、分屏与滚动同步，50–300% 整体缩放。Ctrl＋滚轮同时缩放音符、文字和格线。
- **音频预览**：从头或指定小节播放、BPM / STOP 时间轴、单音试听，以及 Microsoft ADPCM WAV 解码。不依赖外部播放器。
- **皮肤与语言**：默认 IIDX，提供 Pomu 等预设与自定义皮肤编辑；支持简体中文、日语、英语和韩语。
- **保存与恢复**：UTF-8 / Shift-JIS 导出、独立 `.ibmscx` 工程，以及可调整间隔的自动恢复副本。
- **MyO2 工具**：恒速化、64 线检查与 64 / 48 线调整。

### 常用快捷键

| 快捷键 | 操作 |
| --- | --- |
| Ctrl＋S / Ctrl＋Shift＋S | 保存 / 另存为 |
| Ctrl＋Z / Ctrl＋Y | 撤销 / 重做 |
| Ctrl＋F | 查找 / 删除 / 替换 |
| Ctrl＋T | 统计 |
| F1 / F2 / F3 | 时间选择 / 选择 / 写入工具 |
| F5 / F6 / F7 | 从头播放 / 从指定小节播放 / 停止 |
| F8 | 切换 NT / BMSE |
| Ctrl＋滚轮 | 整体缩放编辑区 |
| F10 | 打开视图菜单 |

## 平台支持

| 平台 | 当前状态 |
| --- | --- |
| Windows x64 | 已发布安装版和便携版，通过打包启动检查。 |
| 浏览器 | 可从源码本地运行；已检查基本界面、菜单、缩放和语言切换。在线试用站尚未部署。 |
| macOS | 已有打包脚本和早期构建记录；当前 Beta 尚未完成验收，暂不提供成品。 |
| Linux | 尚未完成打包与平台验收。 |

## 已知限制

- 尚未完成原版全部功能与交互的逐项对照，尤其是时间选择工具的部分行为、旧工程兼容及完整制谱流程。
- 条件分支保留原文，但不展开执行；暂不支持 `LNTYPE 2`。
- BGA 事件可编辑，内置播放器尚不渲染 BGA 图片或视频。
- 自动编码识别尝试 UTF-8 / Shift-JIS；GBK 需显式选择。不能用所选编码表示的字符会阻止保存，避免静默替换。
- 原版 `.ibmsc` 工程不能保存独立 PMS 模式；需要保留该模式时请使用 `.pms` 或 `.ibmscx`。早期文本工程及原版撤销历史尚未恢复。
- 音源格式兼容、长曲性能、文件关联和实际播放器互操作仍需更多样本验收。

Beta 1 发布前共运行 270 项自动测试，268 项通过；两项 Windows 符号链接测试因 `EPERM` 未完成。自动测试与启动检查不代表所有功能均已验收。

详细状态见 [进展与原版差异](docs/STATUS.md) 和 [验收清单](docs/ACCEPTANCE.md)。

## 从源码运行

需要 **Node.js 22 或更高版本**及 npm。

```sh
git clone https://github.com/RM-801/ibmsc-node.git
cd ibmsc-node
npm ci
```

启动桌面版：

```sh
npm start
```

启动本地网页版：

```sh
npm run dev
```

随后访问 <http://127.0.0.1:4173>。浏览器中的文件访问和保存受浏览器权限约束，与桌面版的原生文件操作有所不同。

检查代码与运行测试：

```sh
npm run check
npm test
```

在 Windows 上构建安装版或便携版：

```sh
npm run package:win:installer
npm run package:win:portable
```

产物位于 `dist/`。构建脚本不会覆盖已有输出目录；重复构建时可通过 `-- <新输出目录>` 指定目录。

## 反馈与参与

欢迎通过 [Issues](https://github.com/RM-801/ibmsc-node/issues) 报告问题或提出建议。请提供版本、操作系统、复现步骤，以及实际结果与预期结果；有需要时附截图或可公开分享的最小谱面样本。

开发资料：[当前进展](docs/STATUS.md) · [待办](docs/TODO.md) · [验收](docs/ACCEPTANCE.md) · [开发交接](docs/HANDOFF.md)

## 原作与致谢

原作：**iBMS / iBMS.[4th Age]**。上游项目：[aqtq314/iBMSC](https://github.com/aqtq314/iBMSC)。本项目是后续移植与维护分支，不代表原作者发布的官方版本。

保留原版图标及贡献者署名，完整名单见 [CREDITS.md](CREDITS.md)；上游原文见 [UPSTREAM-README.md](UPSTREAM-README.md)，依赖来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

当前参考的上游快照未发现明确许可证。本项目没有对上游代码或资源另行授予许可证，公开仓库不意味着这些内容获得了新的使用授权。
