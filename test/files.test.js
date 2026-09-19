import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import files from "../electron/files.cjs";
test("asset reading confines both relative paths and symlinks to chart directory", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ibmsc-files-"));
  try {
    const root = path.join(dir, "chart");
    await fs.mkdir(root);
    await fs.writeFile(path.join(root, "sound.wav"), "sound");
    await fs.writeFile(path.join(dir, "outside"), "secret");
    assert.equal(
      new TextDecoder().decode(await files.readAsset(root, "sound.wav")),
      "sound",
    );
    await assert.rejects(files.readAsset(root, "../outside"));
    await fs.symlink(path.join(dir, "outside"), path.join(root, "link"));
    await assert.rejects(files.readAsset(root, "link"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("atomic save replaces target and leaves no temporary files", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ibmsc-save-"));
  try {
    const file = path.join(dir, "test.bms");
    await files.atomicWrite(file, Buffer.from("old"));
    await files.atomicWrite(file, Buffer.from("new"));
    assert.equal(await fs.readFile(file, "utf8"), "new");
    assert.deepEqual(await fs.readdir(dir), ["test.bms"]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("chart-relative sound subfolders load directly and same names stay in their own folders", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ibmsc-sound-"));
  try {
    await fs.mkdir(path.join(root, "sound"));
    await fs.writeFile(path.join(root, "kick.wav"), "root sample");
    await fs.writeFile(path.join(root, "sound", "kick.wav"), "nested sample");
    await fs.writeFile(path.join(root, "sound", "音源.ogg"), "unicode sample");
    assert.equal(
      new TextDecoder().decode(await files.readAsset(root, "sound\\kick.wav")),
      "nested sample",
    );
    assert.equal(
      new TextDecoder().decode(await files.readAsset(root, "kick.wav")),
      "root sample",
    );
    assert.equal(
      new TextDecoder().decode(await files.readAsset(root, "sound/音源.ogg")),
      "unicode sample",
    );
    await assert.rejects(files.readAsset(root, "sound/missing.wav"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("sound resolution supports case and WAV/OGG replacement without confusing subfolders", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ibmsc-fallback-"));
  try {
    await fs.mkdir(path.join(root, "Sound"));
    await fs.writeFile(path.join(root, "Sound", "Kick.OGG"), "compressed");
    await fs.writeFile(path.join(root, "Kick.wav"), "different");
    assert.equal(
      new TextDecoder().decode(await files.readAsset(root, "sound\\kick.wav")),
      "compressed",
    );
    await fs.writeFile(path.join(root, "Sound", "Kick.wav"), "exact");
    assert.equal(
      new TextDecoder().decode(await files.readAsset(root, "Sound/Kick.wav")),
      "exact",
    );
    await assert.rejects(files.readAsset(root, "sound/missing.wav"));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("extension fallback and case-matched directory symlinks cannot escape chart root", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ibmsc-fallback-link-"));
  try {
    const root = path.join(dir, "chart");
    await fs.mkdir(root);
    await fs.writeFile(path.join(dir, "sound.ogg"), "outside");
    await fs.symlink(path.join(dir, "sound.ogg"), path.join(root, "SOUND.ogg"));
    await fs.symlink(dir, path.join(root, "Audio"));
    await assert.rejects(files.readAsset(root, "sound.wav"), /谱面目录/);
    await assert.rejects(files.readAsset(root, "audio/sound.wav"), /谱面目录/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
