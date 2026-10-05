import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
if (process.platform !== 'darwin') throw Error('macOS verification requires macOS');
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const dmg = path.resolve(`dist/iBMSC-${pkg.version}-mac-${process.arch}.dmg`);
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'ibmsc-dmg-verify-'));
const mount = path.join(scratch, 'mount');
await fs.mkdir(mount);
execFileSync('/usr/bin/hdiutil', ['verify', dmg], { stdio: 'inherit' });
execFileSync('/usr/bin/hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-mountpoint', mount], { stdio: 'inherit' });
try {
  const bundle = path.join(mount, 'iBMSC.app');
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
  const resources = path.join(bundle, 'Contents/Resources');
  for (const file of ['electron/main.cjs', 'src/app.js', 'index.html', 'CREDITS.md'])
    assert.deepEqual(await fs.readFile(path.join(resources, 'app', file)), await fs.readFile(file));
  const ico = await fs.readFile('assets/app/ibmsc.ico');
  const png = ico.subarray(ico.readUInt32LE(18), ico.readUInt32LE(18) + ico.readUInt32LE(14));
  assert.deepEqual((await fs.readFile(path.join(resources, 'iBMSC.icns'))).subarray(16), png);
  const reportPath = path.join(scratch, 'startup.json');
  execFileSync(path.join(bundle, 'Contents/MacOS/iBMSC'), [`--verify-package=${reportPath}`], { timeout: 45000, stdio: 'inherit' });
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  assert.equal(report.loaded, true);
  assert.deepEqual(report.errors, []);
  assert.equal(report.packaged, true);
  assert.equal(report.arch, process.arch);
  assert.equal(report.version, pkg.version);
  console.log(JSON.stringify(report));
} finally {
  execFileSync('/usr/bin/hdiutil', ['detach', mount], { stdio: 'inherit' });
}
