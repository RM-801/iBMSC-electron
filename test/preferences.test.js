import { test } from "node:test";
import assert from "node:assert/strict";
import {
  preferenceFields,
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

test("legacy external-player settings stay inert during import, migration and export", () => {
  assert.equal(Object.hasOwn(preferenceFields, "useexternalpreview"), false);
  const current = { previewclick: true, clickstop: false, snap: true };
  for (const flag of ["True", "False", "1", "invalid-old-value"]) {
    const legacy = {
      layoutVersion: 1,
      useexternalpreview: true,
      Player: {
        UseExternalPreview: flag,
        Count: "1",
        CurrentPlayer: "0",
        Player: { Path: "C:\\legacy-player.exe", FromBeginning: "-P <filename>" },
      },
    };
    const before = structuredClone(legacy);
    assert.deepEqual({ ...current, ...readPreferenceAttributes(legacy) }, current);
    assert.deepEqual(readPreferenceAttributes(migrateLayoutPreferences(legacy)), {});
    const written = writePreferenceAttributes(
      { ...current, useexternalpreview: true }, legacy,
    );
    assert.deepEqual(readPreferenceAttributes(written), current);
    assert.deepEqual(written.Player, legacy.Player);
    assert.deepEqual(legacy, before);
  }
  assert.deepEqual(writePreferenceAttributes({ useexternalpreview: true }), {});
  assert.deepEqual(writePreferenceAttributes({ useexternalpreview: false, previewclick: false }), {
    Edit: { PreviewOnClick: "False" },
  });
});

test("view visibility settings import original names and preserve false and unknown settings", () => {
  const original = {
    Grid: {
      gShow: "False",
      gShowS: "0",
      gShowBG: "false",
      gShowM: "FALSE",
      gShowMB: "False",
      gShowV: "0",
      gShowC: "False",
      futureGrid: "keep-grid",
    },
    ShowHide: {
      showMenu: "False",
      showTB: "0",
      showOpPanel: "false",
      showStatus: "FALSE",
      showLSplit: "False",
      showRSplit: "0",
      futurePanel: "keep-panel",
    },
    Future: { nested: { value: "keep-nested" } },
  };
  const expected = {
    showgrid: false,
    showsubgrid: false,
    showbackground: false,
    showmeasureindex: false,
    showmeasureline: false,
    showvertical: false,
    showcolumncaption: false,
    "show-menu": false,
    "show-toolbar": false,
    "show-options": false,
    "show-status": false,
    "split-left": false,
    "split-right": false,
  };
  const before = structuredClone(original);
  assert.deepEqual(readPreferenceAttributes(original), expected);
  for (const enabled of [false, true, false]) {
    const values = Object.fromEntries(
      Object.keys(expected).map((id) => [id, enabled]),
    );
    const exported = writePreferenceAttributes(values, original);
    assert.deepEqual(readPreferenceAttributes(exported), values);
    for (const key of [
      "gShow",
      "gShowS",
      "gShowBG",
      "gShowM",
      "gShowMB",
      "gShowV",
      "gShowC",
    ])
      assert.equal(exported.Grid[key], enabled ? "True" : "False");
    for (const key of [
      "showMenu",
      "showTB",
      "showOpPanel",
      "showStatus",
      "showLSplit",
      "showRSplit",
    ])
      assert.equal(exported.ShowHide[key], enabled ? "True" : "False");
    assert.equal(exported.Grid.futureGrid, "keep-grid");
    assert.equal(exported.ShowHide.futurePanel, "keep-panel");
    assert.deepEqual(exported.Future, original.Future);
  }
  assert.deepEqual(original, before);
  assert.throws(() =>
    readPreferenceAttributes({ ShowHide: { showTB: "hidden" } }),
  );
  assert.throws(() =>
    readPreferenceAttributes({ Grid: { gShowBG: "hidden" } }),
  );
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
  const nested = new Node("Player", { Count: "1", UseExternalPreview: "True" }, [
    new Node("Player0", { Path: "C:\\a&b.exe", Begin: '-P "<filename>"' }),
  ]);
  const original = new Doc(
    new Node("iBMSC", { Major: "3", Custom: "keep" }, [
      nested,
      new Node("Grid", { gSnap: "False", gWheel: "48" }),
      new Node("Columns", {}, [
        new Node("Column", { Index: "4", Width: "36" }),
      ]),
      new Node(
        "ShowHide",
        { showMenu: "True", showTB: "True", futurePanel: "keep" },
        [new Node("Future", { Mode: "opaque" })],
      ),
    ]),
  );
  const updated = updateSettingsDocument(original, {
    snap: true,
    lnstyle: "nt",
    "show-menu": false,
    "show-toolbar": false,
    "show-options": false,
    "show-status": false,
    showbackground: false,
    showmeasureindex: false,
    showmeasureline: false,
    showvertical: false,
    showcolumncaption: false,
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
  assert.equal(updated.documentElement.children[4].attrs.NTInput, "True");
  const showHide = updated.documentElement.children[3];
  assert.deepEqual(showHide.attrs, {
    showMenu: "False",
    showTB: "False",
    showOpPanel: "False",
    showStatus: "False",
    futurePanel: "keep",
  });
  assert.deepEqual(
    showHide.children,
    original.documentElement.children[3].children,
  );
  assert.equal(original.documentElement.children[3].attrs.showMenu, "True");
  const imported = readPreferenceAttributes(
    Object.fromEntries(
      updated.documentElement.children.map((node) => [
        node.tagName,
        node.attrs,
      ]),
    ),
  );
  assert.equal(Object.hasOwn(imported, "useexternalpreview"), false);
  for (const id of [
    "show-menu",
    "show-toolbar",
    "show-options",
    "show-status",
    "showbackground",
    "showmeasureindex",
    "showmeasureline",
    "showvertical",
    "showcolumncaption",
  ])
    assert.equal(imported[id], false, id);
  assert.throws(() => updateSettingsDocument(new Doc(new Node("Other")), {}));
});

test("original continuous vertical zoom and 999 BGM columns survive settings roundtrip", () => {
  const values = {
    zoom: 1.25,
    widthzoom: 2.75,
    subgrid: 12,
    showsubgrid: false,
    bgmcount: 999,
  };
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
  assert.equal(
    readPreferenceAttributes(migrateLayoutPreferences(migrated)).showbga,
    true,
  );
});

test("editor zoom is independent and legacy slash/error toggles stay inert", () => {
  const values = readPreferenceAttributes({ Grid: { EditorZoom: "175", gxHeight: "4", gxWidth: "2", gSlash: "bad-old-value" }, Edit: { ErrorCheck: "False" } });
  assert.deepEqual(values, { editorzoom: 175, zoom: 4, widthzoom: 2 });
  assert.equal(writePreferenceAttributes(values).Grid.EditorZoom, "175");
  for (const value of ["49", "301", "NaN", "100.5"]) assert.throws(() => readPreferenceAttributes({ Grid: { EditorZoom: value } }));
});
