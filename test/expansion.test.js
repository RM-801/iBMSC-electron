import test from "node:test";
import assert from "node:assert/strict";
import { parseBMS, serializeBMS, events } from "../src/bms.js";
import { bmpDefinitions, setBMPDefinition } from "../src/expansion.js";
import { readProject, writeProject } from "../src/project.js";
import {
  readPortableProject,
  writePortableProject,
} from "../src/portable-project.js";
import { remapClipboardRows } from "../src/clipboard-base.js";
import { diagnose } from "../src/diagnostics.js";

test("BMS expansion follows upstream classification and survives repeated saves", () => {
  const raw = [
    "  #bmp01 first.mpg  ",
    "#CUSTOM first",
    "#CUSTOM second",
    "#BMP01 second.mpg",
    "#001D1:not-editor-data",
    "#00117:01",
    "#RANDOM 2",
    "#IF 1",
    "#TITLE Branch",
    "#WAV02 branch.wav",
    "#00211:02",
    "#SWITCH 2",
    "#CASE 1",
    "#BMP01 branch.mpg",
    "#ENDSW",
    "#ENDIF",
    "#ENDRANDOM",
  ];
  let c = parseBMS(
    [
      "* HEADER FIELD",
      "",
      "#TITLE Main",
      "#BPM 120",
      "#WAV01 key.wav",
      ...raw,
      "; comment",
      "#00011:01",
      "#00102:0.75",
      "#00004:01",
      "",
    ].join("\r\n"),
  );
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(c.raw, raw);
    assert.equal(c.headers.TITLE, "Main");
    assert.equal(c.headers.CUSTOM, undefined);
    assert.equal(c.resources.WAV["02"], undefined);
    assert.deepEqual(c.resources.BMP, {});
    assert.deepEqual(
      events(c).map((e) => e.channel),
      ["11", "04"],
    );
    assert.equal(bmpDefinitions(c)["01"], "second.mpg");
    assert.deepEqual(diagnose(c), []);
    const saved = serializeBMS(c);
    assert.ok(saved.indexOf(raw[0]) < saved.indexOf("#00011:01"));
    assert.ok(saved.indexOf("#ENDRANDOM") < saved.indexOf("#00102:0.75"));
    assert.equal(saved.split("#BMP01 second.mpg").length - 1, 1);
    c = parseBMS(saved);
  }
});

test("BMP edits use expansion as the single source, with conditional and BASE62 isolation", () => {
  const c = parseBMS(
    "#BASE 62\n#BMP0A upper.png\n#BMP0a lower.png\n#IF 1\n#BMP0a branch.png\n#ENDIF\n#00004:0a",
  );
  setBMPDefinition(c, "0a", "changed.png");
  assert.equal(bmpDefinitions(c)["0A"], "upper.png");
  assert.equal(bmpDefinitions(c)["0a"], "changed.png");
  assert.ok(c.raw.includes("#BMP0a branch.png"));
  assert.deepEqual(diagnose(c), []);
  c.raw = c.raw.filter((line) => line !== "#BMP0a changed.png");
  assert.equal(bmpDefinitions(c)["0a"], undefined);
  assert.match(diagnose(c)[0].message, /BMP0a/);
  assert.ok(!serializeBMS(c).includes("changed.png"));
});

test("native and portable projects preserve the expansion textbox verbatim", () => {
  const c = parseBMS("#TITLE Main\n#WAV01 key.wav\n#00011:01");
  c.raw = [
    "; typed comment",
    "",
    "#TITLE Extension",
    "#WAV01 other.wav",
    "#00311:01",
    "#CUSTOM first",
    "#CUSTOM second",
    "#BMP01 movie.mpg",
    "",
  ];
  for (const restored of [
    readProject(writeProject(c)),
    readPortableProject(writePortableProject(c)),
  ]) {
    assert.deepEqual(restored.raw, c.raw);
    assert.equal(restored.headers.TITLE, "Main");
    assert.equal(restored.resources.WAV["01"], "key.wav");
    assert.deepEqual(
      events(restored).map((e) => [e.measure, e.channel]),
      [[0, "11"]],
    );
  }
});

test("older portable projects expose hidden directives once without discarding raw text", () => {
  const old = parseBMS("#00011:01");
  old.headers.CUSTOM = "old";
  old.resources.BMP["01"] = "old.png";
  old.rows.push({ measure: 2, channel: "D1", cells: ["01", "00"] });
  old.raw = ["#CUSTOM newer", "#BMP01 newer.png"];
  const c = readPortableProject(
    JSON.stringify({ format: "ibmsc-node-project", version: 1, chart: old }),
  );
  assert.deepEqual(c.raw, [
    "#CUSTOM old",
    "#BMP01 old.png",
    "#002D1:0100",
    ...old.raw,
  ]);
  assert.equal(bmpDefinitions(c)["01"], "newer.png");
  assert.deepEqual(c.resources.BMP, {});
  assert.equal(c.headers.CUSTOM, undefined);
  assert.equal(c.rows.length, 1);
  assert.deepEqual(readPortableProject(writePortableProject(c)), c);
  assert.deepEqual(parseBMS(serializeBMS(c)).raw, c.raw);
});

test("cross-base BGA paste reads and writes definitions in expansion", () => {
  const source = parseBMS("#BASE 62\n#BMP0a movie.mpg\n#00004:0a");
  const target = parseBMS("#BMP10 existing.png\n#00004:10");
  const rows = remapClipboardRows(target, source, source.rows);
  const id = rows[0].cells[0];
  assert.notEqual(id, "10");
  assert.equal(bmpDefinitions(target)[id], "movie.mpg");
  assert.equal(bmpDefinitions(target)["10"], "existing.png");
  assert.deepEqual(target.resources.BMP, {});
  assert.equal(
    parseBMS(serializeBMS(target)).raw.filter((line) =>
      line.includes("movie.mpg"),
    ).length,
    1,
  );
});
