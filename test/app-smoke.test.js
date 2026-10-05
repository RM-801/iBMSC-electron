// Pure Node unit harness: no browser, local-origin navigation, or network access.
import { test } from "node:test";
import { parseBMS, events } from "../src/bms.js";
import assert from "node:assert/strict";
import { createTranslator } from "../src/localization.js";
import { readFile } from "node:fs/promises";
test("controller initializes and routes document edits, history, columns and source actions", async () => {
  const html = await readFile(
      new URL("../index.html", import.meta.url),
      "utf8",
    ),
    nodes = new Map(),
    handlers = {};
  let paintCalls = null;
  const intervals = [];
  const timeouts = [];
  const holdTouch = () => {
    const timer = timeouts.findLast(t => t.milliseconds === 450 && !t.cleared);
    assert.ok(timer, "a touch hold is pending");
    timer.cleared = true;
    timer.callback();
  };
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
          get: (context, key) =>
            key === "measureText"
              ? text => ({ width: text.length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 6 })
              : key === "createLinearGradient"
              ? () => ({ addColorStop() {} })
              : (...args) => { if (paintCalls) paintCalls.push({ canvas: this.id, op: key, args, fill: context.fillStyle, stroke: context.strokeStyle, font: context.font }); },
        },
      );
    }
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        bottom: this.clientHeight,
        width: this.clientWidth,
        height: this.clientHeight,
      };
    }
    addEventListener(name, fn, options) {
      this["event-options-" + name] = options;
      this["event-" + name] = fn;
    }
    focus() { document.activeElement = this; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    showPopover() { this.popoverOpen = true; }
    hidePopover() { this.popoverOpen = false; }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
    click() {
      if (!this.disabled)
        return this.onclick?.({ currentTarget: this, target: this, preventDefault() {} });
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
    body: new Element("body"),
    getElementById: (id) => nodes.get(id),
    createElement: (tag) => new Element(tag),
    querySelectorAll: () => [],
    querySelector: () =>
      [...nodes.values()].find((e) => e.tagName === "DIALOG" && e.open) || null,
  };
  const prior = {};
  for (const key of [
    "localStorage",
    "document",
    "window",
    "ResizeObserver",
    "devicePixelRatio",
    "setInterval",
    "clearInterval",
    "setTimeout",
    "clearTimeout",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "confirm",
    "AudioContext",
  ])
    prior[key] = globalThis[key];
  try {
    Object.assign(globalThis, {
      localStorage: { data: new Map([["ibmsc-preferences", JSON.stringify({ Player: { UseExternalPreview: "True" } })]]), getItem(key) { return this.data.get(key) ?? null; }, setItem(key,value) { this.data.set(key,String(value)); } },
      document,
      window: {
        innerWidth: 1280,
        innerHeight: 800,
        addEventListener: (name, fn) => (handlers[name] = fn),
      },
      ResizeObserver: class {
        observe() {}
      },
      devicePixelRatio: 1,
      setInterval: (callback, milliseconds) => { intervals.push({ callback, milliseconds }); return intervals.length; },
      clearInterval: id => { if (intervals[id - 1]) intervals[id - 1].cleared = true; },
      setTimeout: (callback, milliseconds) => { timeouts.push({ callback, milliseconds }); return timeouts.length; },
      clearTimeout: id => { if (timeouts[id - 1]) timeouts[id - 1].cleared = true; },
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      confirm: () => true,
    });
    await import("../src/app.js");
    assert.equal(nodes.get("language").value, "eng", "English is the fallback without a system language");
    assert.equal(nodes.get("language-menu").children.find(n => n["aria-checked"] === "true").dataset.language, "eng");
    assert.deepEqual(nodes.get("language-menu").children.map(n => n.dataset.language), ["eng", "chs", "jpn", "kor"]);
    assert.equal(localStorage.getItem("ibmsc-language"), null, "automatic language selection is not saved as a manual choice");
    nodes.get("language").value = "chs";
    nodes.get("language").onchange();
    const modeChoices = () => nodes.get("chartmode").children.map(n => [n.value, n.textContent]);
    const modernChoices = [["SINGLE", "SINGLE"], ["DOUBLE", "DOUBLE"], ["PMS", "PMS"]];
    const chooseMode = mode => { nodes.get("chartmode").value = mode; nodes.get("chartmode").onchange(); };
    const sourceHeaders = () => { nodes.get("sourceopen").click(); const result = parseBMS(nodes.get("source").value).headers; nodes.get("sourcecancel").click(); return result; };
    assert.equal(nodes.has("header-PLAYER"), false);
    assert.equal(nodes.get("chartmode").value, "SINGLE");
    assert.deepEqual(modeChoices(), modernChoices);
    assert.equal(sourceHeaders().PLAYER, "1");
    assert.equal(Number(nodes.get("zoom").value), 4);
    assert.equal(nodes.has("show2p"), false);
    assert.equal(nodes.get("theme").value, "IIDX");
    assert.equal(nodes.get("laneheads").style.color, "rgba(0,255,0,1)");
    assert.ok(nodes.get("theme").children.every(option => option.value !== ""));
    assert.equal(nodes.get("verticaloff").checked, true);
    assert.equal(nodes.get("previewclick").checked, true);
    // View changes update the UI and preferences without editing the chart/history.
    const titleBeforeView = document.title;
    const undoBeforeView = nodes.get("undo").disabled;
    for (const [flag, target] of [["show-menu", "main-menu-bar"], ["show-toolbar", "main-toolbar"],
      ["show-options", "options-panel"], ["show-status", "status-bar"]]) {
      nodes.get(flag).checked = false; nodes.get(flag).onchange();
      assert.equal(nodes.get(target).hidden, true);
      nodes.get(flag)["event-change"]();
    }
    assert.equal(nodes.get("options-resizer").hidden, true);
    const savedViews = JSON.parse(localStorage.getItem("ibmsc-preferences")).ShowHide;
    for (const key of ["showMenu", "showTB", "showOpPanel", "showStatus"])
      assert.equal(savedViews[key], "False");
    const viewKey = key => handlers.keydown({ key, target: nodes.get("chart"), preventDefault() {} });
    viewKey("F10");
    assert.equal(nodes.get("viewmenu").popoverOpen, true, "hidden toolbar remains recoverable");
    viewKey("Escape");
    assert.equal(nodes.get("viewmenu").popoverOpen, false);
    for (const flag of ["show-menu", "show-toolbar", "show-options", "show-status"]) {
      nodes.get(flag).checked = true; nodes.get(flag).onchange();
    }
    nodes.get("toggle-options").click();
    assert.equal(nodes.get("show-options").checked, false);
    nodes.get("toggle-options").click();
    assert.equal(nodes.get("options-panel").hidden, false);
    nodes.get("view-toggle").click();
    assert.equal(nodes.get("viewmenu").popoverOpen, true);
    nodes.get("view-toggle").click();
    assert.equal(nodes.get("viewmenu").popoverOpen, false);
    // Blank-canvas right click does nothing; note deletion is covered below.
    nodes.get("chart").oncontextmenu({ currentTarget: nodes.get("chart"), clientX: 600,
      clientY: 100, preventDefault() {} });
    assert.equal(nodes.get("viewmenu").popoverOpen, false);
    nodes.get("showcolumncaption").checked = false; nodes.get("showcolumncaption").onchange();
    for (const id of ["laneheads", "heads-left", "heads-right"]) assert.equal(nodes.get(id).hidden, true);
    nodes.get("showcolumncaption").checked = true; nodes.get("showcolumncaption").onchange();
    const savedViewTop = nodes.get("viewport").scrollTop;
    nodes.get("viewport").scrollTop -= nodes.get("viewport").clientHeight;
    const visualFlags = ["showgrid", "showsubgrid", "showbackground", "showmeasureindex", "showmeasureline", "showvertical"];
    for (const flag of visualFlags) nodes.get(flag).checked = false;
    paintCalls = []; nodes.get("showbackground").onchange();
    assert.equal(paintCalls.filter(c => c.op === "fillRect").length, 1, "canvas base is always painted");
    assert.equal(paintCalls.filter(c => ["stroke", "fillText"].includes(c.op)).length, 0);
    for (const [flag, operation] of [["showgrid", "stroke"], ["showsubgrid", "stroke"],
      ["showmeasureline", "stroke"], ["showvertical", "stroke"], ["showmeasureindex", "fillText"]]) {
      nodes.get(flag).checked = true;
      paintCalls = []; nodes.get(flag).onchange();
      assert.ok(paintCalls.some(c => c.op === operation), flag + " works independently");
      nodes.get(flag).checked = false;
    }
    nodes.get("showbackground").checked = true;
    paintCalls = []; nodes.get("showbackground").onchange();
    assert.ok(paintCalls.filter(c => c.op === "fillRect").length > 1, "lane backgrounds return");
    paintCalls = null;
    for (const flag of visualFlags) nodes.get(flag).checked = true;
    nodes.get("showgrid").onchange();
    nodes.get("viewport").scrollTop = savedViewTop;
    assert.equal(document.title, titleBeforeView);
    assert.equal(nodes.get("undo").disabled, undoBeforeView);
    // Existing movement scenarios explicitly enable vertical movement.
    nodes.get("verticaloff").checked = false;
    nodes.get("theme").value = "IIDX";
    nodes.get("theme").onchange();
    for (const id of ["laneheads", "heads-left", "heads-right"]) {
      assert.equal(nodes.get(id).style.color, "rgba(0,255,0,1)");
      assert.equal(nodes.get(id).style.backgroundColor, "rgba(0,0,0,1)");
    }
    nodes.get("displaysettings").click();
    nodes.get("themeedit-ok").click();
    assert.equal(nodes.get("theme").value, "IIDX", "unchanged preset stays a preset");
    nodes.get("theme").value = "IIDX";
    nodes.get("theme").onchange();
    assert.equal(nodes.get("laneheads").style.backgroundColor, "rgba(0,0,0,1)");
    // Theme drafts never touch the document, and Cancel discards every edit.
    nodes.get("sourceopen").click();
    const documentBeforeTheme = nodes.get("source").value;
    nodes.get("sourcedialog").close();
    nodes.get("displaysettings").click();
    nodes.get("themeedit-column-Width").value = "95";
    nodes.get("themeedit-column-Width").oninput();
    nodes.get("themeedit-cancel").click();
    assert.equal(nodes.get("theme").value, "IIDX");
    assert.equal(JSON.parse(localStorage.getItem("ibmsc-theme")).columns[4].Width, "60");
    nodes.get("displaysettings").click();
    assert.notEqual(Number(nodes.get("themeedit-column-Width").value), 95);
    nodes.get("themeedit-column-Width").value = "1000";
    nodes.get("themeedit-ok").click();
    assert.equal(nodes.get("displaysettingsdialog").open, true);
    assert.equal(nodes.get("themeedit-error").hidden, false);
    assert.equal(JSON.parse(localStorage.getItem("ibmsc-theme")).columns[4].Width, "60");
    nodes.get("themeedit-column-Width").value = "95";
    nodes.get("themeedit-column-Title").value = "My lane";
    nodes.get("themeedit-ColumnTitle").value = "#123456";
    nodes.get("themeedit-ok").click();
    assert.equal(nodes.get("displaysettingsdialog").open, false);
    assert.equal(nodes.get("theme").value, "custom");
    const custom = JSON.parse(localStorage.getItem("ibmsc-custom-theme"));
    assert.equal(Number(custom.columns[4].Width), 95);
    assert.equal(custom.columns[4].Title, "My lane");
    assert.equal(nodes.get("laneheads").style.color, "rgba(18,52,86,1)");
    nodes.get("theme").value = "IIDX"; nodes.get("theme").onchange();
    nodes.get("theme").value = "custom"; nodes.get("theme").onchange();
    assert.equal(nodes.get("laneheads").style.color, "rgba(18,52,86,1)");
    nodes.get("sourceopen").click();
    assert.equal(nodes.get("source").value, documentBeforeTheme);
    nodes.get("sourcedialog").close();
    nodes.get("theme").value = "IIDX"; nodes.get("theme").onchange();
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
    // Opening a BMS exposes extension directives, then edits/undo update the saved text.
    nodes.get("source").value = "* HEADER FIELD\n#TITLE Test\n#BMP01 movie.mpg\n#CUSTOM first\n#CUSTOM second\n#001D1:0100\n#00004:01\n";
    nodes.get("sourceapply").click();
    const importedExpansion = "#BMP01 movie.mpg\n#CUSTOM first\n#CUSTOM second\n#001D1:0100";
    assert.equal(nodes.get("expansion").value, importedExpansion);
    const editedExpansion = importedExpansion.replace("#BMP01 movie.mpg\n", "");
    nodes.get("expansion").value = editedExpansion;
    nodes.get("expansion").oninput();
    nodes.get("expansion").onblur();
    nodes.get("sourceopen").click();
    assert.ok(!nodes.get("source").value.includes("#BMP01"));
    assert.ok(nodes.get("source").value.indexOf("#CUSTOM first") < nodes.get("source").value.indexOf("#00004:01"));
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("expansion").value, importedExpansion);
    nodes.get("redo").click();
    assert.equal(nodes.get("expansion").value, editedExpansion);
    nodes.get("undo").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("expansion").value, expansionBefore);
    const browseModes = [];
    window.desktop = { chooseSounds: async multiple => { browseModes.push(multiple); return []; } };
    await nodes.get("samples").ondblclick();
    await nodes.get("wavbrowse").click();
    assert.deepEqual(browseModes, [false, true]);
    delete window.desktop;
    nodes.get("toggleln").click();
    assert.equal(nodes.get("lnstyle").value, "bmse");
    assert.equal(nodes.get("toggleln")["aria-checked"], "false");
    nodes.get("toggleln").click();
    assert.equal(nodes.get("lnstyle").value, "nt");
    nodes.get("statistics").click();
    assert.equal(nodes.get("statstable").hidden, false);
    assert.equal(nodes.get("statstable").children.length, 15);
    assert.deepEqual(nodes.get("statstable").children.slice(3,11).map(row=>row.children[0].textContent),
      ["A1","A2","A3","A4","A5","A6","A7","A8"]);
    nodes.get("reportclose").click();
    nodes.get("chartmode").value = "DOUBLE";
    nodes.get("chartmode").onchange();
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
    assert.ok(Number.parseFloat(nodes.get("scrollspace").style.height) < 3000);
    assert.ok(
      !nodes.get("laneheads").children.some((n) => n.textContent === "D1"),
    );
    nodes.get("chartmode").value = "DOUBLE";
    nodes.get("chartmode").onchange();
    assert.ok(
      nodes.get("laneheads").children.some((n) => n.textContent === "D8"),
    );
    nodes.get("undo").click();

    for (const name of ["RANK", "DIFFICULTY"])
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
    // The view field follows final rendered lanes, but automatic fill is not a saved minimum.
    const visibleBgm = () => nodes.get("laneheads").children.filter(n => /^B[0-9]+$/.test(n.textContent)).length;
    const savedBgmViewTitle = document.title;
    const savedBgmViewUndo = nodes.get("undo").disabled;
    nodes.get("viewport").clientWidth = 1900;
    nodes.get("widthzoom").onchange();
    assert.ok(visibleBgm() > 15);
    assert.equal(Number(nodes.get("bgmcount").value), visibleBgm());
    nodes.get("showcolumncaption")["event-change"]();
    assert.equal(JSON.parse(localStorage.getItem("ibmsc-preferences")).Grid.gCol, "15");
    nodes.get("viewport").clientWidth = 700;
    nodes.get("widthzoom").onchange();
    assert.equal(Number(nodes.get("bgmcount").value), 15, "shrinking restores the configured minimum");
    nodes.get("widthzoom").value = "0.25";
    nodes.get("widthzoom").onchange();
    assert.ok(visibleBgm() > 15);
    assert.equal(Number(nodes.get("bgmcount").value), visibleBgm());
    nodes.get("widthzoom").value = "1";
    nodes.get("widthzoom").onchange();
    assert.equal(Number(nodes.get("bgmcount").value), 15);
    assert.equal(document.title, savedBgmViewTitle);
    assert.equal(nodes.get("undo").disabled, savedBgmViewUndo);
    let numberKeyPrevented = false;
    nodes.get("viewmenu")["event-keydown"]({key:"ArrowUp", target:{type:"number"}, preventDefault(){numberKeyPrevented=true;}});
    assert.equal(numberKeyPrevented, false, "view menu leaves number spin keys to the input");
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
    nodes.get("chartmode").value = "SINGLE";
    nodes.get("chartmode").onchange();
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
    finishSave({ name: "Smoke.bms", encoding: "shift_jis" });
    await save;
    assert.equal(nodes.get("encoding").value, "shift_jis");
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
    assert.equal(nodes.get("encoding").value, "utf8");
    assert.deepEqual(tokens, ["accepted", "cancel:accepted"]);
    assert.equal(nodes.get("recentfiles").children.length, 1);
    window.desktop.open = async () => ({
      name: "broken.ibmsc",
      bytes: new Uint8Array([1]),
      token: "rejected",
    });
    await nodes.get("open").click();
    assert.equal(nodes.get("project").textContent, "Recent");
    assert.equal(nodes.get("encoding").value, "utf8");
    assert.deepEqual(tokens, [
      "accepted",
      "cancel:accepted",
      "cancel:rejected",
    ]);
    const requestedAssets = [], auditionVoices = [];
    globalThis.AudioContext = class {
      destination = {};
      currentTime = 0;
      async resume() {}
      createBuffer(channels, length, sampleRate) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate,
          copyToChannel(samples, channel) { data[channel].set(samples); },
          getChannelData(channel) { return data[channel]; } };
      }
      createBufferSource() {
        const voice = { stops: 0, starts: [], connect() {}, disconnect() {}, start(...args) { this.starts.push(args); }, stop() { this.stops++; } };
        auditionVoices.push(voice);
        return voice;
      }
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

    // Legacy external-preview preferences cannot redirect toolbar or F5/F6/F7 playback.
    nodes.get("source").value = "#BPM 120\n#WAV01 sound\\kick.wav\n#00011:01\n#00111:01";
    nodes.get("sourceapply").click();
    nodes.get("measure").value = "1";
    const checkPlayback = async (trigger, beat) => {
      const before = auditionVoices.length;
      await trigger();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(auditionVoices.length, before + 1, "built-in audio schedules a voice");
      assert.deepEqual(auditionVoices.at(-1).starts, [[0.1, 0]]);
      assert.equal(nodes.get("playstatus").textContent, "播放中，从第 " + beat.toFixed(3) + " 拍开始");
      viewKey("F7");
      assert.equal(auditionVoices.at(-1).stops, 1);
      assert.equal(nodes.get("playstatus").textContent, "");
    };
    await checkPlayback(() => nodes.get("play").click(), 0);
    await checkPlayback(() => nodes.get("playhere").click(), 4);
    await checkPlayback(() => viewKey("F5"), 0);
    await checkPlayback(() => viewKey("F6"), 4);

    // Real compressed bytes must load even though the native decoder rejects ADPCM.
    // This covers the desktop PMS path, browser file association and waveform input.
    const adpcm = Buffer.from("524946463600000057415645666d74201a0000000200010044ac00008858010008000400080004000100000100006461746108000000001000e803840312", "hex");
    const nativeDecode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = () => { throw Error("Native ADPCM unsupported"); };
    window.desktop.open = async () => ({ name: "compressed.pms", token: "adpcm",
      bytes: new TextEncoder().encode("#BPM 120\n#WAV01 sample.wav\n#00011:01") });
    window.desktop.asset = async () => new Uint8Array(adpcm);
    await nodes.get("open").click();
    assert.equal(nodes.get("soundstatus").textContent, "音源已关联：1 个；未能加载：0 个");
    assert.equal(nodes.get("sounderrors").hidden, true);
    assert.ok(nodes.get("samples").children[0].textContent.includes("✓"));
    const adpcmFile = { name: "sample.wav", size: adpcm.length,
      arrayBuffer: async () => new Uint8Array(adpcm).buffer };
    nodes.get("sounds").files = [adpcmFile];
    await nodes.get("sounds").onchange();
    assert.equal(nodes.get("status").textContent, "已加载 1 个音源；失败 0 个");
    nodes.get("wavefile").files = [adpcmFile];
    await nodes.get("wavefile").onchange();
    assert.equal(nodes.get("overlayname").textContent, "sample.wav");
    AudioContext.prototype.decodeAudioData = nativeDecode;

    delete window.desktop;
    // Folder selection associates existing definitions by path, without importing
    // unrelated files or decoding the same file again for case variants.
    assert.equal(nodes.get("audiofolder").hidden, false);
    let folderPickerOpened = 0, filesPickerOpened = 0;
    nodes.get("soundfolder").onclick = () => folderPickerOpened++;
    nodes.get("sounds").onclick = () => filesPickerOpened++;
    nodes.get("audiofolder").click();
    assert.equal(filesPickerOpened, 1, "older browsers retain the file picker fallback");
    assert.match(nodes.get("status").textContent, /不支持选择文件夹/);
    nodes.get("soundfolder").webkitdirectory = true;
    nodes.get("audiofolder").click();
    assert.equal(folderPickerOpened, 1);
    nodes.get("source").value = "#TITLE Folder\n#BPM 120\n#WAV01 sound\\kick.wav\n#WAV02 pad/kick.wav\n#WAV03 sound/snare.wav\n#WAV04 SOUND/KICK.WAV\n#WAV05 missing.wav";
    nodes.get("sourceapply").click();
    const readFiles = [];
    const soundFile = (path, value) => ({
      name: path.split("/").at(-1), webkitRelativePath: path,
      arrayBuffer: async () => { readFiles.push(path); return new Uint8Array([value]).buffer; },
    });
    const folderFiles = [soundFile("Song/sound/kick.wav", 11), soundFile("Song/pad/kick.wav", 22),
      soundFile("Song/sound/snare.ogg", 33), soundFile("Song/background.png", 44),
      soundFile("Song/unused.wav", 55)];
    nodes.get("sourceopen").click();
    const sourceBeforeFolder = nodes.get("source").value;
    nodes.get("sourcecancel").click();
    const historyBeforeFolder = [nodes.get("undo").disabled, nodes.get("redo").disabled, document.title];
    nodes.get("soundfolder").files = folderFiles;
    nodes.get("soundfolder").value = "chosen";
    await nodes.get("soundfolder").onchange();
    assert.equal(nodes.get("soundfolder").value, "", "same folder can be selected again");
    assert.deepEqual(readFiles, folderFiles.slice(0, 3).map(file => file.webkitRelativePath));
    assert.equal(nodes.get("soundstatus").textContent, "音源已关联：4 个；未能加载：1 个");
    assert.match(nodes.get("sounderrorlist").textContent, /missing.wav：未找到音源文件/);
    nodes.get("sourceopen").click();
    assert.equal(nodes.get("source").value, sourceBeforeFolder);
    nodes.get("sourcecancel").click();
    assert.deepEqual([nodes.get("undo").disabled, nodes.get("redo").disabled, document.title], historyBeforeFolder);
    const auditionByte = async id => {
      nodes.get("sample").value = id;
      nodes.get("samples").onclick();
      await new Promise(resolve => setImmediate(resolve));
      return new Uint8Array(auditionVoices.at(-1).buffer.bytes)[0];
    };
    assert.equal(await auditionByte("01"), 11);
    assert.equal(await auditionByte("02"), 22, "same basename in another folder retains its own audio");
    assert.equal(await auditionByte("03"), 33, "WAV reference may resolve to OGG audio");
    nodes.get("soundfolder").files = [];
    const reportBeforeCancel = nodes.get("soundstatus").textContent;
    await nodes.get("soundfolder").onchange();
    assert.equal(nodes.get("soundstatus").textContent, reportBeforeCancel);

    // A later selection or a new chart must not receive an older pending decode.
    let finishFolderRead;
    const slowFile = { ...folderFiles[0], arrayBuffer: () => new Promise(resolve => { finishFolderRead = resolve; }) };
    nodes.get("soundfolder").files = [slowFile];
    const oldFolderLoad = nodes.get("soundfolder").onchange();
    await new Promise(resolve => setImmediate(resolve));
    nodes.get("soundfolder").files = [soundFile("Song/sound/kick.wav", 77)];
    await nodes.get("soundfolder").onchange();
    finishFolderRead(new Uint8Array([66]).buffer);
    await oldFolderLoad;
    assert.equal(await auditionByte("01"), 77);
    assert.equal(nodes.get("samples").children[1].textContent.includes("✓"), false,
      "missing sounds from a replacement folder do not retain stale buffers");
    nodes.get("soundfolder").files = [slowFile];
    const obsoleteFolderLoad = nodes.get("soundfolder").onchange();
    await new Promise(resolve => setImmediate(resolve));
    await nodes.get("new").click();
    finishFolderRead(new Uint8Array([88]).buffer);
    await obsoleteFolderLoad;
    assert.equal(nodes.get("soundstatus").textContent, "");
    assert.ok(nodes.get("samples").children.every(option => !option.textContent.includes("✓")));
    nodes.get("source").value = "#BPM 120\n#WAV01 sound/kick.wav";
    nodes.get("sourceapply").click();
    nodes.get("soundfolder").files = [slowFile];
    const replacedFolderLoad = nodes.get("soundfolder").onchange();
    await new Promise(resolve => setImmediate(resolve));
    nodes.get("sounds").files = [soundFile("kick.wav", 99)];
    await nodes.get("sounds").onchange();
    finishFolderRead(new Uint8Array([88]).buffer);
    await replacedFolderLoad;
    assert.match(nodes.get("soundstatus").textContent, /^已加载/);
    assert.equal(nodes.get("sounderrors").hidden, true);
    assert.equal(await auditionByte("01"), 99);
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
    assert.equal(nodes.get("soundstatus").textContent, "", "a newly opened chart clears the previous sound report");
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
    nodes.get("bgmcount")["event-change"]();
    assert.equal(JSON.parse(localStorage.getItem("ibmsc-preferences")).Grid.gCol, "8");
    await handlers.drop({
      dataTransfer: { files: [droppedFile] },
      preventDefault() {},
    });
    assert.equal(Number(nodes.get("bgmcount").value), 8);
    nodes.get("bgmcount").value = "15"; nodes.get("bgmcount").onchange();
    await nodes.get("new").click();
    assert.equal(nodes.get("soundstatus").textContent, "");
    assert.equal(nodes.get("sounderrors").hidden, true);
    const view = nodes.get("viewport"),
      canvas = nodes.get("chart");
    const nativeSelection = () => ({ cancelable: true, prevented: false,
      preventDefault() { this.prevented = true; } });
    const selectEvent = nativeSelection();
    nodes.get("editorpanes")["event-selectstart"](selectEvent);
    assert.equal(selectEvent.prevented, true, "chart DOM text selection is suppressed");
    for (const id of ["chart", "chart-left", "chart-right"]) {
      const target = nodes.get(id);
      for (const event of ["touchstart", "touchmove"]) {
        assert.equal(target["event-options-" + event].passive, false);
        const touchEvent = nativeSelection();
        target["event-" + event](touchEvent);
        assert.equal(touchEvent.prevented, true, id + " blocks native touch selection and callout");
        target["event-" + event]({ cancelable: false, preventDefault() { assert.fail("non-cancelable events must be left alone"); } });
      }
    }
    for (const id of ["title", "expansion", "source"])
      assert.equal(nodes.get(id)["event-selectstart"], undefined, "text fields retain native selection");
    view.scrollTop =
      Number.parseFloat(nodes.get("scrollspace").style.height) -
      view.clientHeight;
    view.onscroll();
    nodes.get("tool").value = "write";
    canvas.focus();
    const pointerWidths = nodes.get("laneheads").style.gridTemplateColumns.split(" ").map(parseFloat);
    const pointerColumn = nodes.get("laneheads").children.findIndex(n => n.textContent === "A2");
    const pointerX = pointerWidths.slice(0, pointerColumn).reduce((a, b) => a + b, 0) + pointerWidths[pointerColumn] / 2;
    const pointer = {
      button: 0,
      currentTarget: canvas,
      clientX: pointerX,
      clientY: 425,
      pointerId: 1,
    };
    const touch = { ...pointer, pointerType: "touch", preventDefault() {} };
    const bottom = () => Number.parseFloat(nodes.get("scrollspace").style.height) - view.clientHeight;
    const resetTouchView = () => { view.scrollLeft = 0; view.scrollTop = bottom(); view.onscroll(); };
    const initialTitle = document.title;
    canvas.onpointerdown(touch);
    canvas.onpointermove({ ...touch, clientY: 480 });
    canvas.onpointerup({ ...touch, clientY: 480 });
    assert.equal(view.scrollTop, bottom() - 55, "one finger pans instead of writing");
    assert.equal(nodes.get("count").textContent, "0");
    assert.equal(document.title, initialTitle);
    assert.equal(nodes.get("undo").disabled, true);
    resetTouchView();
    canvas.onpointerdown(touch); canvas.onpointerup(touch);
    assert.equal(nodes.get("count").textContent, "1", "a tap writes once even on the first touch");
    canvas.oncontextmenu({ ...touch, button: 2 });
    assert.equal(nodes.get("count").textContent, "1", "touch context menu never deletes");
    nodes.get("undo").click();
    resetTouchView();
    canvas.onpointerdown(touch); holdTouch();
    canvas.onpointermove({ ...touch, clientY: 329 });
    const secondTouch = { ...touch, pointerId: 2, clientX: touch.clientX + 80, clientY: 329 };
    canvas.onpointerdown(secondTouch);
    canvas.onpointermove({ ...secondTouch, clientX: secondTouch.clientX + 80 });
    assert.equal(Number(nodes.get("editorzoom").value), 200, "pinch scales the whole editor");
    canvas.onpointerup({ ...secondTouch, clientX: secondTouch.clientX + 80 });
    canvas.onpointermove({ ...touch, clientY: 300 });
    canvas.onpointerup({ ...touch, clientY: 300 });
    assert.equal(nodes.get("count").textContent, "0", "pinch cancels pending long-note edits");
    assert.equal(nodes.get("undo").disabled, true);
    assert.equal(JSON.parse(localStorage.getItem("ibmsc-preferences")).Grid.EditorZoom, "200");
    nodes.get("editorzoom").value = "100"; nodes.get("editorzoom").onchange();
    resetTouchView();
    // Immediate-write lanes and BMSE must also wait for a tap before mutating.
    const bgmIndex = nodes.get("laneheads").children.findIndex(n => n.textContent === "B1");
    const bgmX = pointerWidths.slice(0, bgmIndex).reduce((a, b) => a + b, 0) + 5;
    const bgmTouch = { ...touch, clientX: bgmX };
    canvas.onpointerdown(bgmTouch);
    canvas.onpointermove({ ...bgmTouch, clientY: 470 });
    canvas.onpointerup({ ...bgmTouch, clientY: 470 });
    assert.equal(nodes.get("undo").disabled, true);
    resetTouchView();
    canvas.onpointerdown(touch); canvas.onpointerup(touch);
    nodes.get("tool-select").click();
    const boxStart = { ...touch, clientX: pointerX - 25, clientY: 395 };
    const boxEnd = { ...touch, clientX: pointerX + 25, clientY: 440 };
    canvas.onpointerdown(boxStart); holdTouch();
    canvas.onpointermove(boxEnd); canvas.onpointerup(boxEnd);
    nodes.get("deletenotes").click();
    assert.equal(nodes.get("count").textContent, "0", "holding blank space then dragging selects notes for deletion");
    nodes.get("undo").click();
    nodes.get("sourceopen").click();
    const beforeTouchMove = events(parseBMS(nodes.get("source").value))[0].channel;
    nodes.get("sourcecancel").click();
    canvas.onpointerdown(touch); holdTouch();
    const movedTouch = { ...touch, clientX: pointerX + pointerWidths[pointerColumn] };
    canvas.onpointermove(movedTouch); canvas.onpointerup(movedTouch);
    nodes.get("sourceopen").click();
    assert.notEqual(events(parseBMS(nodes.get("source").value))[0].channel, beforeTouchMove, "hold then drag moves a note");
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    nodes.get("undo").click();
    assert.equal(nodes.get("count").textContent, "0");
    nodes.get("tool-write").click();
    resetTouchView();
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
    nodes.get("findopen").click();
    assert.equal(nodes.get("find-label-to").value, "zz");
    nodes.get("find-label-from").value = "0a";
    nodes.get("find-label-to").value = "0a";
    nodes.get("find-columns-none").click();
    nodes.get("find-column-5").click();
    nodes.get("find-select").click();
    nodes.get("copynotes").click();
    assert.equal(nodes.get("status").textContent, "已复制 1 个音符");
    nodes.get("find-delete").click();
    nodes.get("sourceopen").click();
    assert.deepEqual(events(parseBMS(nodes.get("source").value)).map(e=>e.value), ['0A']);
    nodes.get("sourcedialog").close();
    nodes.get("undo").click();
    nodes.get("find-label-replacement").value = "zz";
    nodes.get("find-replace-label").click();
    nodes.get("findclose").click();
    await nodes.get("save").onclick();
    assert.deepEqual(events(parseBMS(savedRequest.text)).map(e=>e.value), ['0A','zz']);
    nodes.get("undo").click();
    await nodes.get("save").onclick();
    assert.deepEqual(events(parseBMS(savedRequest.text)).map(e=>e.value), ['0A','0a']);

    // Ctrl+F offers explicit selected-note deletion separately from original live filtering.
    const restoreFindChart = savedRequest.text;
    const setFindFlag = (name, value) => {
      const control = nodes.get("find-" + name);
      if (control["aria-pressed"] !== String(value)) control.click();
    };
    const findValues = () => {
      nodes.get("sourceopen").click();
      const values = events(parseBMS(nodes.get("source").value)).map(n => n.value);
      nodes.get("sourcedialog").close(); return values;
    };
    nodes.get("source").value = "#BPM 120\n#00011:010203";
    nodes.get("sourceapply").click(); nodes.get("findopen").click();
    nodes.get("find-label-from").value = "02";
    nodes.get("find-label-to").value = "02";
    setFindFlag("selected", false); setFindFlag("unselected", true);
    nodes.get("find-select").click();
    assert.equal(nodes.get("status").textContent, "已处理 1 个音符");
    nodes.get("find-delete").click();
    assert.equal(nodes.get("status").textContent, "已处理 0 个音符", "matching deletion keeps the original selection filter");
    assert.deepEqual(findValues(), ["01", "02", "03"]);
    nodes.get("find-delete-selected").click();
    assert.deepEqual(findValues(), ["01", "03"], "selected deletion ignores the unselected-only filter");
    nodes.get("find-delete-selected").click();
    assert.equal(nodes.get("status").textContent, "已处理 0 个音符");
    assert.deepEqual(findValues(), ["01", "03"], "empty selection cannot delete unselected notes");
    nodes.get("undo").click(); assert.deepEqual(findValues(), ["01", "02", "03"]);
    // The selected action ignores even invalid criteria and an empty column filter.
    nodes.get("find-select").click();
    nodes.get("find-label-from").value = "??";
    nodes.get("find-columns-none").click();
    nodes.get("find-delete-selected").click();
    assert.deepEqual(findValues(), ["01", "03"]);
    nodes.get("undo").click();
    nodes.get("find-label-from").value = "03"; nodes.get("find-label-to").value = "03";
    nodes.get("find-column-5").click();
    nodes.get("find-delete").click();
    assert.deepEqual(findValues(), ["01", "02"], "direct matching deletion still works without selecting first");
    nodes.get("findclose").click();
    nodes.get("source").value = restoreFindChart; nodes.get("sourceapply").click();
    setFindFlag("selected", true);
    nodes.get("find-label-from").value = "01"; nodes.get("find-label-to").value = "zz";

    nodes.get("saveformat").value = "ibmscx";
    await nodes.get("save").onclick();
    assert.equal(savedRequest.format, "ibmscx");
    const {readPortableProject} = await import("../src/portable-project.js");
    assert.equal(readPortableProject(savedRequest.text).headers.BASE, "62");
    // Modern modes drive compatibility headers, layout, skin and save defaults.
    nodes.get("theme").value = "IIDX"; nodes.get("theme").onchange();
    chooseMode("SINGLE");
    assert.equal(sourceHeaders().PLAYER, "1");
    chooseMode("DOUBLE");
    assert.equal(sourceHeaders().PLAYER, "3");
    assert.ok(nodes.get("laneheads").children.some(n => n.textContent === "D8"));
    chooseMode("PMS");
    assert.equal(sourceHeaders().PLAYER, "3");
    assert.equal(nodes.get("theme").value, "Pomu");
    assert.equal(nodes.get("saveformat").value, "pms");
    assert.deepEqual(modeChoices(), modernChoices);
    nodes.get("undo").click();
    assert.equal(nodes.get("chartmode").value, "DOUBLE");
    assert.equal(nodes.get("theme").value, "IIDX");
    nodes.get("redo").click();
    assert.equal(nodes.get("chartmode").value, "PMS");
    assert.equal(nodes.get("theme").value, "Pomu");
    assert.equal(nodes.get("saveformat").value, "pms");
    await nodes.get("save").onclick();
    assert.equal(parseBMS(savedRequest.text).headers.PLAYER, "3");
    chooseMode("SINGLE");
    assert.equal(sourceHeaders().PLAYER, "1");
    assert.equal(nodes.get("theme").value, "IIDX");
    assert.equal(nodes.get("saveformat").value, "bms");
    // A manually chosen nine-key skin cannot override the chart's mode.
    nodes.get("theme").value = "Pomu"; nodes.get("theme").onchange();
    assert.equal(nodes.get("chartmode").value, "SINGLE");
    assert.equal(nodes.get("laneheads").children.filter(n => /^A[1-8]$/.test(n.textContent)).length, 8);
    chooseMode("DOUBLE");
    assert.equal(sourceHeaders().PLAYER, "3");
    assert.equal(nodes.get("laneheads").children.filter(n => /^[AD][1-8]$/.test(n.textContent)).length, 16);
    nodes.get("theme").value = "IIDX"; nodes.get("theme").onchange();
    // Imported compatibility values remain intact until an explicit mode choice.
    window.desktop.acceptOpen = async () => ({});
    window.desktop.cancelOpen = async () => {};
    window.desktop.newFile = async () => {};
    for (const [player, value, label] of [["2", "legacy-couple", "Couple Play"], ["4", "legacy-battle", "Battle Play"]]) {
      window.desktop.open = async () => ({ name: "legacy.bms", bytes: new TextEncoder().encode("#PLAYER " + player + "\n#TITLE Legacy\n#BPM 120\n#00011:01"), token: "legacy" });
      await nodes.get("open").click();
      assert.equal(nodes.get("chartmode").value, value);
      assert.deepEqual(modeChoices(), [...modernChoices, [value, label]]);
      nodes.get("title").value = "Edited legacy"; nodes.get("title").onchange();
      await nodes.get("save").onclick();
      assert.equal(parseBMS(savedRequest.text).headers.PLAYER, player);
      chooseMode("PMS");
      assert.equal(sourceHeaders().PLAYER, "3");
      assert.deepEqual(modeChoices(), modernChoices);
      nodes.get("undo").click();
      assert.equal(nodes.get("chartmode").value, value);
      assert.equal(sourceHeaders().PLAYER, player);
      await nodes.get("new").click();
      assert.equal(nodes.get("chartmode").value, "SINGLE");
      assert.equal(sourceHeaders().PLAYER, "1");
      assert.deepEqual(modeChoices(), modernChoices);
    }
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
    assert.equal(nodes.get("chartmode").value, "PMS");
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

    assert.equal(nodes.get("chartmode").value, "PMS");
    assert.equal(nodes.get("laneheads").children.filter(n => /^[AD][1-8]$/.test(n.textContent)).length, 9);
    nodes.get("source").value = pmsText; nodes.get("sourceapply").click();
    assert.equal(nodes.get("chartmode").value, "PMS", "source edits preserve the independent PMS mode");
    assert.equal(nodes.get("saveformat").value, "pms");
    chooseMode("SINGLE");
    // Status follows the current pane and the actual note, not the nearest grid.
    nodes.get("reportclose").click();
    nodes.get("theme").value = "IIDX";
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
    // Real controller route: two note clicks share a single audition voice.
    auditionVoices.length = 0;
    nodes.get("source").value = "#BPM 120\n#WAV01 first.wav\n#WAV02 second.wav\n#00011:01\n#00012:02";
    nodes.get("sourceapply").click();
    nodes.get("sounds").files = ["first.wav", "second.wav"].map(name => ({ name, arrayBuffer: async () => new ArrayBuffer(16) }));
    await nodes.get("sounds").onchange();
    const firstClick = hover(0, "A2");
    canvas.onpointerdown(firstClick);
    canvas.onpointerup(firstClick);
    await new Promise(resolve => setImmediate(resolve));
    const secondClick = hover(0, "A3");
    canvas.onpointerdown(secondClick);
    canvas.onpointerup(secondClick);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(auditionVoices.length, 2);
    assert.equal(auditionVoices[0].stops, 1);
    assert.equal(auditionVoices[1].stops, 0);
    nodes.get("stop").click();
    assert.equal(auditionVoices[1].stops, 1);
    // A short note inside a same-lane LN is reported and remains highlighted.
    nodes.get("source").value = "#BPM 120\n#WAV01 a.wav\n#WAV02 b.wav\n#00051:01000100\n#00011:00020000";
    nodes.get("sourceapply").click();
    const overlapAt = hover(1, "A2");
    for (const mode of ["nt", "bmse"]) {
      if (nodes.get("lnstyle").value !== mode) nodes.get("toggleln").click();
      nodes.get("errorcheck").click();
      assert.match(nodes.get("reporttext").textContent, /#000 11 02：.*长音符/);
      nodes.get("reportclose").click();
      assert.equal(nodes.has("errorhighlight"), false);
      paintCalls = []; nodes.get("grid").onchange();
      assert.ok(paintCalls.some(c => c.canvas === "chart" && c.op === "strokeRect" && ["red", "rgba(255,0,0,1)"].includes(c.stroke)));
      paintCalls = null;
    }
    if (nodes.get("lnstyle").value !== "nt") nodes.get("toggleln").click();
    canvas.oncontextmenu({ ...overlapAt, button: 2, preventDefault() {} });
    nodes.get("errorcheck").click();
    assert.equal(nodes.get("reporttext").textContent, "未发现重叠、缺失定义或未配对长音符");
    nodes.get("reportclose").click();
    nodes.get("undo").click();
    nodes.get("errorcheck").click();
    assert.match(nodes.get("reporttext").textContent, /#000 11 02：.*长音符/);
    nodes.get("reportclose").click();
    nodes.get("source").value = "#BPM 120\n#00011:" + "0001" + "00".repeat(94);
    nodes.get("sourceapply").click();
    nodes.get("myo2").click();
    assert.equal(nodes.get("myo2dialog").open, true);
    nodes.get("myo2check").click();
    assert.equal(nodes.get("myo2results").children.length, 1);
    nodes.get("myo2adjust").click();
    assert.equal(nodes.get("myo2message").textContent, "已调整");
    nodes.get("myo2dialog").close();
    nodes.get("sourceopen").click();
    assert.equal(events(parseBMS(nodes.get("source").value))[0].beat, 3 / 48);
    nodes.get("sourcecancel").click();
    nodes.get("undo").click();
    nodes.get("sourceopen").click();
    assert.equal(events(parseBMS(nodes.get("source").value))[0].beat, 2 / 48);
    nodes.get("sourcecancel").click();
    nodes.get("redo").click();
    nodes.get("myo2").click();
    nodes.get("myo2bpm").value = "240";
    nodes.get("myo2constant").click();
    assert.equal(nodes.get("myo2message").textContent, "已恒速化");
    nodes.get("myo2dialog").close();
    assert.equal(Number(nodes.get("bpm").value), 240);
    nodes.get("undo").click();
    assert.equal(Number(nodes.get("bpm").value), 120);
    // Ctrl-wheel scales the chart at the pointer, never the browser or chart data.
    nodes.get("source").value = "#BPM 120\n#10011:01";
    nodes.get("sourceapply").click();
    nodes.get("zoom").value = "4";
    nodes.get("zoom").onchange();
    nodes.get("widthzoom").value = "1";
    nodes.get("widthzoom").onchange();
    const views = ["viewport", "view-left", "view-right"].map(id => nodes.get(id));
    views.forEach((v, i) => { v.scrollTop = 5000 + i * 500; v.onscroll(); });
    const wheel = (view, overrides = {}) => {
      let prevented = false;
      view["event-wheel"]({ ctrlKey: true, shiftKey: false, deltaY: -120,
        clientX: 150, clientY: 160, preventDefault() { prevented = true; }, ...overrides });
      return prevented;
    };
    const beatAt = (view, offset) => (parseFloat(nodes.get("scrollspace").style.height) -
      20 * Number(nodes.get("editorzoom").value) / 100 - view.scrollTop - offset) /
      (Number(nodes.get("zoom").value) * 48 * Number(nodes.get("editorzoom").value) / 100);
    const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
    for (const v of views) {
      assert.equal(v["event-options-wheel"].passive, false);
      const anchors = views.map(other => beatAt(other, other === v ? 160 : other.clientHeight / 2));
      const oldZoom = Number(nodes.get("editorzoom").value);
      assert.equal(wheel(v), true);
      assert.equal(Number(nodes.get("editorzoom").value), oldZoom + 10);
      views.forEach((other, i) => closeTo(beatAt(other, other === v ? 160 : other.clientHeight / 2), anchors[i]));
      const tops = views.map(other => other.scrollTop);
      views.forEach(other => other.onscroll());
      assert.deepEqual(views.map(other => other.scrollTop), tops);
      assert.equal(wheel(v, { deltaY: 120 }), true);
      assert.equal(Number(nodes.get("editorzoom").value), oldZoom);
      v.scrollLeft = 120;
      const lanePosition = (v.scrollLeft + 150) / Number(nodes.get("widthzoom").value);
      wheel(v, { shiftKey: true });
      closeTo((v.scrollLeft + 150) / Number(nodes.get("widthzoom").value), lanePosition);
      assert.equal(Number(nodes.get("editorzoom").value), oldZoom);
    }
    const zoomBeforeNormalWheel = nodes.get("zoom").value;
    const beforeWheelTop = views[0].scrollTop;
    assert.equal(wheel(views[0], { ctrlKey: false }), true);
    assert.equal(views[0].scrollTop, beforeWheelTop - 96 * Number(nodes.get("zoom").value));
    assert.equal(nodes.get("zoom").value, zoomBeforeNormalWheel);
    nodes.get("editorzoom").value = "50"; nodes.get("editorzoom").onchange();
    wheel(views[0], { deltaY: 120 });
    assert.equal(Number(nodes.get("editorzoom").value), 50);
    nodes.get("editorzoom").value = "300"; nodes.get("editorzoom").onchange();
    wheel(views[0]);
    assert.equal(Number(nodes.get("editorzoom").value), 300);
    assert.equal(Number(nodes.get("zoom").value), 4);
    assert.equal(Number(nodes.get("widthzoom").value), 1);
    nodes.get("editorzoom").value = "100"; nodes.get("editorzoom").onchange();
    nodes.get("sourceopen").click();
    assert.deepEqual(events(parseBMS(nodes.get("source").value)).map(e => [e.measure, e.channel, e.value]), [[100, "11", "01"]]);
    nodes.get("sourcecancel").click();

    // Note bodies, labels and columns all scale together, independently of the grid axes.
    nodes.get("source").value = "#BPM 120\n#00011:01\n#00012:01"; nodes.get("sourceapply").click();
    views[0].scrollTop = parseFloat(nodes.get("scrollspace").style.height) - views[0].clientHeight;
    paintCalls = []; views[0].onscroll();
    const baseNote = paintCalls.find(c => c.canvas === "chart" && c.op === "fillRect" && c.args[3] === 10);
    assert.ok(baseNote);
    const baseFont = paintCalls.find(c => c.canvas === "chart" && c.op === "fillText" && c.args[0] === "01").font;
    const baseWidths = nodes.get("laneheads").style.gridTemplateColumns.split(" ").map(parseFloat);
    const beforeZoomSource = JSON.stringify(sourceHeaders()), beforeZoomTitle = document.title;
    const beforeZoomUndo = nodes.get("undo").disabled;
    nodes.get("editorzoom").value = "200"; nodes.get("editorzoom").onchange();
    views[0].scrollTop = parseFloat(nodes.get("scrollspace").style.height) - views[0].clientHeight;
    paintCalls = []; views[0].onscroll();
    const scaledNote = paintCalls.find(c => c.canvas === "chart" && c.op === "fillRect" && c.args[3] === 20);
    assert.ok(scaledNote); assert.equal(scaledNote.args[2], baseNote.args[2] * 2);
    const scaledFont = paintCalls.find(c => c.canvas === "chart" && c.op === "fillText" && c.args[0] === "01").font;
    assert.equal(parseFloat(scaledFont), parseFloat(baseFont) * 2);
    assert.equal(parseFloat(nodes.get("laneheads").style.minHeight), 48);
    assert.deepEqual(nodes.get("laneheads").style.gridTemplateColumns.split(" ").slice(0, 12).map(parseFloat), baseWidths.slice(0, 12).map(w => w * 2));
    paintCalls = null;
    assert.equal(JSON.stringify(sourceHeaders()), beforeZoomSource);
    assert.equal(document.title, beforeZoomTitle);
    assert.equal(nodes.get("undo").disabled, beforeZoomUndo);
    const zoomWidths = nodes.get("laneheads").style.gridTemplateColumns.split(" ").map(parseFloat);
    const zoomLane = nodes.get("laneheads").children.findIndex(n => n.textContent === "A2");
    const noteClick = { currentTarget: canvas, button: 0, pointerId: 51,
      clientX: zoomWidths.slice(0, zoomLane).reduce((a,b) => a+b, 0) + zoomWidths[zoomLane]/2 - views[0].scrollLeft,
      clientY: parseFloat(nodes.get("scrollspace").style.height) - 40 - views[0].scrollTop - 10, preventDefault() {} };
    canvas.focus(); nodes.get("tool-select").click();
    canvas.onpointerdown(noteClick); canvas.onpointerup(noteClick);
    nodes.get("deletenotes").click(); nodes.get("sourceopen").click();
    assert.deepEqual(events(parseBMS(nodes.get("source").value)).map(n => n.channel), ["12"], "zoomed note hit matches its rendered lane and height");
    nodes.get("sourcecancel").click(); nodes.get("undo").click();

    const oldGrid = nodes.get("grid").value;
    assert.equal(nodes.has("slashgrid"), false); assert.equal(nodes.has("slashsettings"), false);
    handlers.keydown({ key: "/", code: "Slash", target: canvas, preventDefault() {} });
    assert.equal(nodes.get("grid").value, oldGrid);
    nodes.get("editorzoom").value = "100"; nodes.get("editorzoom").onchange();

    // General settings use a draft. Cancel and invalid input never persist it.
    nodes.get("generalsettings").click();
    assert.equal(Number(nodes.get("autosaveminutes").value), 2);
    const preferencesBeforeGeneral = localStorage.getItem("ibmsc-preferences");
    const intervalsBeforeGeneral = intervals.length;
    nodes.get("autosaveminutes").value = "7";
    nodes.get("pageunits").value = "192";
    nodes.get("general-cancel").click();
    assert.equal(localStorage.getItem("ibmsc-preferences"), preferencesBeforeGeneral);
    assert.equal(intervals.length, intervalsBeforeGeneral);
    nodes.get("generalsettings").click();
    assert.equal(Number(nodes.get("autosaveminutes").value), 2);
    assert.equal(Number(nodes.get("pageunits").value), 384);
    nodes.get("maxgrid").value = "1";
    nodes.get("general-ok").click();
    assert.equal(nodes.get("generalsettingsdialog").open, true);
    assert.equal(nodes.get("general-error").hidden, false);
    assert.equal(localStorage.getItem("ibmsc-preferences"), preferencesBeforeGeneral);
    nodes.get("maxgrid").value = "384";
    nodes.get("autosaveminutes").value = "0.5";
    nodes.get("wheelunits").value = "48";
    nodes.get("pageunits").value = "192";
    nodes.get("defaultencoding").value = "shift_jis";
    nodes.get("general-ok").click();
    assert.equal(nodes.get("generalsettingsdialog").open, false);
    const generalSaved = JSON.parse(localStorage.getItem("ibmsc-preferences"));
    assert.equal(generalSaved.Edit.AutoSaveInterval, "30000");
    assert.equal(generalSaved.Grid.gWheel, "48");
    assert.equal(generalSaved.Grid.gPgUpDn, "192");
    assert.equal(generalSaved.Save.BMSGridLimit, "0.5");
    assert.equal(nodes.get("encoding").value, "shift_jis");
    assert.equal(intervals.at(-1).milliseconds, 30000);
    nodes.get("generalsettings").click();
    nodes.get("autosave").checked = false; nodes.get("autosave").onchange();
    assert.equal(nodes.get("autosaveminutes").disabled, true);
    nodes.get("general-ok").click();
    assert.equal(intervals.at(-1).cleared, true);
    assert.equal(JSON.parse(localStorage.getItem("ibmsc-preferences")).Edit.AutoSaveInterval, "0");
    nodes.get("encoding").value = "utf8"; // This file's save choice overrides the default.
    nodes.get("generalsettings").click();
    nodes.get("clickstop").checked = false;
    nodes.get("general-ok").click();
    assert.equal(nodes.get("encoding").value, "utf8");

    nodes.get("language-toggle").click();
    assert.equal(nodes.get("languagepopover").popoverOpen, true);
    nodes.get("languagepopover").children.find(b => b.dataset.language === "eng").click();
    assert.equal(nodes.get("language").value, "eng");
    assert.equal(nodes.get("languagepopover").popoverOpen, false);
    nodes.get("language").value = "chs"; nodes.get("language").onchange();
    // Switching languages must not edit the chart or reset controls. Newly rebuilt
    // options and statistics also use the selected language.
    nodes.get("sourceopen").click();
    const beforeLanguage = nodes.get("source").value;
    nodes.get("sourcecancel").click();
    const controlValues = ["zoom", "widthzoom", "lnstyle", "chartmode"].map(id => nodes.get(id).value);
    for (const [id, heading, unset] of [["jpn", "統計", "未指定"], ["eng", "Statistics", "Unspecified"], ["kor", "통계", "미지정"], ["chs", "统计", "未指定"]]) {
      nodes.get("language").value = id; nodes.get("language").onchange();
      assert.equal(JSON.parse(localStorage.getItem("ibmsc-language")).id, id);
      assert.equal(nodes.get("language-menu").children.find(b => b["aria-checked"] === "true").dataset.language, id);
      nodes.get("about").click();
      assert.match(nodes.get("reporttext").textContent, /移植与维护：SeaRay|Port and maintenance: SeaRay|移植・保守：SeaRay|이식 및 유지보수: SeaRay/);
      if (id !== "chs") assert.doesNotMatch(nodes.get("reporttext").textContent, /跨平台谱面编辑器|原作贡献者|移植与维护/);
      assert.equal(nodes.has("checkupdates-zh"), false);
      nodes.get("reportclose").click();
      nodes.get("statistics").click();
      assert.equal(nodes.get("reporttitle").textContent, heading);
      nodes.get("reportclose").click();
      nodes.get("bpm").onchange(); // Rebuilds header choices.
      assert.equal(nodes.get("header-RANK").children[0].textContent, unset);
      assert.deepEqual(["zoom", "widthzoom", "lnstyle", "chartmode"].map(id => nodes.get(id).value), controlValues);
    }
    nodes.get("sourceopen").click();
    assert.equal(nodes.get("source").value, beforeLanguage);
    nodes.get("sourcecancel").click();

    // Exercise translated errors through actual handlers, including Electron's
    // serialized remote error format. A failed operation must not replace data.
    nodes.get("sourceopen").click();
    const unchanged = nodes.get("source").value;
    nodes.get("source").value = "#BPM 0";
    nodes.get("sourceapply").click();
    const saveHandler = window.desktop.save;
    nodes.get("saveformat").value = "bms";
    for (const language of ["jpn", "eng", "kor", "chs"]) {
      nodes.get("language").value = language; nodes.get("language").onchange();
      const t = createTranslator(language);
      assert.equal(nodes.get("sourceerror").textContent, t("初始 BPM 必须为正数"));
      nodes.get("sourcecancel").click();
      window.desktop.save = async () => ({ name: "曲名 {1}.bms" });
      await nodes.get("save").onclick();
      assert.equal(nodes.get("status").textContent, t("已保存 {0}", "曲名 {1}.bms"));
      window.desktop.save = async () => { throw Error("Error invoking remote method 'file:save': Error: Shift-JIS 无法保存字符“她”，请改用 UTF-8"); };
      await nodes.get("save").onclick();
      assert.equal(nodes.get("status").textContent, t("Shift-JIS 无法保存字符“她”，请改用 UTF-8"));
      nodes.get("errorcheck").click();
      assert.ok(!/缺少|未配对/.test(nodes.get("reporttext").textContent) || language === "chs");
      nodes.get("reportclose").click();
      nodes.get("sourceopen").click();
      assert.equal(nodes.get("source").value, unchanged);
      assert.equal(nodes.get("sourceerror").textContent, "");
      nodes.get("source").value = "#BPM 0";
      nodes.get("sourceapply").click();
    }
    window.desktop.save = saveHandler;
    nodes.get("sourcecancel").click();

  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
