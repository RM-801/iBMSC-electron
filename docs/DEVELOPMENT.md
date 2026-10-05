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

Beta 1 的 Windows 测试为 268/270 通过，两项符号链接测试受 EPERM 权限限制；macOS arm64/x64 均为 270/270 通过。自动测试不替代 [实际验收](ACCEPTANCE.md)。

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

产物位于 `dist/`。脚本拒绝覆盖已有输出目录；Windows 安装版和便携版可通过 `-- <新输出目录>` 指定其他目录。

[macOS Beta 工作流](../.github/workflows/macos-beta.yml) 在 Apple Silicon 和 Intel runner 上运行测试、构建、DMG 校验、签名完整性与挂载启动检查，全部通过后上传到指定 Beta Release。当前工作流目标固定为 `v0.1.38-beta.1`；发布其他版本前需更新目标，且不会覆盖已有附件。

Windows 包未签名；macOS 包使用 ad-hoc 签名，未进行 Developer ID 签名或公证。自动更新和 Linux 成品尚未提供。

## 网页部署

[GitHub Pages](https://rm-801.github.io/iBMSC-electron/) 提供在线编辑器。`node scripts/package-web.mjs` 将页面、src、assets 和来源声明复制到 `dist/web`；不需要 Node.js 服务端。Pages 工作流在 main 的网页相关文件变更或手动触发时部署。
