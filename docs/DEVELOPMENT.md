# 开发与构建

用户下载与使用说明见 [README](../README.md)。当前进展与验收证据见 [STATUS](STATUS.md)，开发历史见 [HANDOFF](HANDOFF.md)，未完成工作见 [TODO](TODO.md)。

## 准备环境

需要 Node.js 22.12 或更高版本及 npm。Electron 运行时需单独安装：

```sh
git clone https://github.com/RM-801/iBMSC-electron.git
cd iBMSC-electron
npm ci
npx --no-install install-electron
```

## 运行与检查

```sh
npm start
```

启动本地网页版：

```sh
npm run dev
```

访问 <http://127.0.0.1:4173>。浏览器文件访问与保存受权限限制，与桌面原生文件操作有所不同。

```sh
npm run check
npm test
```

Beta 2 的 Windows 测试为 298/300 通过，两项符号链接测试受 EPERM 权限限制；macOS arm64/x64 与 Linux x64 均为 300/300 通过。各平台包内程序启动校验通过；自动测试不替代 [实际验收](ACCEPTANCE.md)。

## 打包

在 Windows 上：

```sh
npm run package:win:installer
npm run package:win:portable
```

在 macOS 上（按当前 Node.js 架构构建）：

```sh
npm run package:mac
node scripts/verify-macos.mjs
```

在 Linux x64 上：

```sh
npm run package:linux
node scripts/verify-linux.mjs
```

Linux 验证需要 `xvfb`、`desktop-file-utils` 和 `dpkg-deb`，以及 Electron 所需的 GTK、NSS、ALSA、GBM 等系统库。AppImage 与 DEB 输出至 `dist/linux-<版本>/`。

产物位于 `dist/`。脚本拒绝覆盖已有输出目录；Windows 安装版、便携版和 Linux 包可通过 `-- <新输出目录>` 指定其他目录。

[macOS Beta 工作流](../.github/workflows/macos-beta.yml) 在 Apple Silicon 和 Intel runner 上运行测试、构建、DMG 内容与签名校验、挂载启动检查。[Linux Beta 工作流](../.github/workflows/linux-beta.yml) 在 Ubuntu 22.04 x64 上运行测试、构建 AppImage/DEB，并验证包内容和启动。

两者由 `release_tag` 指定已创建的草稿 Beta 标签，源码从该标签检出并核对版本；全部通过后将附件上传至草稿，不覆盖已有附件。最终核对各平台产物和校验和后再公开 Release。

Windows 包未签名；macOS 包使用 ad-hoc 签名，未进行 Developer ID 签名或公证。自动更新尚未接入。Linux 发行版兼容性和各平台实际声音输出仍需实机验收。

## 网页部署

[GitHub Pages](https://rm-801.github.io/iBMSC-electron/) 提供在线编辑器。`node scripts/package-web.mjs` 将页面、src、assets 和来源声明复制到 `dist/web`；不需要 Node.js 服务端。Pages 工作流在 main 的网页相关文件变更或手动触发时部署。
