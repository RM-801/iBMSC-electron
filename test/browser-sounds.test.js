import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBrowserSoundFiles } from "../src/browser-sounds.js";

const file = (webkitRelativePath) => ({
  name: webkitRelativePath.split("/").at(-1),
  webkitRelativePath,
});
const resolve = (files, name) => resolveBrowserSoundFiles(files, [name])[0];

test("folder loading keeps same-named sounds in their referenced directories", () => {
  const root = file("Song/kick.wav"),
    nested = file("Song/sound/kick.wav");
  const files = [root, nested, file("Song/cover.png"), file("Song/chart.bms")];
  assert.equal(resolve(files, "kick.wav").file, root);
  assert.equal(resolve(files, "sound\\kick.wav").file, nested);
  assert.deepEqual(resolve(files, "other/kick.wav"), {
    name: "other/kick.wav",
    error: "未找到音源文件",
  });
});

test("folder paths normalize case, slash direction, dot segments and Unicode", () => {
  const sound = file("Song/Sound/Cafe\u0301.WAV");
  assert.equal(resolve([sound], ".\\SOUND//temporary/../Café.wav").file, sound);
});

test("selecting the named sound subfolder or an ancestor keeps full references", () => {
  const subfolder = file("sound/drums/kick.wav");
  assert.equal(resolve([subfolder], "sound/drums/kick.wav").file, subfolder);
  assert.equal(
    resolve([subfolder], "assets/sound/drums/kick.wav").file,
    subfolder,
  );
  const parent = file("Collection/Song/sound/drums/kick.wav");
  assert.equal(resolve([parent], "sound/drums/kick.wav").file, parent);
  assert.equal(resolve([parent], "kick.wav").file, parent);
});

test("missing named directories never fall back to unrelated basenames", () => {
  const sound = file("Song/other/kick.wav");
  assert.equal(resolve([sound], "sound/kick.wav").error, "未找到音源文件");
  assert.equal(
    resolve([file("Song/kick.wav")], "sound/kick.wav").error,
    "未找到音源文件",
  );
  assert.equal(
    resolve([{ name: "kick.wav" }], "sound/kick.wav").error,
    "未找到音源文件",
  );
});

test("ambiguous parent-folder matches are reported instead of picking a song", () => {
  const files = [
    file("Collection/A/sound/kick.wav"),
    file("Collection/B/sound/kick.wav"),
  ];
  assert.equal(resolve(files, "sound/kick.wav").error, "音源路径存在歧义");
  assert.equal(resolve(files, "kick.wav").error, "音源路径存在歧义");
});

test("ambiguous case or Unicode normalization is not silently resolved", () => {
  assert.equal(
    resolve([file("Song/KICK.wav"), file("Song/kick.wav")], "kick.wav").error,
    "音源路径存在歧义",
  );
  assert.equal(
    resolve([file("Song/Café.wav"), file("Song/Cafe\u0301.wav")], "Café.wav")
      .error,
    "音源路径存在歧义",
  );
});

test("WAV/OGG/MP3 replacement follows native priority within the matching folder", () => {
  const ogg = file("Song/sound/kick.ogg"),
    mp3 = file("Song/sound/kick.mp3");
  const root = file("Song/kick.wav");
  assert.equal(resolve([root, mp3, ogg], "sound/kick.wav").file, ogg);
  const wav = file("Song/sound/kick.wav");
  assert.equal(resolve([ogg, wav], "sound/kick.wav").file, wav);
  assert.equal(resolve([ogg, wav], "sound/kick.ogg").file, ogg);
  assert.equal(resolve([wav], "sound/kick.flac").error, "未找到音源文件");
});

test("a direct path beats a same-named sound found elsewhere even with extension fallback", () => {
  const direct = file("Song/sound/kick.ogg");
  const elsewhere = file("Song/other/sound/kick.wav");
  assert.equal(resolve([elsewhere, direct], "sound/kick.wav").file, direct);
});

test("invalid or escaping references are rejected without affecting other sounds", () => {
  const files = [file("Song/kick.wav")];
  for (const name of [
    "",
    "../kick.wav",
    "sound/../../kick.wav",
    "/kick.wav",
    "C:\\kick.wav",
    "kick\0.wav",
  ])
    assert.equal(resolve(files, name).error, "无效音源路径");
  assert.equal(resolve(files, "kick.wav").file, files[0]);
});

test("only requested definitions are returned and repeated names are decoded once", () => {
  const sound = file("Song/kick.wav");
  const files = Object.freeze([Object.freeze(sound), file("Song/unused.wav")]);
  const names = Object.freeze(["kick.wav", "missing.wav", "kick.wav"]);
  assert.deepEqual(resolveBrowserSoundFiles(files, names), [
    { name: "kick.wav", file: sound },
    { name: "missing.wav", error: "未找到音源文件" },
  ]);
});
