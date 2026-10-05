import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { defaultColumns } from "../src/default-columns.js";
import { themes } from "../src/themes.js";
import { themeMetadata } from "../src/theme-metadata.js";
import {
  createThemeDraft,
  validateTheme,
  argbToParts,
  partsToARGB,
  updateThemeDocument,
  serializeTheme,
} from "../src/theme-editor.js";

class StrictParser extends DOMParser {
  constructor() {
    const reject = (message) => {
      throw Error(message);
    };
    super({
      errorHandler: { warning: reject, error: reject, fatalError: reject },
    });
  }
}
const xmlServices = { DOMParser: StrictParser, XMLSerializer };
const parse = (text) =>
  new StrictParser().parseFromString(text, "application/xml");
const xml = (node) => new XMLSerializer().serializeToString(node);
const children = (node, tag) =>
  Array.from(node.childNodes).filter(
    (child) => child.nodeType === 1 && child.tagName === tag,
  );
const column = (doc, index) =>
  children(children(doc.documentElement, "Columns")[0], "Column").find(
    (node) => Number(node.getAttribute("Index")) === index,
  );

test("theme drafts deep-clone builtins, metadata and partial column extensions", () => {
  const before = JSON.stringify({ themes, themeMetadata, defaultColumns });
  for (const [name, theme] of Object.entries(themes)) {
    const draft = createThemeDraft({ ...theme, ...themeMetadata[name] });
    assert.equal(draft.columns.length, 27);
    assert.equal(validateTheme(draft), draft);
    draft.columns[4].Width = "87";
    draft.visual.Bg.Value = "123";
    draft.sourceXml = "changed";
  }
  assert.equal(
    JSON.stringify({ themes, themeMetadata, defaultColumns }),
    before,
  );
  const current = {
    columns: [{ Index: "26", Width: "123", Custom: { list: [1] } }],
    visual: { Future: { Value: "opaque", Metadata: { enabled: true } } },
    sourceXml: "original XML",
    extra: { list: [2] },
  };
  const draft = createThemeDraft(current);
  assert.equal(draft.columns[26].Width, "123");
  assert.equal(draft.columns[26].Title, "B");
  assert.equal(draft.sourceXml, current.sourceXml);
  draft.columns[26].Custom.list.push(2);
  draft.visual.Future.Metadata.enabled = false;
  draft.extra.list.push(3);
  assert.deepEqual(current.columns[0].Custom.list, [1]);
  assert.equal(current.visual.Future.Metadata.enabled, true);
  assert.deepEqual(current.extra.list, [2]);
});

test("default theme drafts retain empty visual settings instead of adopting another theme", () => {
  const draft = createThemeDraft(null);
  assert.deepEqual(draft.columns, defaultColumns);
  assert.deepEqual(draft.visual, {});
  assert.notEqual(draft.columns[0], defaultColumns[0]);
  assert.equal(validateTheme(draft), draft);
});

test("theme column indexes are complete, unique integers in 0 through 26", () => {
  for (const index of [-1, 27, 4.5, "", " ", false, null, Infinity]) {
    const draft = createThemeDraft();
    draft.columns[4].Index = index;
    assert.throws(() => validateTheme(draft), /主题列定义无效/);
    assert.throws(
      () => createThemeDraft({ columns: [{ Index: index }] }),
      /主题列定义无效/,
    );
  }
  const draft = createThemeDraft();
  draft.columns[5].Index = "04";
  assert.throws(() => validateTheme(draft), /主题列定义无效/);
  assert.throws(() => createThemeDraft(draft), /主题列定义无效/);
  assert.throws(
    () => validateTheme({ columns: defaultColumns.slice(1) }),
    /主题列定义无效/,
  );
});

test("theme widths accept 0 through 999 integers and require an A, D or BGM lane", () => {
  for (const width of [-1, 1000, 1.5, "", " ", false, null, Infinity]) {
    const draft = createThemeDraft();
    draft.columns[4].Width = width;
    assert.throws(() => validateTheme(draft), /主题列宽必须为 0–999 的整数/);
  }
  const draft = createThemeDraft();
  draft.columns.forEach((c) => {
    c.Width = "0";
  });
  draft.columns[1].Width = "999";
  draft.columns[22].Width = "999";
  assert.throws(() => validateTheme(draft), /主题至少需要一条可见/);
  for (const index of [4, 11, 13, 20, 26]) {
    draft.columns[index].Width = "999";
    validateTheme(draft);
    draft.columns[index].Width = "0";
  }
});

