import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generalDefaults,
  generalPreferenceIds,
  validateGeneralSettings,
} from "../src/general-settings.js";
import {
  readPreferenceAttributes,
  writePreferenceAttributes,
} from "../src/preferences.js";

test("general settings use original editor behavior with UTF-8 save default", () => {
  const expected = {
    defaultencoding: "utf8",
    maxgrid: 192,
    autosave: true,
    autosaveminutes: 2,
    beepsaved: true,
    bpmextended: false,
    stopextended: false,
    wheelunits: 96,
    pageunits: 384,
    middlemove: 0,
    autofocus: false,
    firstclick: true,
    clickstop: true,
  };
  assert.deepEqual(generalDefaults, expected);
  assert.deepEqual(generalPreferenceIds, Object.keys(expected));
  const draft = validateGeneralSettings();
  assert.deepEqual(draft, expected);
  draft.wheelunits = 48;
  assert.equal(generalDefaults.wheelunits, 96);
  assert.equal(validateGeneralSettings().wheelunits, 96);
});

test("general settings normalize draft numbers without changing source or accepting unrelated fields", () => {
  const source = {
    maxgrid: "384",
    autosaveminutes: "1.5",
    wheelunits: "73",
    pageunits: "777",
    middlemove: "1",
    defaultencoding: "shift_jis",
    autofocus: true,
    firstclick: false,
    futureOption: "keep outside this model",
  };
  const before = structuredClone(source);
  assert.deepEqual(validateGeneralSettings(source), {
    ...generalDefaults,
    maxgrid: 384,
    autosaveminutes: 1.5,
    wheelunits: 73,
    pageunits: 777,
    middlemove: 1,
    defaultencoding: "shift_jis",
    autofocus: true,
    firstclick: false,
  });
  assert.deepEqual(source, before);
});

test("general settings enforce useful numeric limits and strict checkbox and encoding values", () => {
  for (const minutes of [0.1, 0.3, 1.5, 59.9, 60])
    assert.equal(
      validateGeneralSettings({ autosaveminutes: minutes }).autosaveminutes,
      minutes,
    );
  for (const [id, min, max] of [
    ["maxgrid", 8, 10000],
    ["wheelunits", 1, 100000],
    ["pageunits", 1, 100000],
    ["middlemove", 0, 1],
  ]) {
    for (const value of [min, max])
      assert.equal(validateGeneralSettings({ [id]: value })[id], value);
    for (const value of [
      min - 1,
      max + 1,
      min + 0.5,
      "",
      " ",
      null,
      true,
      false,
      NaN,
      Infinity,
    ])
      assert.throws(
        () => validateGeneralSettings({ [id]: value }),
        id + ": " + value,
      );
  }
  for (const value of [0, 0.05, 1.01, 60.1, "", null, false, Infinity])
    assert.throws(() => validateGeneralSettings({ autosaveminutes: value }));
  for (const id of [
    "autosave",
    "beepsaved",
    "bpmextended",
    "stopextended",
    "autofocus",
    "firstclick",
    "clickstop",
  ])
    for (const value of ["False", "true", "", 0, 1, null])
      assert.throws(() => validateGeneralSettings({ [id]: value }));
  for (const value of [
    "ANSI",
    "GBK",
    "unicode",
    "UTF-8",
    "Shift-JIS",
    "",
    null,
  ])
    assert.throws(() => validateGeneralSettings({ defaultencoding: value }));
  for (const value of [null, [], "settings"])
    assert.throws(() => validateGeneralSettings(value));
});

test("original XML general preferences retain custom scrolling values and map all settings", () => {
  const attributes = {
    Grid: { gWheel: "73", gPgUpDn: "777" },
    Edit: {
      MiddleButtonMoveMethod: "1",
      AutoFocusMouseEnter: "True",
      FirstClickDisabled: "False",
      ClickStopPreview: "0",
      AutoSaveInterval: "90000",
    },
    Save: {
      TextEncoding: "ShiftJIS",
      BMSGridLimit: "0.5",
      BeepWhileSaved: "False",
      BPMx1296: "1",
      STOPx1296: "True",
    },
  };
  const expected = {
    ...generalDefaults,
    wheelunits: 73,
    pageunits: 777,
    middlemove: 1,
    autofocus: true,
    firstclick: false,
    clickstop: false,
    autosaveminutes: 1.5,
    defaultencoding: "shift_jis",
    maxgrid: 384,
    beepsaved: false,
    bpmextended: true,
    stopextended: true,
  };
  assert.deepEqual(readPreferenceAttributes(attributes), expected);
  assert.deepEqual(
    readPreferenceAttributes(writePreferenceAttributes(expected)),
    expected,
  );
});

