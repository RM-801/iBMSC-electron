import test from "node:test";
import assert from "node:assert/strict";
import {
  readPlayerSettings,
  writePlayerSettings,
} from "../src/player-settings.js";
class Element {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName;
    this.attrs = { ...attrs };
    this.children = [];
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  appendChild(e) {
    this.children.push(e);
    return e;
  }
  removeChild(e) {
    this.children.splice(this.children.indexOf(e), 1);
  }
}
test("player XML preserves unknown attributes and unrelated nested data", () => {
  const root = new Element("iBMSC"),
    parent = root.appendChild(
      new Element("Player", { Count: "1", CurrentPlayer: "2", Custom: "keep" }),
    );
  parent.appendChild(
    new Element("Player", {
      Index: "2",
      Path: "/Applications/P.app",
      FromBeginning: "-P",
      FromHere: "-N<measure>",
      Stop: "-S",
      Future: "keep",
    }),
  );
  parent.appendChild(new Element("Extension", { Value: "keep" }));
  const doc = {
    documentElement: root,
    createElement: (tag) => new Element(tag),
  };
  assert.deepEqual(readPlayerSettings(doc), {
    current: 2,
    players: [
      {
        index: 2,
        path: "/Applications/P.app",
        begin: "-P",
        here: "-N<measure>",
        stop: "-S",
      },
    ],
  });
  writePlayerSettings(doc, {
    current: "a",
    players: [
      {
        id: "a",
        path: "/Applications/P.app",
        begin: "--play",
        here: "-N<measure>",
        stop: "-S",
      },
    ],
  });
  assert.equal(parent.attrs.Custom, "keep");
  const updated = parent.children.find((e) => e.tagName === "Player");
  assert.equal(updated.attrs.Future, "keep");
  assert.equal(updated.attrs.FromBeginning, "--play");
  assert.ok(parent.children.some((e) => e.tagName === "Extension"));
});
