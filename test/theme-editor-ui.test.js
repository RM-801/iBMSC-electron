import test from "node:test";
import assert from "node:assert/strict";
import { createThemeEditor } from "../src/theme-editor-ui.js";
import { editableTheme } from "../src/theme-defaults.js";
import { themes } from "../src/themes.js";

function harness() {
  const nodes = new Map();
  const document = { createElement: (tag) => new Element(tag) };
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.ownerDocument = document;
      this.children = [];
      this.value = "";
      this.checked = false;
    }
    set id(value) {
      this._id = value;
      nodes.set(value, this);
    }
    get id() {
      return this._id;
    }
    append(...children) {
      this.children.push(...children);
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    getContext() {
      return null;
    }
  }
  const ui = {
    text: (element, value) => (element.textContent = value),
    raw: (element, value) => (element.textContent = value),
    attribute: (element, name, value) => element.setAttribute(name, value),
  };
  let error;
  const editor = createThemeEditor({
    root: new Element("div"),
    preview: new Element("canvas"),
    ui,
    onError: (value) => (error = value),
  });
  return {
    editor,
    node: (id) => nodes.get("themeedit-" + id),
    error: () => error,
  };
}

test("confirming an unchanged signed-ARGB preset preserves its exact draft identity", () => {
  const { editor, node } = harness();
  for (const preset of Object.values(themes)) {
    const original = editableTheme(preset);
    const json = JSON.stringify(original);
    editor.load(original);
    assert.equal(JSON.stringify(editor.read()), json);
    node("column").value = "5";
    node("column").onchange();
    assert.equal(JSON.stringify(editor.read()), json);
    assert.equal(JSON.stringify(original), json);
  }
});

test("theme changes stay isolated, reject invalid opacity and can be discarded on reload", () => {
  const { editor, node, error } = harness();
  const original = editableTheme(themes.IIDX);
  original.visual.kFont.Style = "13";
  const before = structuredClone(original);
  editor.load(original);
  node("column-NoteColor").value = "#123456";
  node("column-NoteColor-alpha").value = "128";
  node("column-NoteColor-alpha").oninput();
  node("kFont-Italic").checked = true;
  node("kFont-Italic").oninput();
  const edited = editor.read();
  assert.equal(edited.columns[4].NoteColor, String(0x80123456));
  assert.equal(edited.visual.kFont.Style, "15");
  assert.deepEqual(original, before);
  node("column-NoteColor-alpha").value = "";
  node("column-NoteColor-alpha").oninput();
  assert.ok(error());
  assert.throws(() => editor.read(), /0–255/);
  node("column").value = "5";
  node("column").onchange();
  assert.equal(node("column").value, "4");
  editor.load(original);
  assert.deepEqual(editor.read(), before);
  assert.equal(error(), null);
});
