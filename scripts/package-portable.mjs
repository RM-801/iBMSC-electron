import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, Platform, Arch } from "electron-builder";

if (process.platform !== "win32")
  throw Error("Windows packaging requires Windows");
const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const output = path.resolve(
  process.argv[2] || path.join(root, "dist", `portable-${pkg.version}`),
);
// Never overwrite a released artifact or delete an existing directory.
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(output);

const artifacts = await build({
  projectDir: root,
  targets: Platform.WINDOWS.createTarget("portable", Arch.x64),
  publish: "never",
  config: {
    appId: "org.ibmsc.node",
    productName: "iBMSC",
    extraMetadata: { productName: "iBMSC" },
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
      "README.md",
      "CREDITS.md",
      "UPSTREAM-README.md",
      "THIRD_PARTY_NOTICES.md",
    ],
    win: { signAndEditExecutable: false },
    portable: {
      artifactName: "iBMSC-${version}-portable-${arch}.${ext}",
      requestExecutionLevel: "user",
      // Each launch extracts to its own temporary directory, then cleans it up.
      unpackDirName: false,
    },
  },
});
console.log(artifacts.join("\n"));
