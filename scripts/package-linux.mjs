import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, Platform, Arch } from "electron-builder";

if (process.platform !== "linux" || process.arch !== "x64")
  throw Error("Linux packaging requires Linux x64");
const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const output = path.resolve(
  process.argv[2] || path.join(root, "dist", `linux-${pkg.version}`),
);
// Refuse an existing destination so a published package is never overwritten.
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output);

const artifacts = await build({
  projectDir: root,
  targets: Platform.LINUX.createTarget(["AppImage", "deb"], Arch.x64),
  publish: "never",
  config: {
    appId: "org.ibmsc.node",
    productName: "iBMSC",
    extraMetadata: {
      productName: "iBMSC",
      desktopName: "ibmsc.desktop",
      description: "A cross-platform BMS chart editor built with Electron",
      homepage: "https://github.com/RM-801/iBMSC-electron",
      author: "SeaRay",
    },
    directories: { output },
    electronDist: path.join(root, "node_modules/electron/dist"),
    electronVersion: pkg.devDependencies.electron,
    npmRebuild: false,
    asar: true,
    files: [
      "index.html",
      "src/**/*",
      "assets/**/*",
      "electron/**/*",
      "!electron/native/**/*",
      "README.md",
      "CREDITS.md",
      "UPSTREAM-README.md",
      "THIRD_PARTY_NOTICES.md",
    ],
    linux: {
      executableName: "ibmsc",
      icon: path.join(root, "assets/app/ibmsc.png"),
      category: "AudioVideo;Audio;",
      maintainer: "SeaRay <andylaw5@live.com>",
      vendor: "SeaRay",
      syncDesktopName: true,
      // electron-builder's legacy AppImage target otherwise adds --no-sandbox.
      executableArgs: [],
      artifactName: "iBMSC-${version}-linux-x64.${ext}",
    },
    deb: {
      packageName: "ibmsc",
      // Sound and graphics libraries are required by the Electron executable.
      depends: [
        "libgtk-3-0",
        "libnotify4",
        "libnss3",
        "libxss1",
        "libxtst6",
        "xdg-utils",
        "libatspi2.0-0",
        "libuuid1",
        "libsecret-1-0",
        "libasound2",
        "libgbm1",
      ],
      recommends: [],
    },
    afterPack: async ({ appOutDir }) => {
      // The AppImage stage copies appOutDir over its generated launcher. Supply
      // one that leaves Chromium's sandbox enabled even when userns is blocked.
      // The .deb desktop entry launches ibmsc directly and does not use AppRun.
      await fs.writeFile(
        path.join(appOutDir, "AppRun"),
        "#!/usr/bin/env bash\nset -e\n" +
          'APPDIR="${APPDIR:-$(dirname "$(readlink -f "$0")")}"\n' +
          'export LD_LIBRARY_PATH="$APPDIR/usr/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"\n' +
          'exec "$APPDIR/ibmsc" "$@"\n',
        { mode: 0o755 },
      );
    },
  },
});
console.log(artifacts.join("\n"));
