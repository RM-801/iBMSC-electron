// Pure Node unit harness: no browser, local-origin navigation, or network access.
import { test } from "node:test";
import { parseBMS, events } from "../src/bms.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
test("controller initializes and routes document edits, history, columns and source actions", async () => {
  const html = await readFile(
      new URL("../index.html", import.meta.url),
      "utf8",
    ),
    nodes = new Map(),
    handlers = {};
  class Element {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.value = "";
      this.checked = false;
      this.hidden = false;
      this.style = {
        setProperty(name, value) {
          this[name] = value;
        },
      };
      this.dataset = {};
      this.clientWidth = 700;
      this.clientHeight = 450;
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.classList = { toggle() {} };
    }
    setAttribute(name, value) {
      this[name] = value;
    }
    set id(id) {
      this._id = id;
      nodes.set(id, this);
    }
    get id() {
      return this._id;
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = [...children];
    }
    get selectedOptions() {
      return this.children.filter((option) => option.selected);
    }
    getContext() {
      return new Proxy(
        {},
        {
          get: (_, key) =>
            key === "measureText"
              ? text => ({ width: text.length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 6 })
              : key === "createLinearGradient"
              ? () => ({ addColorStop() {} })
              : () => {},
        },
      );
    }
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: this.clientWidth,
        height: this.clientHeight,
      };
    }
    addEventListener(name, fn) {
      this["event-" + name] = fn;
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    click() {
      if (!this.disabled)
        return this.onclick?.({ currentTarget: this, target: this });
    }
    setPointerCapture() {}
  }
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)) {
    const id = m[2].match(/\bid="([^"]+)"/)?.[1];
    if (!id) continue;
    const el = new Element(m[1]);
    el.id = id;
    if (m[1] === "canvas") {
      el.width = Number(m[2].match(/width="(\d+)"/)?.[1] || 300);
      el.height = Number(m[2].match(/height="(\d+)"/)?.[1] || 150);
    }
    el.value = m[2].match(/\bvalue="([^"]*)"/)?.[1] || "";
    el.checked = /\bchecked\b/.test(m[2]);
    el.hidden = /\bhidden\b/.test(m[2]);
  }
  for (const m of html.matchAll(
    /<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select\s*>/g,
  )) {
    const options = [...m[2].matchAll(/<option([^>]*)>([\s\S]*?)<\/option>/g)],
      o = options.find((o) => /\bselected\b/.test(o[1])) || options[0];
    if (o)
      nodes.get(m[1]).value = o[1].match(/value="([^"]*)"/)?.[1] ?? o[2].trim();
  }
  const document = {
    getElementById: (id) => nodes.get(id),
    createElement: (tag) => new Element(tag),
    querySelectorAll: () => [],
    querySelector: () =>
      [...nodes.values()].find((e) => e.tagName === "DIALOG" && e.open) || null,
  };
  const prior = {};
  for (const key of [
    "document",
    "window",
    "ResizeObserver",
    "devicePixelRatio",
    "setInterval",
    "clearInterval",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "confirm",
    "AudioContext",
  ])
    prior[key] = globalThis[key];
  try {
    Object.assign(globalThis, {
      document,
      window: {
        innerWidth: 1280,
        addEventListener: (name, fn) => (handlers[name] = fn),
      },
      ResizeObserver: class {
        observe() {}
      },
      devicePixelRatio: 1,
      setInterval: () => 0,
      clearInterval: () => {},
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      confirm: () => true,
    });
    await import("../src/app.js");
    assert.equal(Number(nodes.get("zoom").value), 4);
    nodes.get("theme").value = "IIDX";
    nodes.get("theme").onchange();
    for (const id of ["laneheads", "heads-left", "heads-right"]) {
      assert.equal(nodes.get(id).style.color, "rgba(0,255,0,1)");
      assert.equal(nodes.get(id).style.backgroundColor, "rgba(0,0,0,1)");
    }
    nodes.get("theme").value = "";
    nodes.get("theme").onchange();
    assert.equal(nodes.get("laneheads").style.backgroundColor, "#000");
    const widthBefore = nodes.get("laneheads").style.gridTemplateColumns;
    nodes.get("widthzoom").value = "2";
    nodes.get("widthzoom").onchange();
    assert.equal(parseFloat(nodes.get("laneheads").style.gridTemplateColumns), parseFloat(widthBefore) * 2);
    assert.equal(Number(nodes.get("widthslider").value), 2);
    nodes.get("widthzoom").value = "1";
    nodes.get("widthzoom").onchange();
    const mainView = nodes.get("viewport"), leftView = nodes.get("view-left");
    mainView.onscroll();
    const mainTop = mainView.scrollTop;
    nodes.get("scrolllock-left").checked = false;
    leftView.scrollTop = mainTop - 100;
    leftView.onscroll();
    assert.equal(mainView.scrollTop, mainTop);
    nodes.get("scrolllock-left").checked = true;
    mainView.scrollTop += 40;
    mainView.onscroll();
    assert.equal(leftView.scrollTop, mainTop - 60);
    leftView.onscroll();
    assert.equal(mainView.scrollTop, mainTop + 40);
    nodes.get("beat-scale").checked = true;
    nodes.get("beat-scale").onchange();
    assert.equal(nodes.get("beatmode").value, "scale");
    nodes.get("beat-absolute").checked = true;
    nodes.get("beat-absolute").onchange();
    const expansionBefore = nodes.get("expansion").value;
    const extra = "#RANDOM 2\n#IF 1\n#00111:0100\n#ENDIF\n#ENDRANDOM";
    nodes.get("expansion").value = extra.slice(0, 20);
    nodes.get("expansion").oninput();
    nodes.get("expansion").value = extra;
    nodes.get("expansion").oninput();
    assert.match(document.title, /^●/);
    assert.equal(nodes.get("count").textContent, "0");
    nodes.get("sourceopen").click();
    assert.ok(nodes.get("source").value.replaceAll("\r\n", "\n").includes(extra));
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("expansion").value, expansionBefore);
    nodes.get("redo").click();
    assert.equal(nodes.get("expansion").value, extra);
    nodes.get("undo").click();
    const browseModes = [];
    window.desktop = { chooseSounds: async multiple => { browseModes.push(multiple); return []; } };
    await nodes.get("samples").ondblclick();
    await nodes.get("wavbrowse").click();
    assert.deepEqual(browseModes, [false, true]);
    delete window.desktop;
    nodes.get("playersettings").click();
    assert.equal(nodes.get("playersettingsdialog").open, true);
    nodes.get("playersettingsdialog").close();
    nodes.get("toggleln").click();
    assert.equal(nodes.get("lnstyle").value, "bmse");
    assert.match(nodes.get("toggleln").textContent, /BMSE/);
    nodes.get("toggleln").click();
    assert.equal(nodes.get("lnstyle").value, "nt");
    nodes.get("statistics").click();
    assert.equal(nodes.get("statstable").hidden, false);
    assert.equal(nodes.get("statstable").children.length, 15);
    assert.deepEqual(nodes.get("statstable").children.slice(3,11).map(row=>row.children[0].textContent),
      ["A1","A2","A3","A4","A5","A6","A7","A8"]);
    nodes.get("reportclose").click();
    nodes.get("header-PLAYER").value = "3";
    nodes.get("header-PLAYER").onchange();
    nodes.get("statistics").click();
    assert.equal(nodes.get("statstable").children.length, 23);
    assert.deepEqual(nodes.get("statstable").children.slice(12,20).map(row=>row.children[0].textContent),
      ["D1","D2","D3","D4","D5","D6","D7","D8"]);
    nodes.get("reportclose").click();
    nodes.get("undo").click();
    // The interaction fixtures below use 1x coordinates.
    nodes.get("zoom").value = "1";
    nodes.get("zoom").onchange();
    for (const mode of ["time", "write", "select"]) {
      nodes.get("tool-" + mode).click();
      assert.equal(nodes.get("tool").value, mode);
      for (const other of ["time", "write", "select"])
        assert.equal(
          nodes.get("tool-" + other)["aria-pressed"],
          String(other === mode),
        );
    }
    nodes.get("toggle-options").click();
    assert.equal(nodes.get("options-panel").hidden, true);
    assert.equal(nodes.get("options-resizer").hidden, true);
    nodes.get("toggle-options").click();
    assert.equal(nodes.get("options-panel").hidden, false);
    nodes
      .get("options-resizer")
      .onkeydown({ key: "ArrowLeft", preventDefault() {} });
    assert.equal(nodes.get("workspace").style["--options-width"], "210px");
    nodes
      .get("options-resizer")
      .onkeydown({ key: "Home", preventDefault() {} });
    assert.equal(nodes.get("workspace").style["--options-width"], "200px");
    assert.equal(nodes.get("count").textContent, "0");
    assert.ok(
      nodes.get("laneheads").children.some((n) => n.textContent === "B8"),
    );
    assert.equal(nodes.get("show2p").checked, false);
    assert.ok(Number.parseFloat(nodes.get("scrollspace").style.height) < 3000);
    assert.ok(
      !nodes.get("laneheads").children.some((n) => n.textContent === "D1"),
    );
    nodes.get("header-PLAYER").value = "3";
    nodes.get("header-PLAYER").onchange();
    assert.equal(nodes.get("show2p").checked, true);
    assert.ok(
      nodes.get("laneheads").children.some((n) => n.textContent === "D8"),
    );
    nodes.get("undo").click();
    assert.equal(nodes.get("show2p").checked, false);

    for (const name of ["PLAYER", "RANK", "DIFFICULTY"])
      assert.equal(nodes.get("header-" + name).tagName, "SELECT");
    nodes.get("header-RANK").value = "0";
    nodes.get("header-RANK").onchange();
    nodes.get("header-DIFFICULTY").value = "4";
    nodes.get("header-DIFFICULTY").onchange();
    nodes.get("sourceopen").click();
    assert.equal(parseBMS(nodes.get("source").value).headers.RANK, "0");
    assert.equal(parseBMS(nodes.get("source").value).headers.DIFFICULTY, "4");
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("header-RANK").value, "");
    assert.equal(Number(nodes.get("bgmcount").value), 15);
    assert.equal(nodes.get("zoom").tagName, "INPUT");
    nodes.get("bgmcount").value = "999";
    nodes.get("bgmcount").onchange();
    assert.ok(
      nodes.get("laneheads").children.some((n) => n.textContent === "B999"),
    );
    nodes.get("bgmcount").value = "15";
    nodes.get("bgmcount").onchange();
    assert.equal(nodes.get("samples").children.length, 1295);
    assert.equal(nodes.get("samples").children.at(-1).value, "ZZ");
    const key = (value, extra = {}) =>
      handlers.keydown({
        key: value,
        target: nodes.get("chart"),
        preventDefault() {},
        ...extra,
      });
    key(",");
    assert.equal(Number(nodes.get("grid").value), 32);
    key(".");
    assert.equal(Number(nodes.get("grid").value), 16);
    key("Home");
    const startScroll = nodes.get("viewport").scrollTop;
    key("PageUp");
    assert.equal(startScroll - nodes.get("viewport").scrollTop, 384);
    key("Home");

    nodes.get("source").value = "#TITLE Smoke\n#BPM 120\n#00011:01\n#00112:02";
    nodes.get("sourceapply").click();
    assert.equal(nodes.get("count").textContent, "2");
    assert.equal(nodes.get("project").textContent, "Smoke");
    nodes.get("undo").click();
    assert.equal(nodes.get("count").textContent, "0");
    assert.equal(document.title.startsWith("●"), false);
    nodes.get("redo").click();
    assert.equal(nodes.get("count").textContent, "2");
    nodes.get("selectall").click();
    // Menu conversions act on the requested type, independent of the old selector.
    nodes.get("conversion").value = "long";
    nodes.get("convert-hidden").click();
    nodes.get("sourceopen").click();
    assert.ok(events(parseBMS(nodes.get("source").value)).every(n => /[34]/.test(n.channel[0])));
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    nodes.get("selectall").click();
    nodes.get("convert-value").click();
    assert.equal(nodes.get("convertvaluedialog").open, true);
    nodes.get("conversionvalue").value = "00";
    nodes.get("applyconversionvalue").click();
    assert.match(nodes.get("conversionerror").textContent, /编号/);
    assert.equal(nodes.get("convertvaluedialog").open, true);
    nodes.get("conversionvalue").value = "0A";
    nodes.get("applyconversionvalue").click();
    assert.equal(nodes.get("convertvaluedialog").open, false);
    nodes.get("sourceopen").click();
    assert.ok(events(parseBMS(nodes.get("source").value)).every(n => n.value === "0A"));
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    nodes.get("selectall").click();
    nodes.get("deletenotes").click();
    assert.equal(nodes.get("count").textContent, "0");
    nodes.get("undo").click();
    assert.equal(nodes.get("count").textContent, "2");
    nodes.get("show2p").checked = false;
    nodes.get("show2p").onchange();
    assert.equal(
      nodes.get("laneheads").children.some((n) => n.textContent === "D1"),
      false,
    );
    assert.equal(
      nodes.get("laneheads").children.some((n) => n.textContent === "B1"),
      true,
    );
    nodes.get("sourceopen").click();
    assert.ok(nodes.get("source").value.includes("#TITLE Smoke"));
    nodes.get("sourcecancel").click();
    let finishSave;
    window.desktop = {
      save: () => new Promise((resolve) => (finishSave = resolve)),
    };
    const save = nodes.get("save").click();
    nodes.get("title").value = "Edited during save";
    nodes.get("title").onchange();
    finishSave({ name: "Smoke.bms" });
    await save;
    assert.equal(document.title.startsWith("●"), true);
    const tokens = [];
    window.desktop = {
      open: async () => ({
        name: "recent.bms",
        bytes: new TextEncoder().encode("#TITLE Recent\n#BPM 120"),
        token: "accepted",
      }),
      acceptOpen: async (token) => {
        tokens.push(token);
        return {};
      },
      cancelOpen: async (token) => tokens.push("cancel:" + token),
      recent: async () => ["/charts/recent.bms"],
    };
    await nodes.get("open").click();
    assert.equal(nodes.get("project").textContent, "Recent");
    assert.deepEqual(tokens, ["accepted", "cancel:accepted"]);
    assert.equal(nodes.get("recentfiles").children.length, 1);
    window.desktop.open = async () => ({
      name: "broken.ibmsc",
      bytes: new Uint8Array([1]),
      token: "rejected",
    });
    await nodes.get("open").click();
    assert.equal(nodes.get("project").textContent, "Recent");
    assert.deepEqual(tokens, [
      "accepted",
      "cancel:accepted",
      "cancel:rejected",
    ]);
    const requestedAssets = [];
    globalThis.AudioContext = class {
      async decodeAudioData(bytes) {
        return {
          bytes,
          duration: 1,
          sampleRate: 44100,
          getChannelData: () => new Float32Array(16),
        };
      }
    };
    window.desktop.open = async () => ({
      name: "sound.bms",
      token: "sound",
      bytes: new TextEncoder().encode(
        "#BPM 120\n#WAV01 sound\\kick.wav\n#WAV02 sound\\missing.wav",
      ),
    });
    window.desktop.asset = async (name) => {
      requestedAssets.push(name);
      if (name.includes("missing")) throw Error("文件不存在");
      return new Uint8Array([1, 2]);
    };
    await nodes.get("open").click();
    assert.deepEqual(requestedAssets, [
      "sound\\kick.wav",
      "sound\\missing.wav",
    ]);
    assert.equal(
      nodes.get("soundstatus").textContent,
      "音源已关联：1 个；未能加载：1 个",
    );
    assert.equal(nodes.get("sounderrors").hidden, false);
    assert.match(
      nodes.get("sounderrorlist").textContent,
      /missing.wav：文件不存在/,
    );
    assert.ok(nodes.get("samples").children[0].textContent.includes("✓"));
    nodes.get("samples").children[1].selected = true;
    nodes.get("samples").onchange();
    nodes.get("wavdown").click();
    assert.equal(nodes.get("sample").value, "02");
    assert.ok(
      nodes.get("samples").children[1].textContent.includes("kick.wav"),
    );
    assert.ok(
      nodes.get("samples").children[2].textContent.includes("missing.wav"),
    );
    nodes.get("undo").click();
    assert.ok(
      nodes.get("samples").children[0].textContent.includes("kick.wav"),
    );

    delete window.desktop;
    const droppedFile = {
      name: "dropped.bms",
      arrayBuffer: async () =>
        new TextEncoder().encode("#TITLE Dropped\n#BPM 120\n#00011:01").buffer,
    };
    await handlers.drop({
      dataTransfer: { files: [droppedFile] },
      preventDefault() {},
    });
    assert.equal(nodes.get("project").textContent, "Dropped");
    assert.equal(nodes.get("count").textContent, "1");
    await handlers.drop({
      dataTransfer: { files: [droppedFile, { name: "second.bms" }] },
      preventDefault() {},
    });
    assert.equal(nodes.get("project").textContent, "Dropped");
    assert.match(nodes.get("status").textContent, /一次只能/);
    const manyBgm =
      "#BPM 120\n" + Array.from({ length: 23 }, () => "#00001:01").join("\n");
    await handlers.drop({
      dataTransfer: {
        files: [
          {
            name: "many-bgm.bms",
            arrayBuffer: async () => new TextEncoder().encode(manyBgm).buffer,
          },
        ],
      },
      preventDefault() {},
    });
    assert.equal(Number(nodes.get("bgmcount").value), 23);
    assert.ok(
      nodes.get("laneheads").children.some((n) => n.textContent === "B23"),
    );
    nodes.get("bgmcount").value = "8";
    nodes.get("bgmcount").onchange();
    assert.equal(Number(nodes.get("bgmcount").value), 23);
    await handlers.drop({
      dataTransfer: { files: [droppedFile] },
      preventDefault() {},
    });
    assert.equal(Number(nodes.get("bgmcount").value), 15);
    await nodes.get("new").click();
    assert.equal(nodes.get("soundstatus").textContent, "");
    assert.equal(nodes.get("sounderrors").hidden, true);
    const view = nodes.get("viewport"),
      canvas = nodes.get("chart");
    view.scrollTop =
      Number.parseFloat(nodes.get("scrollspace").style.height) -
      view.clientHeight;
    view.onscroll();
    nodes.get("tool").value = "write";
    const pointer = {
      button: 0,
      currentTarget: canvas,
      clientX: 215,
      clientY: 425,
      pointerId: 1,
    };
    nodes.get("widthzoom").value = "2";
    nodes.get("widthzoom").onchange();
    canvas.onpointerdown({ ...pointer, clientX: pointer.clientX * 2 });
    canvas.onpointerup({ ...pointer, clientX: pointer.clientX * 2 });
    nodes.get("sourceopen").click();
    const zoomedChannel = events(parseBMS(nodes.get("source").value))[0].channel;
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    nodes.get("widthzoom").value = "1";
    nodes.get("widthzoom").onchange();
    canvas.onpointermove(pointer);
    canvas.onpointerleave();
    canvas.onpointerdown(pointer);
    assert.equal(nodes.get("status").textContent, "");
    canvas.onpointerup(pointer);
    assert.equal(nodes.get("count").textContent, "1");
    nodes.get("sourceopen").click();
    assert.equal(events(parseBMS(nodes.get("source").value))[0].channel, zoomedChannel);
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("count").textContent, "0");
    canvas.onpointerdown(pointer);
    canvas.onpointermove({ ...pointer, clientY: 329 });
    assert.equal(nodes.get("count").textContent, "0");
    canvas.onpointercancel();
    assert.equal(nodes.get("count").textContent, "0");
    canvas.onpointerdown(pointer);
    canvas.onpointermove({ ...pointer, clientY: 329 });
    canvas.onpointerup({ ...pointer, clientY: 329 });
    assert.equal(nodes.get("count").textContent, "2");
    nodes.get("tool-select").click();
    canvas.ondblclick(pointer);
    assert.equal(nodes.get("noteeditdialog").open, true);
    nodes.get("noteeditvalue").value = "00";
    nodes.get("noteeditapply").click();
    assert.equal(nodes.get("noteeditdialog").open, true);
    assert.match(nodes.get("noteediterror").textContent, /当前 BASE/);
    nodes.get("noteeditvalue").value = "02";
    nodes.get("noteeditapply").click();
    assert.equal(nodes.get("noteeditdialog").open, false);
    canvas.oncontextmenu({
      ...pointer,
      clientY: 370,
      shiftKey: true,
      preventDefault() {},
    });
    assert.equal(nodes.get("sample").value, "02");
    assert.equal(nodes.get("count").textContent, "2");
    canvas.onpointerdown({ ...pointer, clientY: 329, shiftKey: true });
    canvas.onpointerup({ ...pointer, clientY: 281, shiftKey: true });
    nodes.get("sourceopen").click();
    assert.deepEqual(
      events(parseBMS(nodes.get("source").value)).map((n) => [n.value, n.beat]),
      [
        ["02", 0],
        ["02", 3],
      ],
    );
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    canvas.oncontextmenu({ ...pointer, clientY: 370, preventDefault() {} });
    assert.equal(nodes.get("count").textContent, "0");
    nodes.get("undo").click();
    assert.equal(nodes.get("count").textContent, "2");
    for (const [key, mode] of [
      ["F1", "time"],
      ["F3", "write"],
      ["F2", "select"],
    ]) {
      handlers.keydown({ key, target: canvas, preventDefault() {} });
      assert.equal(nodes.get("tool").value, mode);
    }
    handlers.keydown({ key: "F8", target: canvas, preventDefault() {} });
    assert.equal(nodes.get("lnstyle").value, "bmse");
    handlers.keydown({ key: "F8", target: canvas, preventDefault() {} });
    assert.equal(nodes.get("lnstyle").value, "nt");
    nodes.get("selectall").click();
    handlers.keydown({ key: "3", target: canvas, preventDefault() {} });
    nodes.get("sourceopen").click();
    assert.ok(
      events(parseBMS(nodes.get("source").value)).every(
        (n) => n.channel === "52",
      ),
    );
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("measurelist").children.length, 1000);
    nodes.get("rangefrom").value = "0";
    nodes.get("rangeto").value = "1";
    nodes.get("ratio").value = "0.5";
    nodes.get("beatmode").value = "scale";
    nodes.get("applyrangeratio").click();
    assert.equal(nodes.get("measurelist").children[0].textContent, "000: 0.5 ( 1 / 2 )");
    assert.equal(nodes.get("measurelist").children[1].textContent, "001: 0.5 ( 1 / 2 )");
    nodes.get("undo").click();
    assert.equal(nodes.get("measurelist").children[0].textContent, "000: 1 ( 4 / 4 )");
    assert.equal(nodes.get("measurelist").children[1].textContent, "001: 1 ( 4 / 4 )");
    nodes.get("source").value = "#PLAYER 1\n#03211:01";
    nodes.get("sourceapply").click();
    assert.equal(nodes.get("show2p").checked, false);
    assert.ok(
      Math.abs(
        Number.parseFloat(nodes.get("scrollspace").style.height) -
          ((128 + 2000 / 48) * 48 + 30),
      ) < 1e-6,
    );
    nodes.get("measure").value = "999";
    nodes.get("jump").click();
    assert.equal(
      Number.parseFloat(nodes.get("scrollspace").style.height),
      192030,
    );
    // Leading rests survive copy; focused measure controls route Ctrl+V.
    nodes.get("source").value = "#BPM 120\n#00211:00010000\n#00312:0002";
    nodes.get("sourceapply").click();
    nodes.get("selectall").click();
    key("c", { ctrlKey: true });
    const measureList = nodes.get("measurelist");
    for (const option of measureList.children) option.selected = option.value === "5";
    measureList.onchange();
    key("v", { ctrlKey: true, target: measureList });
    const readBeats = () => {
      nodes.get("sourceopen").click();
      const beats = events(parseBMS(nodes.get("source").value)).map(n => n.beat);
      nodes.get("sourcecancel").click();
      return beats;
    };
    assert.deepEqual(readBeats(), [9, 14, 21, 26]);
    key("Delete");
    assert.deepEqual(readBeats(), [9, 14]);
    nodes.get("undo").click();
    nodes.get("undo").click();
    nodes.get("measure").value = "7";
    key("v", { ctrlKey: true, target: nodes.get("measure") });
    assert.deepEqual(readBeats(), [9, 14, 29, 34]);
    key("v", { ctrlKey: true, target: nodes.get("sample") });
    assert.deepEqual(readBeats(), [9, 14, 29, 34]);
    nodes.get("undo").click();
    nodes.get("tool").value = "select";
    nodes.get("measure").value = "4";
    nodes.get("jump").click();
    nodes.get("viewport").onscroll();
    canvas.onpointerdown({ ...pointer, clientY: 419 });
    canvas.onpointerup({ ...pointer, clientY: 419 });
    key("v", { ctrlKey: true });
    assert.deepEqual(readBeats(), [9, 14, 17, 22]);
    nodes.get("undo").click();
    // Scrolling away from a chosen target restores the upstream viewport anchor.
    nodes.get("measure").value = "8";
    nodes.get("jump").click();
    nodes.get("viewport").onscroll();
    key("v", { ctrlKey: true });
    assert.deepEqual(readBeats(), [9, 14, 33, 38]);
    nodes.get("source").value = "#BPM 120\n#00011:0101\n#00111:02";
    nodes.get("sourceapply").click();
    nodes.get("measure").value = "0";
    nodes.get("measure").onchange();
    nodes.get("beatmode").value = "scale";
    nodes.get("beatnumerator").value = "3";
    nodes.get("beatdenominator").value = "4";
    nodes.get("applysignature").click();
    assert.equal(nodes.get("measurelist").children[0].textContent, "000: 0.75 ( 3 / 4 )");
    assert.deepEqual(readBeats(), [0,1.5,3]);
    assert.match(nodes.get("measurefeedback").textContent, /已更新节拍/);
    nodes.get("undo").click();
    assert.deepEqual(readBeats(), [0,2,4]);
    nodes.get("insertmeasure").click();
    assert.deepEqual(readBeats(), [4,6,8]);
    nodes.get("removemeasure").click();
    assert.deepEqual(readBeats(), [0,2,4]);
    // Park a whole LN on B1, then exercise cancel/confirm through the save button.
    nodes.get("source").value = "#BPM 120\n#00051:01\n#00151:02";
    nodes.get("sourceapply").click();
    nodes.get("lnstyle").value = "nt";
    nodes.get("tool").value = "select";
    key("Home");
    nodes.get("viewport").onscroll();
    const headings = nodes.get("laneheads").children;
    const bIndex = headings.findIndex(n => n.textContent === "B1");
    const widths = nodes.get("laneheads").style.gridTemplateColumns.split(" ").map(parseFloat);
    const bx = widths.slice(0,bIndex).reduce((a,b)=>a+b,0)+10;
    canvas.onpointerdown({ ...pointer, clientY: 425 });
    canvas.onpointerup({ ...pointer, clientX: bx, clientY: 425 });
    nodes.get("saveformat").value = "bms";
    let savedRequest = null, saveCalls = 0, warning = "";
    window.desktop = { save: async request => { savedRequest=request; saveCalls++; return {name:"test.bms"}; } };
    globalThis.confirm = message => { warning = message; return false; };
    await nodes.get("save").onclick();
    assert.match(warning, /BGM.*LN\/CN/);
    assert.equal(saveCalls,0);
    globalThis.confirm = () => true;
    await nodes.get("save").onclick();
    assert.equal(saveCalls,1);
    assert.deepEqual(events(parseBMS(savedRequest.text)).map(n=>[n.channel,n.beat]), [["01",0]]);
    nodes.get("saveformat").value = "ibmsc";
    await nodes.get("save").onclick();
    const {readProject} = await import("../src/project.js");
    const {longPairs} = await import("../src/bms.js");
    assert.equal(longPairs(readProject(savedRequest.bytes)).pairs.length,1);
    // BASE62: preserve distinct cases through definitions, editing and save.
    nodes.get("source").value = "#BASE 62\n#BPM 120\n#WAV0A upper.wav\n#WAV0a lower.ogg\n#00011:0A0a";
    nodes.get("sourceapply").click();
    assert.equal(nodes.get("samples").children.length, 3843);
    assert.ok(nodes.get("samples").children.some(n => n.value === "0a"));
    nodes.get("definitiontype").value = "WAV";
    nodes.get("definitionid").value = "zz";
    nodes.get("definitionvalue").value = "last.ogg";
    nodes.get("definitionapply").click();
    nodes.get("sample").value = "0a";
    nodes.get("sample").onchange();
    assert.equal(nodes.get("sample").value, "0a");
    nodes.get("saveformat").value = "bms";
    await nodes.get("save").onclick();
    const base62Saved = parseBMS(savedRequest.text);
    assert.equal(base62Saved.resources.WAV['0A'], 'upper.wav');
    assert.equal(base62Saved.resources.WAV['0a'], 'lower.ogg');
    assert.equal(base62Saved.resources.WAV.zz, 'last.ogg');
    assert.deepEqual(events(base62Saved).map(e=>e.value), ['0A','0a']);
    nodes.get("findvalue").value = "0a";
    nodes.get("findchannel").value = "11";
    nodes.get("replacevalue").value = "zz";
    nodes.get("replaceall").click();
    await nodes.get("save").onclick();
    assert.deepEqual(events(parseBMS(savedRequest.text)).map(e=>e.value), ['0A','zz']);
    nodes.get("undo").click();
    await nodes.get("save").onclick();
    assert.deepEqual(events(parseBMS(savedRequest.text)).map(e=>e.value), ['0A','0a']);

    nodes.get("saveformat").value = "ibmscx";
    await nodes.get("save").onclick();
    assert.equal(savedRequest.format, "ibmscx");
    const {readPortableProject} = await import("../src/portable-project.js");
    assert.equal(readPortableProject(savedRequest.text).headers.BASE, "62");
    // PMS is a single nine-key field, despite using channels from both BMS groups.
    nodes.get("theme").value = "IIDX";
    nodes.get("theme").onchange();
    const pmsText = "#TITLE Nine keys\n#PLAYER 1\n#BPM 120\n#00011:01\n#00015:02\n#00022:03\n#00025:04";
    const pmsBytes = new TextEncoder().encode(pmsText);
    window.desktop.open = async () => ({name: "Nine.PMS", bytes: pmsBytes, token: "pms"});
    window.desktop.acceptOpen = async () => ({});
    window.desktop.cancelOpen = async () => {};
    await nodes.get("open").click();
    assert.equal(nodes.get("theme").value, "Pomu");
    assert.equal(nodes.get("saveformat").value, "pms");
    assert.equal(nodes.get("secondplayer-option").hidden, true);
    assert.equal(nodes.get("header-player-label").hidden, true);
    assert.equal(nodes.get("show2p").checked, false);
    assert.deepEqual(nodes.get("laneheads").children.slice(4, 13).map(n => n.textContent),
      ["LW", "LY", "LG", "LB", "RED", "RB", "RG", "RY", "RW"]);
    nodes.get("statistics").click();
    assert.deepEqual(nodes.get("statstable").children.slice(3,12).map(row => row.children[0].textContent),
      ["1 LW", "2 LY", "3 LG", "4 LB", "5 RED", "6 RB", "7 RG", "8 RY", "9 RW"]);
    nodes.get("reportclose").click();
    await nodes.get("save").onclick();
    assert.equal(savedRequest.format, "pms");
    assert.equal(savedRequest.name, "Nine keys.pms");
    assert.equal(parseBMS(savedRequest.text).headers.PLAYER, "1");
    assert.equal(events(parseBMS(savedRequest.text)).length, 4);
    window.desktop.open = async () => ({name: "single.bms", bytes: pmsBytes, token: "bms"});
    await nodes.get("open").click();
    assert.equal(nodes.get("theme").value, "IIDX");
    assert.equal(nodes.get("saveformat").value, "bms");
    assert.equal(nodes.get("secondplayer-option").hidden, false);
    // Browser opening uses the same defaults, and manual theme changes take precedence.
    nodes.get("file").files = [{name: "browser.pms", arrayBuffer: async () => pmsBytes.buffer}];
    await nodes.get("file").onchange();
    assert.equal(nodes.get("saveformat").value, "pms");
    assert.equal(nodes.get("theme").value, "Pomu");
    nodes.get("theme").value = "IIDX";
    nodes.get("theme").onchange();
    assert.equal(nodes.get("saveformat").value, "pms");
    nodes.get("about").click();
    assert.match(nodes.get("reporttext").textContent, /MusicGameLAB/);

    // Status follows the current pane and the actual note, not the nearest grid.
    nodes.get("reportclose").click();
    nodes.get("theme").value = "";
    nodes.get("theme").onchange();
    nodes.get("source").value = "#BPM 120\n#00051:01010000\n#00008:0001";
    nodes.get("sourceapply").click();
    nodes.get("zoom").value = "1";
    nodes.get("zoom").onchange();
    nodes.get("grid").value = "16";
    nodes.get("snap").checked = true;
    nodes.get("tool-select").click();
    const laneWidths = nodes.get("laneheads").style.gridTemplateColumns.split(" ").map(parseFloat);
    const laneX = title => {
      const index = nodes.get("laneheads").children.findIndex(n => n.textContent === title);
      return laneWidths.slice(0, index).reduce((a, b) => a + b, 0) + 10;
    };
    const hover = (beat, title = "A1", paneCanvas = canvas, paneView = view) => {
      const totalHeight = parseFloat(nodes.get("scrollspace").style.height);
      paneView.scrollTop = totalHeight - paneView.clientHeight;
      paneView.onscroll();
      const e = { ...pointer, currentTarget: paneCanvas, clientX: laneX(title),
        clientY: totalHeight - 20 - beat * 48 - paneView.scrollTop };
      paneCanvas.onpointermove(e);
      return e;
    };
    hover(2);
    assert.equal(nodes.get("status-column").textContent, "A1");
    assert.equal(nodes.get("status-measure").textContent, "000");
    assert.equal(nodes.get("status-grid").textContent, "8 / 16");
    assert.equal(nodes.get("status-reduced").textContent, "1 / 2");
    assert.equal(nodes.get("status-measurePosition").textContent, "96 / 192");
    assert.equal(nodes.get("status-absolute").textContent, "96");
    hover(0.5, "A2"); // Inside the long-note body: show its start and full length.
    assert.equal(nodes.get("status-note").textContent, "01");
    assert.equal(nodes.get("status-absolute").textContent, "0");
    assert.equal(nodes.get("status-length").textContent, "长度 = 48");
    hover(1, "A2"); // NT endpoint belongs to the same long note.
    assert.equal(nodes.get("status-absolute").textContent, "0");
    nodes.get("lnstyle").value = "bmse";
    hover(1, "A2");
    assert.equal(nodes.get("status-absolute").textContent, "48");
    assert.equal(nodes.get("status-length").textContent, "长音符");
    nodes.get("lnstyle").value = "nt";
    nodes.get("split-left").checked = true;
    nodes.get("split-left").onchange();
    hover(3, "A1", nodes.get("chart-left"), nodes.get("view-left"));
    assert.equal(nodes.get("status-absolute").textContent, "144");
    nodes.get("tool-write").click();
    nodes.get("sample").value = "0A";
    hover(0.52, "A2");
    assert.equal(nodes.get("status-absolute").textContent, "24");
    assert.equal(nodes.get("status-note").textContent, "0A");
    nodes.get("tool-time").click();
    assert.equal(nodes.get("positionstatus").hidden, true);
    const timeStart = hover(2, "A1");
    canvas.onpointerdown(timeStart);
    canvas.onpointermove({ ...timeStart, clientY: timeStart.clientY - 48 });
    assert.equal(nodes.get("status-time-start").textContent, "96");
    assert.equal(nodes.get("status-time-length").textContent, "48");
    assert.equal(nodes.get("status-time-half").textContent, "24");
    canvas.onpointerup({ ...timeStart, clientY: timeStart.clientY - 48 });
    nodes.get("tool-select").click();
    assert.equal(nodes.get("positionstatus").hidden, false);
    assert.equal(nodes.get("timestatus").hidden, true);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