test("ARGB accepts signed and unsigned 32-bit values without wrapping invalid inputs", () => {
  for (const value of [
    -2147483648, -1, 0, 0x00123456, 0x7fabcdef, 4294967295,
  ]) {
    const parts = argbToParts(String(value));
    assert.match(parts.color, /^#[0-9a-f]{6}$/);
    assert.equal(Number(partsToARGB(parts.color, parts.alpha)), value >>> 0);
    const draft = createThemeDraft();
    draft.columns[4].NoteColor = String(value);
    draft.visual.kError = { Value: String(value) };
    validateTheme(draft);
  }
  assert.deepEqual(argbToParts("1193046"), { color: "#123456", alpha: 0 });
  assert.equal(partsToARGB("#FFFFFF", "255"), "4294967295");
  for (const value of [
    -2147483649,
    4294967296,
    0.1,
    "",
    false,
    null,
    Infinity,
    NaN,
  ]) {
    assert.throws(() => argbToParts(value), /主题颜色必须为 32 位 ARGB 整数/);
    const draft = createThemeDraft();
    draft.visual.kError = { Value: value };
    assert.throws(() => validateTheme(draft), /主题颜色必须为 32 位 ARGB 整数/);
  }
  for (const color of ["red", "#fff", "#11223344", "112233", "#12345g", null])
    assert.throws(() => partsToARGB(color, 255), /颜色必须为 #RRGGBB 格式/);
  for (const alpha of [-1, 256, 1.2, "", false, null, Infinity])
    assert.throws(
      () => partsToARGB("#123456", alpha),
      /颜色不透明度必须为 0–255 的整数/,
    );
});

test("theme validation retains visual extensions while checking known visual settings", () => {
  const draft = createThemeDraft();
  draft.visual = {
    Future: { Value: "unknown representation" },
    kHeight: { Value: "10" },
    kFont: { Name: "A & B", Size: "7.5", Style: "0" },
  };
  const before = structuredClone(draft);
  validateTheme(draft);
  assert.deepEqual(draft, before);
  for (const visual of [null, [], { Bg: null }, { Bg: [] }])
    assert.throws(
      () => validateTheme({ ...draft, visual }),
      /主题视觉设置无效/,
    );
  for (const visual of [
    { kHeight: { Value: "0" } },
    { kOpacity: { Value: "2" } },
    { kFont: { Size: "101" } },
    { kLabelHShift: { Value: "" } },
  ])
    assert.throws(() => validateTheme({ ...draft, visual }));
});

const source = `<?xml version="1.0" encoding="utf-16"?>
<?xml-stylesheet type="text/xsl" href="skin.xsl"?>
<!-- Keep this comment -->
<iBMSC Major="2" Minor="4" Build="0" Vendor="root" xmlns:v="urn:vendor">
  <Columns Vendor="columns">
    <Column Index="04" Width="10" Title="old" Custom="original" v:extra="keep"><FutureColumnData value="preserve"/></Column>
    <Column Index="26" Width="20" Title="B" />
    <FutureColumns Vendor="keep"/>
  </Columns>
  <VisualSettings Vendor="visual">
    <Bg Value="0" Extra="original"><FutureColor/></Bg>
    <ColumnTitleFont Name="old" Size="8" Style="1" FontExtra="keep"><FontChild/></ColumnTitleFont>
    <FutureVisual Value="original"><Nested value="keep"/></FutureVisual>
  </VisualSettings>
  <Future><Columns><Column Index="4" Width="321"/></Columns></Future>
</iBMSC>`;

function editedDraft() {
  return createThemeDraft({
    sourceXml: source,
    columns: [
      {
        Index: "4",
        Width: "77",
        Title: 'A & "B" <C>',
        Custom: "model-copy",
        NewAttribute: "added",
      },
    ],
    visual: {
      Bg: { Value: "-16777216", Extra: "model-copy", NewAttribute: "added" },
      ColumnTitleFont: { Name: 'A & "B"', Size: "7.5", Style: "0" },
      FutureVisual: { Value: "model-copy" },
      kHeight: { Value: "12" },
    },
  });
}

test("updating theme XML patches current values without touching the source or unknown data", () => {
  const original = parse(source);
  const before = xml(original);
  const draft = editedDraft();
  const snapshot = structuredClone(draft);
  const updated = updateThemeDocument(original, draft);
  assert.equal(xml(original), before);
  assert.deepEqual(draft, snapshot);
  assert.equal(updated.documentElement.getAttribute("Major"), "2");
  assert.equal(updated.documentElement.getAttribute("Vendor"), "root");
  const cols = children(updated.documentElement, "Columns")[0];
  assert.equal(cols.getAttribute("Vendor"), "columns");
  assert.equal(children(cols, "Column").length, 27);
  const lane = column(updated, 4);
  assert.equal(lane.getAttribute("Width"), "77");
  assert.equal(lane.getAttribute("Title"), 'A & "B" <C>');
  assert.equal(lane.getAttribute("Custom"), "original");
  assert.equal(lane.getAttribute("v:extra"), "keep");
  assert.equal(lane.getAttribute("NewAttribute"), "added");
  assert.equal(children(lane, "FutureColumnData").length, 1);
  assert.equal(children(cols, "FutureColumns").length, 1);
  const visual = children(updated.documentElement, "VisualSettings")[0];
  const bg = children(visual, "Bg")[0];
  assert.equal(bg.getAttribute("Value"), "-16777216");
  assert.equal(bg.getAttribute("Extra"), "original");
  assert.equal(children(bg, "FutureColor").length, 1);
  const font = children(visual, "ColumnTitleFont")[0];
  assert.equal(font.getAttribute("Name"), 'A & "B"');
  assert.equal(font.getAttribute("Size"), "7.5");
  assert.equal(font.getAttribute("FontExtra"), "keep");
  assert.equal(children(font, "FontChild").length, 1);
  assert.equal(children(visual, "kHeight")[0].getAttribute("Value"), "12");
  assert.equal(
    children(visual, "FutureVisual")[0].getAttribute("Value"),
    "original",
  );
  const future = children(updated.documentElement, "Future")[0];
  assert.equal(
    future.getElementsByTagName("Column")[0].getAttribute("Width"),
    "321",
  );
});

test("serialized themes export edits, UTF-8, escaped attributes, and intact extension XML", () => {
  const draft = editedDraft();
  const serialized = serializeTheme(draft, xmlServices);
  assert.match(serialized, /^<\?xml version="1\.0" encoding="utf-8"\?>\n/);
  assert.equal((serialized.match(/<\?xml\s/g) || []).length, 1);
  assert.match(
    serialized,
    /<\?xml-stylesheet type="text\/xsl" href="skin\.xsl"\?>/,
  );
  assert.match(serialized, /<!-- Keep this comment -->/);
  assert.match(serialized, /Title="A &amp; &quot;B&quot; &lt;C&gt;"/);
  assert.equal(column(parse(serialized), 4).getAttribute("Width"), "77");
  assert.equal(draft.sourceXml, source);
});

test("themes without source XML export all columns and new custom visual metadata", () => {
  const draft = createThemeDraft();
  draft.columns[4].Vendor = "keep";
  draft.visual.Future = { Value: "opaque", Vendor: "keep" };
  const doc = parse(serializeTheme(draft, xmlServices));
  assert.equal(
    children(children(doc.documentElement, "Columns")[0], "Column").length,
    27,
  );
  assert.equal(column(doc, 4).getAttribute("Vendor"), "keep");
  assert.equal(
    doc.getElementsByTagName("Future")[0].getAttribute("Value"),
    "opaque",
  );
  const namespaceDoc = updateThemeDocument(
    parse('<iBMSC xmlns="urn:theme"/>'),
    draft,
  );
  assert.equal(
    children(namespaceDoc.documentElement, "Columns")[0].namespaceURI,
    "urn:theme",
  );
  assert.equal(column(namespaceDoc, 4).namespaceURI, "urn:theme");
});

test("ambiguous or invalid source theme XML fails instead of exporting stale definitions", () => {
  const draft = createThemeDraft();
  draft.visual.Bg = { Value: "0" };
  for (const text of [
    "<Other/>",
    "<iBMSC><Columns/><Columns/></iBMSC>",
    '<iBMSC><Columns><Column Index="4"/><Column Index="04"/></Columns></iBMSC>',
    '<iBMSC><Columns><Column Index="27"/></Columns></iBMSC>',
    "<iBMSC><VisualSettings/><VisualSettings/></iBMSC>",
    '<iBMSC><VisualSettings><Bg Value="0"/><Bg Value="1"/></VisualSettings></iBMSC>',
  ])
    assert.throws(
      () => updateThemeDocument(parse(text), draft),
      /主题 XML 无效/,
    );
  assert.throws(
    () =>
      serializeTheme({ ...draft, sourceXml: "<iBMSC><unclosed>" }, xmlServices),
    /主题 XML 无效/,
  );
  assert.throws(
    () => serializeTheme({ ...draft, sourceXml: 123 }, xmlServices),
    /主题 XML 无效/,
  );
});

test("theme updates distinguish foreign namespaces and recognize theme namespace aliases", () => {
  const original = parse(`<t:iBMSC xmlns:t="urn:theme" xmlns:v="urn:vendor">
    <Columns xmlns="urn:vendor"><Column Index="4" Width="111"/></Columns>
    <t:Columns>
      <Column xmlns="urn:vendor" Index="4" Width="112"/>
      <alias:Column xmlns:alias="urn:theme" Index="4" Width="10"/>
    </t:Columns>
    <VisualSettings xmlns="urn:vendor"><Bg Value="123"/></VisualSettings>
    <t:VisualSettings>
      <Bg xmlns="urn:vendor" Value="456"/>
      <alias:Bg xmlns:alias="urn:theme" Value="0"/>
    </t:VisualSettings>
  </t:iBMSC>`);
  const draft = createThemeDraft();
  draft.columns[4].Width = "77";
  draft.visual.Bg = { Value: "-16777216" };
  const before = xml(original);
  const updated = updateThemeDocument(original, draft);
  assert.equal(xml(original), before);
  assert.equal(
    updated.getElementsByTagNameNS("urn:theme", "Columns").length,
    1,
  );
  assert.equal(
    updated.getElementsByTagNameNS("urn:theme", "VisualSettings").length,
    1,
  );
  const themeColumns = Array.from(
    updated.getElementsByTagNameNS("urn:theme", "Column"),
  );
  assert.equal(themeColumns.length, 27);
  assert.equal(
    themeColumns
      .find((node) => node.getAttribute("Index") === "4")
      .getAttribute("Width"),
    "77",
  );
  assert.deepEqual(
    Array.from(updated.getElementsByTagNameNS("urn:vendor", "Column"), (node) =>
      node.getAttribute("Width"),
    ),
    ["111", "112"],
  );
  assert.deepEqual(
    Array.from(updated.getElementsByTagNameNS("urn:vendor", "Bg"), (node) =>
      node.getAttribute("Value"),
    ),
    ["123", "456"],
  );
  assert.equal(
    updated.getElementsByTagNameNS("urn:theme", "Bg")[0].getAttribute("Value"),
    "-16777216",
  );
  const roundtrip = parse(xml(updated));
  assert.equal(
    roundtrip.getElementsByTagNameNS("urn:theme", "Column").length,
    27,
  );
  assert.equal(
    roundtrip.getElementsByTagNameNS("urn:vendor", "Column").length,
    2,
  );

  const foreignOnly = updateThemeDocument(
    parse(
      '<iBMSC><Columns xmlns="urn:vendor"><Column Index="4" Width="111"/></Columns></iBMSC>',
    ),
    draft,
  );
  const directColumns = children(foreignOnly.documentElement, "Columns");
  assert.equal(directColumns.length, 2);
  assert.equal(directColumns[0].namespaceURI, "urn:vendor");
  assert.equal(directColumns[0].getElementsByTagName("Column").length, 1);
  assert.equal(directColumns[1].namespaceURI || null, null);
  assert.equal(directColumns[1].getElementsByTagName("Column").length, 27);
});

test("new prefixed metadata retains namespace declarations and round-trips with its namespace", () => {
  const draft = createThemeDraft({
    columns: [
      {
        Index: "4",
        "xmlns:v": "urn:vendor",
        "v:extra": "keep",
        "xml:lang": "ja",
      },
    ],
    visual: {
      Bg: { Value: "0", "xmlns:q": "urn:visual", "q:extra": "retain" },
    },
  });
  const snapshot = structuredClone(draft);
  const serialized = serializeTheme(draft, xmlServices);
  const doc = parse(serialized);
  const lane = column(doc, 4);
  assert.equal(lane.lookupNamespaceURI("v"), "urn:vendor");
  assert.equal(lane.getAttributeNS("urn:vendor", "extra"), "keep");
  assert.equal(lane.getAttributeNode("v:extra").namespaceURI, "urn:vendor");
  assert.equal(
    lane.getAttributeNS("http://www.w3.org/XML/1998/namespace", "lang"),
    "ja",
  );
  assert.equal(
    doc.getElementsByTagName("Bg")[0].getAttributeNS("urn:visual", "extra"),
    "retain",
  );
  assert.deepEqual(draft, snapshot);

  const inherited = createThemeDraft({
    sourceXml: '<iBMSC xmlns:v="urn:vendor"/>',
    columns: [{ Index: "4", "v:extra": "inherited" }],
  });
  assert.equal(
    column(parse(serializeTheme(inherited, xmlServices)), 4).getAttributeNS(
      "urn:vendor",
      "extra",
    ),
    "inherited",
  );
});

test("unbound, conflicting, or reserved namespace metadata fails before export", () => {
  for (const attributes of [
    { "v:extra": "unbound" },
    { "xmlns:v": "", "v:extra": "unbound" },
    { "xmlns:v": "urn:vendor", "v:a:extra": "invalid QName" },
    { "xmlns:xml": "urn:vendor" },
    { "xmlns:v": "http://www.w3.org/XML/1998/namespace" },
    { "xmlns:v": "http://www.w3.org/2000/xmlns/" },
    { "xmlns:xmlns": "urn:vendor" },
    { xmlns: "urn:retargeted" },
  ]) {
    const draft = createThemeDraft({
      columns: [{ Index: "4", ...attributes }],
    });
    assert.throws(() => serializeTheme(draft, xmlServices), /主题 XML 无效/);
  }
  const conflicting = createThemeDraft({
    sourceXml:
      '<iBMSC xmlns:v="urn:original"><Columns><Column Index="4" v:old="keep"/></Columns></iBMSC>',
    columns: [{ Index: "4", "xmlns:v": "urn:changed", "v:new": "new" }],
  });
  assert.throws(
    () => serializeTheme(conflicting, xmlServices),
    /主题 XML 无效/,
  );
});

test("theme import ignores foreign sections and reads the same data exported after editing", async () => {
  const { readThemeDocument } = await import("../src/theme-editor.js");
  const xml = `<iBMSC xmlns:v="urn:vendor"><v:Columns><v:Column Index="4" Width="999"/></v:Columns><Columns><Column Index="4" Width="71" /></Columns><VisualSettings><Bg Value="4278190080"/><v:Bg Value="bad"/></VisualSettings></iBMSC>`;
  const services = await import("@xmldom/xmldom");
  const doc = new services.DOMParser().parseFromString(xml, "application/xml");
  const theme = readThemeDocument(doc, xml);
  assert.equal(theme.columns[4].Width, "71");
  theme.columns[4].Width = "92";
  const output = serializeTheme(theme, services);
  const reloaded = readThemeDocument(
    new services.DOMParser().parseFromString(output, "application/xml"),
    output,
  );
  assert.equal(reloaded.columns[4].Width, "92");
  assert.equal(reloaded.visual.Bg.Value, "4278190080");
  assert.match(output, /<v:Bg Value="bad"/);
  assert.throws(
    () =>
      readThemeDocument(
        new services.DOMParser().parseFromString(
          `<iBMSC><Columns><Column Index="4"/></Columns><VisualSettings><Bg Value="0"/><Bg Value="1"/></VisualSettings></iBMSC>`,
          "application/xml",
        ),
      ),
    /主题 XML 无效/,
  );
});
