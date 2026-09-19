import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateSettingsDocument,
  migrateLayoutPreferences,
  readPreferenceAttributes,
  writePreferenceAttributes,
  xmlEscape,
} from "../src/preferences.js";
test("original preference names decode and retain unrelated attributes on export", () => {
  const original = {
    Grid: { gSnap: "True", gDivide: "24", gCol: "8", gWheel: "48" },
    Edit: { NTInput: "False" },
    WAV: { BeatChangeMode: "2" },
  };
  const values = readPreferenceAttributes(original);
  assert.equal(values.snap, true);
  assert.equal(values.grid, 24);
  assert.equal(values.lnstyle, "bmse");
  assert.equal(values.beatmode, "cut");
  const out = writePreferenceAttributes({ ...values, bgmcount: 10 }, original);
  assert.equal(out.Grid.gWheel, "48");
  assert.equal(out.Grid.gCol, "10");
});
test("invalid preferences rejected and XML attributes escaped", () => {
  assert.throws(() =>
    readPreferenceAttributes({ Grid: { gDivide: "Infinity" } }),
  );
  assert.throws(() => readPreferenceAttributes({ Grid: { gSnap: "execute" } }));
  assert.equal(xmlEscape('"<&'), "&quot;&lt;&amp;");
});
test("partial updates do not invent values and malformed integer/mode inputs fail", () => {
  assert.deepEqual(writePreferenceAttributes({ snap: true }), {
    Grid: { gSnap: "True" },
  });
  assert.deepEqual(writePreferenceAttributes({}, { Player: { Count: "2" } }), {
    Player: { Count: "2" },
  });
  assert.throws(() => readPreferenceAttributes({ Grid: { gDivide: "1.5" } }));
  assert.throws(() =>
    readPreferenceAttributes({ Edit: { NTInput: "invalid" } }),
  );
  assert.throws(() => writePreferenceAttributes({ beatmode: "invalid" }));
});

test("XML update keeps nested settings, root metadata and imported document unchanged", () => {
  class Node {
    constructor(tagName, attrs = {}, children = []) {
      Object.assign(this, { tagName, attrs, children });
    }
    setAttribute(name, value) {
      this.attrs[name] = value;
    }
    appendChild(child) {
      this.children.push(child);
    }
    cloneNode() {
      return new Node(
        this.tagName,
        { ...this.attrs },
        this.children.map((c) => c.cloneNode()),
      );
    }
  }
  class Doc {
    constructor(root) {
      this.documentElement = root;
    }
    createElement(tag) {
      return new Node(tag);
    }
    cloneNode() {
      return new Doc(this.documentElement.cloneNode());
    }
  }
  const nested = new Node("Player", { Count: "1" }, [
    new Node("Player0", { Path: "C:\\a&b.exe", Begin: '-P "<filename>"' }),
  ]);
  const original = new Doc(
    new Node("iBMSC", { Major: "3", Custom: "keep" }, [
      nested,
      new Node("Grid", { gSnap: "False", gWheel: "48" }),
      new Node("Columns", {}, [
        new Node("Column", { Index: "4", Width: "36" }),
      ]),
    ]),
  );
  const updated = updateSettingsDocument(original, {
    snap: true,
    lnstyle: "nt",
  });
  assert.deepEqual(updated.documentElement.children[0], nested);
  assert.deepEqual(
    updated.documentElement.children[2],
    original.documentElement.children[2],
  );
  assert.deepEqual(
    updated.documentElement.attrs,
    original.documentElement.attrs,
  );
  assert.equal(updated.documentElement.children[1].attrs.gSnap, "True");
  assert.equal(updated.documentElement.children[1].attrs.gWheel, "48");
  assert.equal(original.documentElement.children[1].attrs.gSnap, "False");
  assert.equal(updated.documentElement.children[3].attrs.NTInput, "True");
  assert.throws(() => updateSettingsDocument(new Doc(new Node("Other")), {}));
});

test("original continuous vertical zoom and 999 BGM columns survive settings roundtrip", () => {
  const values = { zoom: 1.25, bgmcount: 999 };
  assert.deepEqual(
    readPreferenceAttributes(writePreferenceAttributes(values)),
    values,
  );
});

test("old expanded BGA default migrates once without overriding later choices", () => {
  const old = { Grid: { gBLP: "True", gxHeight: "4", gCol: "17" } };
  const migrated = migrateLayoutPreferences(old);
  assert.equal(readPreferenceAttributes(migrated).showbga, false);
  assert.equal(migrated.Grid.gxHeight, "4");
  assert.equal(migrated.Grid.gCol, "17");
  assert.equal(old.Grid.gBLP, "True");
  migrated.Grid.gBLP = "True";
  assert.equal(readPreferenceAttributes(migrateLayoutPreferences(migrated)).showbga, true);
});
