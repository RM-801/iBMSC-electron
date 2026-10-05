import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'darwin') throw Error('macOS packaging requires macOS');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const arch = process.arch;
const output = path.join(root, 'dist', `iBMSC-${pkg.version}-mac-${arch}`);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output);
const bundle = path.join(output, 'iBMSC.app');
await fs.rm(bundle, { recursive: true, force: true });
await fs.cp(path.join(root, 'node_modules/electron/dist/Electron.app'), bundle, { recursive: true, verbatimSymlinks: true });
const resources = path.join(bundle, 'Contents/Resources');
await fs.rm(path.join(resources, 'default_app.asar'), { force: true });
const appRoot = path.join(resources, 'app');
await fs.mkdir(appRoot, { recursive: true });
for (const name of ['index.html', 'src', 'assets', 'electron', 'README.md', 'CREDITS.md', 'UPSTREAM-README.md', 'THIRD_PARTY_NOTICES.md'])
  await fs.cp(path.join(root, name), path.join(appRoot, name), { recursive: true });
await fs.writeFile(path.join(appRoot, 'package.json'), JSON.stringify({
  name: pkg.name, productName: 'iBMSC', version: pkg.version,
  type: 'module', main: pkg.main,
}, null, 2));
// Copy only runtime dependencies; keep node_modules and test tools out of the app.
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
for (const name of ['LICENSE', 'LICENSES.chromium.html'])
  await fs.copyFile(path.join(root, 'node_modules/electron/dist', name), path.join(resources, name));
await fs.rename(path.join(bundle, 'Contents/MacOS/Electron'), path.join(bundle, 'Contents/MacOS/iBMSC'));
// Preserve the upstream 256px PNG exactly inside the macOS icon container.
const ico = await fs.readFile(path.join(root, 'assets/app/ibmsc.ico'));
const offset = ico.readUInt32LE(18), length = ico.readUInt32LE(14);
const png = ico.subarray(offset, offset + length);
if (ico[6] !== 0 || ico[7] !== 0 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
  throw Error('Expected upstream 256px PNG icon');
const icns = Buffer.alloc(16 + png.length);
icns.write('icns', 0); icns.writeUInt32BE(icns.length, 4);
icns.write('ic08', 8); icns.writeUInt32BE(png.length + 8, 12); png.copy(icns, 16);
await fs.writeFile(path.join(resources, 'iBMSC.icns'), icns);
const plist = path.join(bundle, 'Contents/Info.plist');
for (const [key, value] of Object.entries({ CFBundleName: 'iBMSC', CFBundleDisplayName: 'iBMSC',
  CFBundleIdentifier: 'local.ibmsc.node', CFBundleExecutable: 'iBMSC', CFBundleShortVersionString: pkg.version,
  CFBundleVersion: pkg.version, CFBundleIconFile: 'iBMSC.icns', NSHumanReadableCopyright: 'Original iBMSC: iBMS / iBMS.[4th Age]. Port maintained by SeaRay.' })) {
  try { execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], { stdio: 'pipe' }); }
  catch { execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist]); }
}
execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
const notes = `iBMSC ${pkg.version} — macOS ${arch} 测试包\n\n将 iBMSC.app 拖入 Applications（应用程序）。包内自带 Electron 和 Node 运行环境，无需单独安装。\n打开应用后，通过“打开”选择已解压的谱面，自动读取该谱面目录内的音源（包括 sound 子文件夹）。\n\n本包采用本地临时签名，未进行 Apple Developer ID 签名或公证。若 macOS 阻止打开，可在“系统设置 → 隐私与安全性”中针对该应用选择“仍要打开”；不要关闭系统全局安全保护。\n\n开发中，尚非完整复刻交付版本。支持 BASE16/36/62 BMS；BASE62 区分大小写。非 BASE36 可保存为 BMS 或 .ibmscx 移植版工程，原版 .IBMSC 导出不支持。MyO2 工具箱已接入。内置预览播放音频，不渲染 BGA。建议使用谱面副本验收保存/重开及播放。\n完整功能边界和来源说明见发布页及随包 CREDITS.md；本项目不对上游代码或资源另行授予许可证。\n`;
await fs.writeFile(path.join(output, '安装与已知限制.txt'), notes);
await fs.copyFile(path.join(root, 'CREDITS.md'), path.join(output, 'CREDITS.md'));
await fs.copyFile(path.join(root, 'docs/TODO.md'), path.join(output, 'TODO.md'));
try { await fs.symlink('/Applications', path.join(output, 'Applications')); } catch (e) { if (e.code !== 'EEXIST') throw e; }
const dmg = `${output}.dmg`;
execFileSync('/usr/bin/hdiutil', ['create', '-volname', 'iBMSC', '-srcfolder', output, '-format', 'UDZO', dmg], { stdio: 'inherit' });
execFileSync('/usr/bin/hdiutil', ['verify', dmg], { stdio: 'inherit' });
execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', bundle, `${output}.zip`], { stdio: 'inherit' });
console.log(JSON.stringify({ bundle, dmg, zip: `${output}.zip` }, null, 2));
