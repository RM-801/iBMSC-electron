import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'win32') throw Error('Windows packaging requires Windows');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.resolve(process.argv[2] || path.join(root, 'dist', `iBMSC-${pkg.version}-win-${process.arch}`));
// Refuse an existing destination rather than deleting any previous package.
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output, { recursive: false });
await fs.cp(path.join(root, 'node_modules/electron/dist'), output, { recursive: true });
await fs.rename(path.join(output, 'electron.exe'), path.join(output, 'iBMSC.exe'));
await fs.rm(path.join(output, 'resources/default_app.asar'), { force: true });
const appRoot = path.join(output, 'resources/app');
await fs.mkdir(appRoot, { recursive: true });
for (const name of ['index.html', 'src', 'assets', 'electron', 'README.md', 'CREDITS.md', 'UPSTREAM-README.md', 'THIRD_PARTY_NOTICES.md']) {
  await fs.cp(path.join(root, name), path.join(appRoot, name), { recursive: true });
}
await fs.writeFile(path.join(appRoot, 'package.json'), JSON.stringify({
  name: pkg.name, productName: 'iBMSC', version: pkg.version, type: 'module', main: pkg.main,
}, null, 2));
const copied = new Set();
async function dependency(name) {
  if (copied.has(name)) return;
  copied.add(name);
  const source = path.join(root, 'node_modules', name);
  await fs.cp(source, path.join(appRoot, 'node_modules', name), { recursive: true });
  const info = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'));
  for (const child of Object.keys(info.dependencies || {})) await dependency(child);
}
for (const name of Object.keys(pkg.dependencies || {})) await dependency(name);
await fs.copyFile(path.join(root, 'docs/TODO.md'), path.join(output, 'TODO.md'));
await fs.copyFile(path.join(root, 'CREDITS.md'), path.join(output, 'CREDITS.md'));
await fs.writeFile(path.join(output, '使用说明.txt'), `iBMSC ${pkg.version} Windows ${process.arch} 测试包\r\n\r\n解压整个文件夹后双击 iBMSC.exe。无需安装 Node.js。请勿单独移动 EXE，需保留全部配套文件。\r\n通过“打开”选择已解压的谱面，自动读取谱面目录内音源。\r\n这是开发测试版，未签名；尚未完成原版全部功能与音频、播放器互操作验收。建议先用谱面副本测试。\r\n本包供本项目验收使用，保留上游致谢与许可证资料。\r\n`);
console.log(output);
