import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { extractFile, listPackage } from "@electron/asar";

if (process.platform !== "linux" || process.arch !== "x64")
  throw Error("Linux verification requires Linux x64");
const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const args = process.argv.slice(2);
const noSandbox = args.includes("--ci-no-sandbox");
assert(!noSandbox || process.env.CI === "true", "Sandbox bypass is CI-only");
const destinations = args.filter((arg) => arg !== "--ci-no-sandbox");
assert(destinations.length <= 1 && !destinations[0]?.startsWith("--"));
const output = path.resolve(
  destinations[0] || path.join(root, "dist", `linux-${pkg.version}`),
);
const stem = path.join(output, `iBMSC-${pkg.version}-linux-x64`);
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "ibmsc-linux-verify-"));

async function verifyApp(appDir, desktopFile, executable, label) {
  const archive = path.join(appDir, "resources/app.asar");
  for (const file of [
    "electron/main.cjs",
    "electron/preload.cjs",
    "src/app.js",
    "index.html",
    "assets/app/ibmsc.png",
    "CREDITS.md",
    "UPSTREAM-README.md",
    "THIRD_PARTY_NOTICES.md",
  ])
    assert.deepEqual(
      extractFile(archive, file),
      await fs.readFile(path.join(root, file)),
      `${label}: ${file}`,
    );
  const metadata = JSON.parse(extractFile(archive, "package.json"));
  assert.equal(metadata.version, pkg.version);
  assert.equal(metadata.main, pkg.main);
  for (const dependency of ["iconv-lite", "safer-buffer"])
    assert(extractFile(archive, `node_modules/${dependency}/package.json`));
  const entries = listPackage(archive).map((file) =>
    file.replaceAll("\\", "/"),
  );
  assert(
    !entries.some((file) =>
      /^\/(?:test|scripts|\.github|node_modules\/(?:electron|electron-builder|prettier))(?:\/|$)/.test(
        file,
      ),
    ),
    `${label}: development files must not be bundled`,
  );
  for (const file of ["LICENSE.electron.txt", "LICENSES.chromium.html"])
    assert((await fs.stat(path.join(appDir, file))).size > 0, file);
  const desktop = await fs.readFile(desktopFile, "utf8");
  assert.match(desktop, /^Name=iBMSC$/m);
  assert.match(desktop, /^Icon=ibmsc$/m);
  assert.match(desktop, /^StartupWMClass=ibmsc$/m);
  assert.doesNotMatch(desktop, /--no-sandbox|--disable-setuid-sandbox/);
  execFileSync("desktop-file-validate", [desktopFile], { stdio: "inherit" });
  const launcher = await fs.readFile(path.join(appDir, "AppRun"), "utf8");
  assert.doesNotMatch(launcher, /--no-sandbox|--disable-setuid-sandbox/);

  const reportPath = path.join(scratch, `${label}-startup.json`);
  execFileSync(
    "xvfb-run",
    [
      "-a",
      executable,
      ...(noSandbox ? ["--no-sandbox"] : []),
      `--verify-package=${reportPath}`,
    ],
    { timeout: 45000, stdio: "inherit" },
  );
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  assert.equal(report.loaded, true);
  assert.deepEqual(report.errors, []);
  assert.equal(report.packaged, true);
  assert.equal(report.arch, "x64");
  assert.equal(report.version, pkg.version);
  console.log(JSON.stringify({ package: label, ...report }));
}

try {
  const appImage = `${stem}.AppImage`;
  assert((await fs.stat(appImage)).mode & 0o111, "AppImage must be executable");
  // Extract without FUSE so CI can inspect and launch the actual release payload.
  execFileSync(appImage, ["--appimage-extract"], {
    cwd: scratch,
    timeout: 90000,
    stdio: ["ignore", "ignore", "inherit"],
  });
  const appDir = path.join(scratch, "squashfs-root");
  await verifyApp(
    appDir,
    path.join(appDir, "ibmsc.desktop"),
    path.join(appDir, "AppRun"),
    "AppImage",
  );

  const deb = `${stem}.deb`;
  for (const [field, expected] of Object.entries({
    Package: "ibmsc",
    Version: pkg.version,
    Architecture: "amd64",
  }))
    assert.equal(
      execFileSync("dpkg-deb", ["--field", deb, field], {
        encoding: "utf8",
      }).trim(),
      expected,
    );
  const debRoot = path.join(scratch, "deb");
  execFileSync("dpkg-deb", ["--extract", deb, debRoot], { stdio: "inherit" });
  const installed = path.join(debRoot, "opt/iBMSC");
  const desktopFile = path.join(
    debRoot,
    "usr/share/applications/ibmsc.desktop",
  );
  assert.match(
    await fs.readFile(desktopFile, "utf8"),
    /^Exec=\/opt\/iBMSC\/ibmsc(?:\s|$)/m,
  );
  assert(
    (
      await fs.stat(
        path.join(debRoot, "usr/share/icons/hicolor/256x256/apps/ibmsc.png"),
      )
    ).size > 0,
  );
  await verifyApp(installed, desktopFile, path.join(installed, "ibmsc"), "deb");
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
}