test("autosave XML converts milliseconds and retains disabled state in partial writes", () => {
  for (const [minutes, millis] of [
    [0.1, "6000"],
    [1.5, "90000"],
    [60, "3600000"],
  ]) {
    assert.deepEqual(
      readPreferenceAttributes({ Edit: { AutoSaveInterval: millis } }),
      {
        autosave: true,
        autosaveminutes: minutes,
      },
    );
    assert.deepEqual(
      writePreferenceAttributes({ autosave: true, autosaveminutes: minutes }),
      {
        Edit: { AutoSaveInterval: millis, AutoSaveMinutes: String(minutes) },
      },
    );
  }
  assert.deepEqual(
    readPreferenceAttributes({ Edit: { AutoSaveInterval: "0" } }),
    { autosave: false },
  );
  assert.deepEqual(
    writePreferenceAttributes({ autosave: false, autosaveminutes: 1.5 }),
    { Edit: { AutoSaveInterval: "0", AutoSaveMinutes: "1.5" } },
  );
  assert.deepEqual(
    writePreferenceAttributes(
      { autosaveminutes: 1.5 },
      { Edit: { AutoSaveInterval: "0" } },
    ),
    { Edit: { AutoSaveInterval: "0", AutoSaveMinutes: "1.5" } },
  );
  assert.deepEqual(
    writePreferenceAttributes(
      { autosave: true },
      { Edit: { AutoSaveInterval: "90000" } },
    ),
    { Edit: { AutoSaveInterval: "90000" } },
  );
  for (const value of ["-1", "0.5", "3000", "3606000", "", " ", null, false])
    assert.throws(() =>
      readPreferenceAttributes({ Edit: { AutoSaveInterval: value } }),
    );
});

test("disabled autosave retains its remembered interval on restart and re-enable", () => {
  const disabled = writePreferenceAttributes({
    autosave: false,
    autosaveminutes: 3.5,
  });
  assert.deepEqual(readPreferenceAttributes(disabled), {
    autosave: false,
    autosaveminutes: 3.5,
  });
  const enabled = writePreferenceAttributes({ autosave: true }, disabled);
  assert.deepEqual(enabled, {
    Edit: { AutoSaveInterval: "210000", AutoSaveMinutes: "3.5" },
  });
  assert.deepEqual(readPreferenceAttributes(enabled), {
    autosave: true,
    autosaveminutes: 3.5,
  });
  assert.equal(
    validateGeneralSettings(
      readPreferenceAttributes({ Edit: { AutoSaveInterval: "0" } }),
    ).autosaveminutes,
    2,
  );
  for (const value of ["0", "60.1", "1.01", "", null, false])
    assert.throws(() =>
      readPreferenceAttributes({
        Edit: { AutoSaveInterval: "0", AutoSaveMinutes: value },
      }),
    );
});

test("legacy save encoding imports never reintroduce ANSI and new writes use two supported encodings", () => {
  for (const legacy of [
    "ANSI",
    "Unicode",
    "ASCII",
    "BigEndian",
    "UTF32",
    "UTF7",
    "UTF8",
    "UTF-8",
  ])
    assert.deepEqual(
      readPreferenceAttributes({ Save: { TextEncoding: legacy } }),
      { defaultencoding: "utf8" },
    );
  for (const encoding of [
    "ShiftJIS",
    "SHIFT-JIS",
    "shift_jis",
    "SJIS",
    "CP932",
    "Windows-31J",
  ])
    assert.deepEqual(
      readPreferenceAttributes({ Save: { TextEncoding: encoding } }),
      { defaultencoding: "shift_jis" },
    );
  assert.deepEqual(writePreferenceAttributes({ defaultencoding: "utf8" }), {
    Save: { TextEncoding: "UTF8" },
  });
  assert.deepEqual(
    writePreferenceAttributes({ defaultencoding: "shift_jis" }),
    { Save: { TextEncoding: "ShiftJIS" } },
  );
  for (const encoding of ["GBK", "unknown", "", null])
    assert.throws(() =>
      readPreferenceAttributes({ Save: { TextEncoding: encoding } }),
    );
});

test("BMS grid partition reciprocal survives roundtrips without accepting invalid limits", () => {
  for (const maxgrid of [8, 192, 1000, 3072, 10000]) {
    const attributes = writePreferenceAttributes({ maxgrid });
    assert.equal(Number(attributes.Save.BMSGridLimit), 192 / maxgrid);
    assert.deepEqual(readPreferenceAttributes(attributes), { maxgrid });
  }
  for (const limit of [
    "0",
    "-1",
    "25",
    "0.00001",
    "1.1",
    "",
    " ",
    null,
    true,
    "Infinity",
  ])
    assert.throws(() =>
      readPreferenceAttributes({ Save: { BMSGridLimit: limit } }),
    );
  for (const [tag, key] of [
    ["Grid", "gWheel"],
    ["Grid", "gPgUpDn"],
    ["Edit", "MiddleButtonMoveMethod"],
  ])
    for (const value of ["", " ", null, true, "1.5"])
      assert.throws(() =>
        readPreferenceAttributes({ [tag]: { [key]: value } }),
      );
});

test("general preference export preserves unknown settings and does not invent missing settings", () => {
  const base = {
    Grid: { futureGrid: "keep", gWheel: "73" },
    Edit: { AutoSaveInterval: "90000", futureEdit: "keep" },
    Save: { TextEncoding: "ANSI", futureSave: "keep" },
    Future: { nested: { keep: [1, 2] } },
  };
  const original = structuredClone(base);
  const output = writePreferenceAttributes(
    { maxgrid: 384, firstclick: false },
    base,
  );
  assert.deepEqual(output, {
    ...original,
    Edit: { ...original.Edit, FirstClickDisabled: "False" },
    Save: { ...original.Save, BMSGridLimit: "0.5" },
  });
  assert.deepEqual(base, original);
  output.Future.nested.keep.push(3);
  assert.deepEqual(base.Future.nested.keep, [1, 2]);
  assert.deepEqual(readPreferenceAttributes({}), {});
  assert.deepEqual(writePreferenceAttributes({}), {});
  assert.deepEqual(writePreferenceAttributes({}, base), original);
  assert.deepEqual(
    readPreferenceAttributes(writePreferenceAttributes(generalDefaults)),
    generalDefaults,
  );
});
