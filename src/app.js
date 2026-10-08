import { encodeBMS } from "./bms-encoding.js";
import { generalDefaults, generalPreferenceIds, validateGeneralSettings } from "./general-settings.js";
import { createChartNavigation } from "./chart-navigation.js";
import { createTouchGestures } from "./touch-gestures.js";
import { createDragPreview } from "./drag-preview.js";
import { prepareBMSExport } from "./bms-export.js";
import { createFindCriteria, applyFindOperation } from "./find-replace.js";
import { createFindReplace } from "./find-replace-ui.js";
import { createLocalization } from "./localization.js";
import { constantBPM, checkMyO2Grid, adjustMyO2Grid } from "./myo2.js";
import { bmpDefinitions, migrateExpansion, setBMPDefinition } from "./expansion.js";
import { KeyPreview } from "./key-preview.js";
import { decodeAudio } from "./audio-decode.js";
import { resolveBrowserSoundFiles } from "./browser-sounds.js";
import { playbackPlan, voiceStart } from "./playback-plan.js";
import { positionStatus, statusNumber } from "./position-status.js";
import { defaultColumns } from "./default-columns.js";
import { gridOffsets } from "./grid-lines.js";
import { playableNoteCount, isPomuTheme, pomuColumns, pomuChannels, pomuStatisticsRows, shiftVisibleNotes } from "./key-layout.js";
import { remapClipboardNotes, remapClipboardRows } from "./clipboard-base.js";
import { writePortableProject, readPortableProject, validateProjectChart } from "./portable-project.js";
import { createThemeDraft, validateTheme, serializeTheme, readThemeDocument } from "./theme-editor.js";
import { createThemeEditor } from "./theme-editor-ui.js";
import { editableTheme } from "./theme-defaults.js";
import { themeMetadata } from "./theme-metadata.js";
import { visualNumber, visualColor, visualFont } from "./visual-settings.js";
import { creditsRows } from "./credits.js";
import { chartBase, normalizeId, validId, resourceIds } from "./identifiers.js";
import { measureLabel } from "./measure-edit.js";
import { fillBGMColumns } from "./columns.js";
import { headerChoices, headerLabels } from "./header-fields.js";
import { editorMode, initializeEditorMode, editorModeChoices, editorModeSelection, setEditorMode } from "./chart-mode.js";
import {
  noteGroup,
  removeNoteGroup,
  relabelNote,
  resizeNotes,
  planNoteResize,
} from "./note-edit.js";
import { classifyDrop } from "./drop-files.js";
import { waveformClock, waveformSample } from "./wave-overlay.js";
import { columnStyle, paintNote, paintNoteLabel, noteColor } from "./note-render.js";
import { decodeXML } from "./text-encoding.js";
import { locales } from "./locales.js";
import { defaultLanguage, languageIds, initialLanguagePreferences } from "./language-preferences.js";
import {
  updateSettingsDocument,
  migrateLayoutPreferences,
  preferenceFields,
  readPreferenceAttributes,
  writePreferenceAttributes,
} from "./preferences.js";
import { renderIndex } from "./render-index.js";
import {
  renameWAV,
  wavUsage,
  shiftWAV,
  assignWAV,
} from "./resources.js";
import { History } from "./history.js";
import { timeMap, waveformPeaks, calculateBPM } from "./timing.js";
import { themes } from "./themes.js";
import { importSM, smDifficulties } from "./sm.js";
import { changeMeasureRatios } from "./measure-edit.js";
import {
  nudgeCaptured,
  captureNotes,
  putCaptured,
  mirrorCaptured,
  eventId,
} from "./commands.js";
import { readProject, writeProject } from "./project.js";
import { diagnose, statistics } from "./diagnostics.js";
import {
  originalColumns,
  eventColumn,
  numericValue,
  writeColumn,
  maxBGM,
} from "./columns.js";
import {
  copyMeasures,
  pasteMeasures,
  mirrorMeasures,
  deleteMeasures,
  insertMeasure,
  removeMeasure,
} from "./edit.js";
import {
  parseBMS,
  serializeBMS,
  bgmLongEvents,
  flattenBGMLongs,
  measureStarts,
  events,
  putNote,
  longPairs,
  timeline,
  decodeBMS,
  channels,
} from "./bms.js";
import {
  displayedBeatY,
  pointerPosition,
  scrollEndBeat,
  showsSecondPlayer,
} from "./view.js";
const $ = (id) => document.getElementById(id),
  canvas = $("chart"),
  ctx = canvas.getContext("2d");
const ui = createLocalization(document.body);
const t = ui.t;
let generalOptions = { ...generalDefaults };
let navigation;
// User preference stays independent from lanes added to fit the chart or viewport.
let bgmMinimum = 15;
let editorZoom = 1;
const editorInset = () => 20 * editorZoom;
function editorFont(key, fallback) {
  return visualFont(currentTheme, key, fallback).replace(/([\d.]+)(px|pt)\b/,
    (_, size, unit) => Number(size) * editorZoom + unit);
}
let chart = initializeEditorMode(parseBMS("#PLAYER 1\n#BPM 120\n#LNTYPE 1")),
  dirty = false,
  selected = null,
  scale = 48 * 4,
  starts = [],
  height = 0,
  width = 760,
  drag = null;
const panes = [
  {
    view: $("viewport"),
    canvas,
    space: $("scrollspace"),
    heads: $("laneheads"),
    panel: $("pane-main"),
  },
  ...["left", "right"].map((side) => ({
    view: $("view-" + side),
    canvas: $("chart-" + side),
    space: $("space-" + side),
    heads: $("heads-" + side),
    panel: $("pane-" + side),
  })),
];
let wavSelection = new Set(["01"]),
  wavListSignature = null;
let renderCache = renderIndex(chart);
let bmpNames = bmpDefinitions(chart);
let errorEvents = new Set();
const history = new History(chart);
let expansionEdit = null;
function finishExpansionEdit() {
  if (!expansionEdit) return;
  if (expansionEdit.target === chart) history.commit(expansionEdit.before, chart);
  expansionEdit = null;
  dirty = history.isDirty(chart);
  $("undo").disabled = !history.canUndo;
  $("redo").disabled = !history.canRedo;
}
$("expansion").oninput = () => {
  if (expansionEdit?.target !== chart)
    expansionEdit = { target: chart, before: structuredClone(chart) };
  chart.raw = $("expansion").value.split(/\r\n|\n|\r/);
  bmpNames = bmpDefinitions(chart);
  draw();
  dirty = history.isDirty(chart);
  document.title = (dirty ? "● " : "") + $("project").textContent + " · iBMSC";
  $("undo").disabled = false;
};
$("expansion").onchange = $("expansion").onblur = finishExpansionEdit;
let activeChannels = [
  "01",
  "03",
  "08",
  "09",
  "04",
  "06",
  "07",
  ...channels,
  ...channels.map((c) => "2" + c[1]),
  ...channels.map((c) => "3" + c[1]),
  ...channels.map((c) => "4" + c[1]),
];
let columns = [],
  contentWidth = 0,
  selectedIds = new Set(),
  noteClipboard = [],
  pasteTarget = null,
  writePointer = null,
  statusPointer = null,
  timeStatus = { start: 0, length: 0 },
  box = null,
  currentTheme = themes.IIDX,
  pendingSM = null;
let overlayBuffer = null,
  overlayClock = null,
  overlayGeneration = 0;
let audio,
  buffers = new Map(),
  sources = [],
  playGeneration = 0,
  playTimer = null,
  playFrame = null,
  playBeat = null,
  playClock = null;
function status(s, ...values) {
  ui.text($("status"), s, ...values);
}
const keyPreview = new KeyPreview(context);
function stop() {
  keyPreview.stop();
  playGeneration++;
  clearInterval(playTimer);
  cancelAnimationFrame(playFrame);
  playTimer = null;
  playFrame = null;
  playBeat = null;
  playClock = null;
  sources.forEach((s) => {
    try {
      s.stop();
    } catch {}
  });
  sources = [];
  ui.text($("playstatus"), "");
}
function mutate(fn) {
  finishExpansionEdit();
  const before = structuredClone(chart);
  try {
    stop();
    fn();
    history.commit(before, chart);
    selected = null;
    selectedIds.clear();
    refresh();
    return true;
  } catch (e) {
    chart = before;
    refresh();
    status(e.message);
    return false;
  }
}
function refresh() {
  syncEditorModePresentation();
  syncEditorModeControl();
  syncNativeMenuState();
  errorEvents = new Set(statistics(chart, { nt: $("lnstyle").value === "nt" }).errorEvents);
  bmpNames = bmpDefinitions(chart);
  const expansion = chart.raw.join("\n");
  if ($("expansion").value !== expansion) $("expansion").value = expansion;
  if (!$("measurelist").children.length) {
    for (let m = 0; m < 1000; m++) {
      const option = document.createElement("option");
      option.value = String(m);
      option.selected = m === Number($("measure").value);
      $("measurelist").append(option);
    }
  }
  for (const option of $("measurelist").children) {
    const label = measureLabel(option.value, chart.ratios[option.value] || 1);
    if (option.textContent !== label) option.textContent = label;
  }

  syncMeasureInputs();
  renderCache = renderIndex(chart);
  try {
    overlayClock = waveformClock(chart);
  } catch {
    overlayClock = null;
  }
  dirty = history.isDirty(chart);
  for (const [id, key] of [
    ["title", "TITLE"],
    ["artist", "ARTIST"],
    ["bpm", "BPM"],
    ["level", "PLAYLEVEL"],
    ["genre", "GENRE"],
  ])
    $(id).value = chart.headers[key] ?? "";
  for (const key of [
    "SUBTITLE",
    "SUBARTIST",
    "RANK",
    "DIFFICULTY",
    "EXRANK",
    "TOTAL",
    "STAGEFILE",
    "BANNER",
    "BACKBMP",
    "COMMENT",
    "LNOBJ",
  ])
    if ($("header-" + key)) syncHeaderControl(key, $("header-" + key));
  $("project").textContent = chart.headers.TITLE || "Untitled";
  document.title = (dirty ? "● " : "") + $("project").textContent + " · iBMSC";
  $("undo").disabled = !history.canUndo;
  $("redo").disabled = !history.canRedo;
  refreshWAVList();
  rebuildColumns();
  starts = measureStarts(chart);
  setScrollExtent(scrollEndBeat(chart));
  draw();
}
function setScrollExtent(endBeat) {
  const oldHeight = height;
  height = Math.max(
    endBeat * scale + 30 * editorZoom,
    ...panes.map((p) => p.view.clientHeight),
  );
  for (const pane of panes) {
    const top = pane.view.scrollTop + height - oldHeight;
    pane.space.style.height = height + "px";
    pane.view.scrollTop = Math.max(
      0,
      Math.min(height - pane.view.clientHeight, top),
    );
    pane.lastScrollTop = pane.view.scrollTop;
  }
}
function refreshWAVList() {
  const list = $("samples");
  list.multiple = $("wavmulti").checked;
  const signature =
    chartBase(chart) + JSON.stringify(chart.resources.WAV) + JSON.stringify([...buffers.keys()]);
  if (signature !== wavListSignature) {
    const scroll = list.scrollTop;
    list.replaceChildren();
    for (const id of resourceIds(chart)) {
      const name = chart.resources.WAV[id] || "";
      const option = document.createElement("option");
      option.value = id;
      option.textContent =
        id +
        ": " +
        name +
        (buffers.has(name.toLowerCase().replaceAll("\\", "/")) ? "  ✓" : "");
      list.append(option);
    }
    list.scrollTop = scroll;
    wavListSignature = signature;
  }
  for (const option of list.children)
    option.selected = wavSelection.has(option.value);
}
$("samples").onchange = () => {
  wavSelection = new Set([...$("samples").selectedOptions].map((o) => o.value));
  const id = [...wavSelection][0];
  if (id) {
    $("sample").value = id;
    drawWaveform(chart.resources.WAV[id]);
  }
};
$("samples").onclick = () => {
  stop();
  const name = chart.resources.WAV[$("sample").value];
  if ($("previewclick").checked && name) preview(name);
};
$("samples").ondblclick = () => browseWAV(true);
$("samples").onkeydown = (e) => {
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    $("wavremove").click();
  }
};
$("wavmulti").onchange = () => {
  if (!$("wavmulti").checked) wavSelection = new Set([$("sample").value]);
  refreshWAVList();
};
for (const [id, direction] of [
  ["wavup", -1],
  ["wavdown", 1],
])
  $(id).onclick = () => {
    let next;
    if (
      mutate(() => {
        next = shiftWAV(chart, wavSelection, direction, $("wavsync").checked);
      })
    ) {
      wavSelection = new Set(next);
      $("sample").value = next[0] || "01";
      refreshWAVList();
    }
  };
function resetChartPositionStatus() {
  statusPointer = null;
  timeStatus = { start: 0, length: 0 };
  for (const key of ["column", "note", "measure", "grid", "reduced", "measurePosition", "absolute", "length", "hidden"])
    ui.raw($("status-" + key), "");
}
function rebuildColumns(updateCount = true) {
  const pomu = isNineKeyLayout();
  if (updateCount) $("count").textContent = String(playableNoteCount(statistics(chart, { nt: $("lnstyle").value === "nt" }), pomu ? themes.Pomu : null, showsSecondPlayer(chart)));
  const bgm = Math.max(bgmMinimum, maxBGM(chart));
  columns = originalColumns({
    double: pomu || showsSecondPlayer(chart),
    bpm: $("showbpm").checked,
    stop: $("showstop").checked,
    bga: $("showbga").checked,
    bgm,
  });
  if (currentTheme) {
    let left = 0;
    for (const col of columns) {
      // A nine-key skin must not hide the keys of a SINGLE/DOUBLE chart.
      const laneTheme = !pomu && isPomuTheme(currentTheme) && col.id >= 4 && col.id <= 20
        ? themes.IIDX : currentTheme;
      const style = laneTheme.columns.find(
        (c) => Number(c.Index) === (col.id >= 26 ? 26 : col.id),
      );
      if (style) {
        col.width = Math.max(0, Number(style.Width));
        col.title = (style.Title || "") + (col.id >= 26 ? col.id - 25 : "");
        col.theme = style;
      }
      col.left = left;
      left += col.width;
    }
  }
  let columnLeft = 0;
  columns = columns.filter(col => col.width > 0 &&
    (editorMode(chart) !== "PMS" || col.id < 4 || col.id > 20 || pomuColumns.includes(col.id)));
  for (const col of columns) {
    col.width *= (Number($("widthzoom").value) || 1) * editorZoom;
    col.left = columnLeft;
    columnLeft += col.width;
  }
  columns = fillBGMColumns(columns, Math.max(0,
    ...panes.filter(p => !p.panel.hidden).map(p => p.view.clientWidth)));
  $("bgmcount").value = String(columns.filter(col => col.channel === "01").length);
  const lastColumn = columns.at(-1);
  contentWidth = lastColumn ? lastColumn.left + lastColumn.width : 0;
  for (const pane of panes) {
    pane.space.style.width = contentWidth + "px";
    const heads = pane.heads;
    heads.hidden = !$("showcolumncaption").checked;
    heads.replaceChildren();
    heads.style.font = editorFont("ColumnTitleFont", "10px Tahoma");
    heads.style.minHeight = 24 * editorZoom + "px";
    heads.style.color = visualColor(currentTheme, "ColumnTitle", "#ddd");
    heads.style.backgroundColor = visualColor(currentTheme, "Bg", "#000");
    heads.style.width = contentWidth + "px";
    heads.style.gridTemplateColumns = columns
      .map((c) => c.width + "px")
      .join(" ");
    for (const col of columns) {
      const b = document.createElement("b");
      b.textContent = col.title;
      b.style.backgroundColor = $("showbackground").checked && col.theme ? argb(col.theme.BG) : "transparent";
      heads.append(b);
    }
  }
}
function laneOf(e) {
  return columns.findIndex((c) => c.id === renderCache.column(e));
}
function y(beat) {
  return height - editorInset() - beat * scale;
}
function draw() {
  for (const pane of panes) if (!pane.panel.hidden) drawPane(pane);
  refreshPositionStatus();
}
function drawPane(pane) {
  const view = pane.view,
    canvas = pane.canvas,
    ctx = canvas.getContext("2d"),
    width = view.clientWidth;
  pane.renderGeometry = {
    height,
    scale,
    top: view.scrollTop,
    pixelRatio: devicePixelRatio,
    bottomInset: editorInset(),
  };
  const top = view.scrollTop,
    y = (beat) => top + displayedBeatY(pane.renderGeometry, beat),
    left = view.scrollLeft,
    h = view.clientHeight;
  if (!h || !starts.length) return;
  canvas.width = Math.round(width * devicePixelRatio);
  canvas.height = Math.round(h * devicePixelRatio);
  canvas.style.width = width + "px";
  canvas.style.height = h + "px";
  canvas.style.transform = `translate(${left}px,${top}px)`;
  pane.heads.style.transform = `translateX(${-left}px)`;
  ctx.setTransform(
    devicePixelRatio,
    0,
    0,
    devicePixelRatio,
    -left * devicePixelRatio,
    -top * devicePixelRatio,
  );
  ctx.lineWidth = editorZoom;
  ctx.fillStyle = visualColor(currentTheme, "Bg", "#000");
  ctx.fillRect(left, top, width, h);
  if ($("showbackground").checked) for (const col of columns) {
    ctx.fillStyle = col.theme
      ? argb(col.theme.BG)
      : !col.channel
        ? "#101010"
        : col.scratch
          ? "#301919"
          : col.channel[0] === "0"
            ? "#0a0a0a"
            : Number(col.title.slice(1)) % 2
              ? "#0c1620"
              : "#181818";
    ctx.fillRect(col.left, top, col.width, h);
  }
  if ($("showvertical").checked) {
    ctx.strokeStyle = visualColor(currentTheme, "VLine", "#000");
    ctx.beginPath();
    for (const col of columns) {
      if (col.left < left || col.left > left + width) continue;
      ctx.moveTo(col.left, top);
      ctx.lineTo(col.left, top + h);
    }
    ctx.stroke();
  }
  const measureTextColor = currentTheme?.columns.find(c => Number(c.Index) === 0)?.TextColor;
  ctx.font = editorFont("kMFont", "10px monospace");
  for (let m = 0; m < 1000; m++) {
    const bottom = y(starts[m]),
      upper = y(starts[m + 1]);
    if (bottom < top || upper > top + h) continue;
    const line = (offset, color) => {
      const yy = y(starts[m] + offset);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(contentWidth, yy);
      ctx.stroke();
    };
    for (const [id, flag, themeKey, fallback] of [
      ["grid", "showgrid", "Grid", "#222"],
      ["subgrid", "showsubgrid", "Sub", "#404040"],
    ])
      if ($(flag).checked)
        for (const offset of gridOffsets(starts[m + 1] - starts[m], $(id).value))
          line(offset, visualColor(currentTheme, themeKey, fallback));
    if ($("showmeasureline").checked) line(0, visualColor(currentTheme, "MLine", "#808080"));
    if ($("showmeasureindex").checked) {
      ctx.fillStyle = measureTextColor === undefined ? "#ddd" : noteColor(measureTextColor);
      ctx.fillText(String(m).padStart(3, "0"), 10 * editorZoom, bottom - 5 * editorZoom);
    }
  }
  drawWaveOverlay(ctx, top, left, h);
  const preview = drag?.preview;
  const displayedErrors = preview?.errorEvents || errorEvents;
  for (const [a, b] of renderCache.visiblePairs(
    (height - editorInset() - top - h) / scale,
    (height - editorInset() - top) / scale,
  )) {
    if ([a, b].some(note => preview?.hiddenIds.has(eventId(note)))) continue;
    const col = columns[laneOf(a)];
    if (!col || col.width <= 0) continue;
    ctx.fillStyle = noteColor(columnStyle(col).LongNoteColor);
    ctx.globalAlpha = /^[3478]/.test(a.channel) ? visualNumber(currentTheme, "kOpacity", 0.5) : 1;
    ctx.fillRect(
      col.left + 2 * editorZoom,
      y(b.beat),
      col.width - 4 * editorZoom,
      Math.max(0, y(a.beat) - y(b.beat) - noteHeight()),
    );
    ctx.globalAlpha = 1;
  }
  for (const e of renderCache.visible(
    (height - editorInset() - top - h - noteHeight() - 2) / scale,
    (height - editorInset() - top + noteHeight() + 2) / scale,
  )) {
    if (preview?.hiddenIds.has(eventId(e))) continue;
    const col = columns[laneOf(e)],
      yy = y(e.beat);
    if (!col || col.width <= 0 || yy < top - noteHeight() || yy > top + h + noteHeight()) continue;
    const hidden = /^[3478]/.test(e.channel);
    paintNote(ctx, col, yy, {
      height: noteHeight(), zoom: editorZoom, opacity: visualNumber(currentTheme, "kOpacity", 0.5), selectedColor: visualColor(currentTheme, "kSelected", "red"),
      long: e.bgmLong || /^[5678]/.test(e.channel),
      hidden,
      selected:
        selectedIds.has(eventId(e)) ||
        (selected?.row === e.row && selected?.index === e.index),
    });
    if (displayedErrors.has(eventId(e))) {
      ctx.strokeStyle = visualColor(currentTheme, "kError", "red");
      ctx.strokeRect(col.left + 2 * editorZoom, yy - noteHeight(), Math.max(0, col.width - 4 * editorZoom), noteHeight());
    }
    const label =
      $("showfilename").checked && col.id > 2
        ? ([22, 23, 24].includes(col.id)
            ? bmpNames[e.value]
            : chart.resources.WAV[e.value]) || e.value
        : String(numericValue(chart, e));
    drawNoteLabel(ctx, col, yy, label, e.bgmLong || /^[5678]/.test(e.channel));
    ctx.globalAlpha = 1;
  }
  if (drag?.preview) {
    ctx.save();
    ctx.globalAlpha = 1;
    for (const [a, b] of drag.preview.pairs) {
      const col = columns.find((c) => c.id === a.column);
      if (!col || col.width <= 0) continue;
      ctx.fillStyle = noteColor(columnStyle(col).LongNoteColor);
      ctx.fillRect(
        col.left + 2 * editorZoom,
        y(b.beat),
        col.width - 4 * editorZoom,
        Math.max(0, y(a.beat) - noteHeight() - y(b.beat)),
      );
    }
    for (const note of drag.preview.notes) {
      const col = columns.find((c) => c.id === note.column),
        yy = y(note.beat);
      if (!col || col.width <= 0 || yy < top - noteHeight() || yy > top + h + noteHeight())
        continue;
      paintNote(ctx, col, yy, {
      height: noteHeight(), zoom: editorZoom, opacity: visualNumber(currentTheme, "kOpacity", 0.5), selectedColor: visualColor(currentTheme, drag.resize ? "kMouseOverE" : "kSelected", "red"),
        long: note.bgmLong || /^[5678]/.test(note.channel),
        hidden: /^[3478]/.test(note.channel),
        selected: true,
      });
      if (displayedErrors.has(eventId(note))) {
        ctx.strokeStyle = visualColor(currentTheme, "kError", "red");
        ctx.strokeRect(col.left + 2 * editorZoom, yy - noteHeight(), Math.max(0, col.width - 4 * editorZoom), noteHeight());
      }
      ctx.fillStyle = "#fff";
      drawNoteLabel(ctx, col, yy, String(note.number ?? note.value), note.bgmLong || /^[5678]/.test(note.channel));
    }
    ctx.restore();
  }
  if (writePointer?.currentTarget === canvas && $("tool").value === "write" && !drag) {
    const p = location(writePointer);
    if (p) {
      const rect = canvas.getBoundingClientRect();
      const px = left + (writePointer.clientX - rect.left) * canvas.width / (rect.width * devicePixelRatio);
      const py = top + (writePointer.clientY - rect.top) * canvas.height / (rect.height * devicePixelRatio);
      const col = columns[p.lane], yy = y(snappedBeat(p));
      ctx.save();
      ctx.strokeStyle = visualColor(currentTheme, "kMouseOver", "#63ffff");
      ctx.lineWidth = editorZoom;
      ctx.strokeRect(col.left + 2 * editorZoom, yy - noteHeight(), col.width - 4 * editorZoom, noteHeight());
      ctx.beginPath();
      ctx.moveTo(col.left, yy); ctx.lineTo(col.left + col.width, yy);
      ctx.stroke();
      ctx.strokeStyle = "#ff9e38";
      ctx.beginPath();
      ctx.moveTo(px - 4 * editorZoom, py); ctx.lineTo(px + 4 * editorZoom, py);
      ctx.moveTo(px, py - 4 * editorZoom); ctx.lineTo(px, py + 4 * editorZoom);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (statusPointer?.currentTarget === canvas && $("tool").value === "select" && !drag && currentTheme?.visual?.kMouseOver?.Value !== undefined) {
    const p = location(statusPointer), hovered = p && hit(p);
    if (hovered) {
      const col = columns[laneOf(hovered)], group = noteGroup(chart, hovered, $("lnstyle").value === "nt");
      const first = Math.min(...group.map(note => note.beat)), last = Math.max(...group.map(note => note.beat));
      ctx.save();
      ctx.strokeStyle = visualColor(currentTheme, "kMouseOver", "#63ffff");
      ctx.strokeRect(col.left + 2 * editorZoom, y(last) - noteHeight(), Math.max(0, col.width - 4 * editorZoom), y(first) - y(last) + noteHeight());
      ctx.restore();
    }
  }
  if (playBeat !== null) {
    ctx.strokeStyle = "#ffeb3b";
    ctx.beginPath();
    ctx.moveTo(0, y(playBeat));
    ctx.lineTo(contentWidth, y(playBeat));
    ctx.stroke();
  }
  if (box) {
    const time = $("tool").value === "time";
    const border = visualColor(currentTheme, "SelBox", "#ffda50");
    ctx.strokeStyle = time ? visualColor(currentTheme, "TSCursor", border) : border;
    ctx.fillStyle = time ? visualColor(currentTheme, "TSSel", "#ffda5020") : "#ffda5020";
    const x = Math.min(box.x0, box.x1),
      yy = Math.min(box.y0, box.y1),
      w = Math.abs(box.x1 - box.x0),
      h = Math.abs(box.y1 - box.y0);
    ctx.fillRect(x, yy, w, h);
    ctx.strokeRect(x, yy, w, h);
    if (time && currentTheme?.visual?.TSHalf?.Value !== undefined) {
      ctx.strokeStyle = visualColor(currentTheme, "TSHalf", "transparent");
      ctx.beginPath();
      ctx.moveTo(x, yy + h / 2);
      ctx.lineTo(x + w, yy + h / 2);
      ctx.stroke();
    }
  }
}
function location(e) {
  const target = e.currentTarget,
    view = panes.find((p) => p.canvas === target).view,
    r = target.getBoundingClientRect(),
    x = e.clientX - r.left + view.scrollLeft;
  const pane = panes.find((p) => p.canvas === target);
  const rendered = pane.renderGeometry || {
    height,
    scale,
    top: view.scrollTop,
    pixelRatio: devicePixelRatio,
    bottomInset: editorInset(),
  };
  const lane = columns.findIndex(
    (c) => c.channel && x >= c.left && x < c.left + c.width,
  );
  if (lane < 0) return null;
  const position = pointerPosition(
    starts,
    rendered,
    r,
    target.height,
    e.clientY,
    Math.max(1, Math.min(65536, Number($("grid").value) || 16)),
    $("snap").checked,
  );
  return position && { ...position, lane };
}
function rememberStatusPointer(e) {
  statusPointer = { currentTarget: e.currentTarget, clientX: e.clientX, clientY: e.clientY };
  status("");
}
function refreshPositionStatus() {
  const time = $("tool").value === "time";
  $("positionstatus").hidden = time;
  $("timestatus").hidden = !time;
  if (time) {
    $("status-time-start").textContent = statusNumber(timeStatus.start * 48);
    $("status-time-length").textContent = statusNumber(timeStatus.length * 48);
    $("status-time-half").textContent = statusNumber(timeStatus.length * 24);
    return;
  }
  if (!statusPointer || starts.length < 2) return;
  const p = location(statusPointer);
  if (!p) return;
  const writing = $("tool").value === "write";
  let note = writing ? null : hit(p);
  let length = "", hidden = "", lengthValue = null;
  if (note) {
    const pair = renderCache.pairs.find(pair => pair.some(n => eventId(n) === eventId(note)));
    if ($("lnstyle").value === "nt") {
      if (pair) note = pair[0];
      length = "长度 = {0}"; lengthValue = statusNumber(pair ? (pair[1].beat - pair[0].beat) * 48 : 0);
    } else if (note.bgmLong || /^[5678]/.test(note.channel)) length = "长音符";
    if (/^[3478]/.test(note.channel)) hidden = "隐藏";
  } else if (writing) {
    if (drag?.ntwrite && drag.preview) {
      const notes = drag.preview.notes;
      length = "长度 = {0}"; lengthValue = statusNumber((notes.at(-1).beat - notes[0].beat) * 48);
    } else if ($("notetype").value === "long") length = "长音符";
    if ($("hiddennote").checked) hidden = "隐藏";
  }
  const beat = note ? note.beat : !writing && !$("snap").checked ? p.beat : snappedBeat(p);
  const values = positionStatus(starts, beat, Number($("grid").value) || 16);
  if (!values) return;
  const col = columns[note ? laneOf(note) : p.lane];
  $("status-column").textContent = col?.title || "";
  $("status-note").textContent = note ? String(numericValue(chart, note))
    : writing ? (col.id <= 2 ? $("eventvalue").value : $("sample").value) : "";
  for (const [key, value] of Object.entries(values)) $("status-" + key).textContent = value;
  ui.text($("status-length"), length, lengthValue);
  ui.text($("status-hidden"), hidden);
}
function place(p, value) {
  const col = columns[p.lane];
  writeColumn(
    chart,
    col,
    p.measure,
    p.slot,
    p.division,
    value ??
      (col.id <= 2 ? $("eventvalue").value : normalizeId(chart, $("sample").value)),
    { long: $("notetype").value === "long", hidden: $("hiddennote").checked },
  );
}
function hit(p) {
  const endpoint = renderCache
    .visible(p.beat - (noteHeight() + 1) / scale, p.beat + (noteHeight() + 1) / scale)
    .find(
      (e) =>
        !drag?.preview?.hiddenIds.has(eventId(e)) &&
        laneOf(e) === p.lane &&
        p.beat >= e.beat &&
        (p.beat - e.beat) * scale <= noteHeight(),
    );
  if (endpoint) return endpoint;
  if ($("lnstyle").value === "nt" || columns[p.lane].channel === "01") {
    const pair = renderCache.pairs.find(
      ([a, b]) => ![a, b].some(note => drag?.preview?.hiddenIds.has(eventId(note))) &&
        laneOf(a) === p.lane && p.beat >= a.beat && p.beat <= b.beat,
    );
    return pair?.[0];
  }
}
canvas.onpointerdown = (e) => {
  if (e.button !== 0) return;
  const p = location(e);
  if (!p) return;
  rememberStatusPointer(e);
  refreshPositionStatus();
  keyboardPane = panes.find(pane => pane.canvas === e.currentTarget);
  const found = hit(p);
  if ($("tool").value === "write") {
    writePointer = { currentTarget: e.currentTarget, clientX: e.clientX, clientY: e.clientY };

  }
  if (!e.deferredTouch) e.currentTarget.setPointerCapture(e.pointerId);
  const mode = $("tool").value;
  if (mode !== "write" && (!found || (mode === "time" && e.deferredTouch))) {
    $("measure").value = String(p.measure);
    $("measure").onchange();
    if (!e.ctrlKey && !e.metaKey) selectedIds.clear();
    const view = panes.find((p) => p.canvas === e.currentTarget).view,
      r = e.currentTarget.getBoundingClientRect(),
      x = e.clientX - r.left + view.scrollLeft,
      yy = e.clientY - r.top + view.scrollTop;
    box = {
      x0: mode === "time" ? 0 : x,
      x1: mode === "time" ? contentWidth : x,
      y0: yy,
      y1: yy,
    };
    drag = { box: true, start: p };
    if (mode === "time") timeStatus = { start: snappedBeat(p), length: 0 };
    draw();
    return;
  }
  if (found) {
    selected = found;
    if (e.ctrlKey || e.metaKey) {
      if (selectedIds.has(eventId(found))) selectedIds.delete(eventId(found));
      else selectedIds.add(eventId(found));
    } else if (!selectedIds.has(eventId(found))) {
      selectedIds.clear();
      selectedIds.add(eventId(found));
    }
    if ($("lnstyle").value === "nt" || found.bgmLong) {
      for (const pair of longPairs(chart).pairs) {
        if (pair.some((n) => selectedIds.has(eventId(n))))
          pair.forEach((n) => selectedIds.add(eventId(n)));
      }
    }
    drag = {
      resize:
        $("lnstyle").value === "nt" &&
        e.shiftKey &&
        Math.abs(found.beat - p.beat) * scale <= noteHeight(),
      upper: (() => {
        const group = noteGroup(chart, found);
        return group.length === 1 || eventId(found) === eventId(group.at(-1));
      })(),
      found,
      notes: captureNotes(chart, selectedIds),
      x: e.clientX,
      y: e.clientY,
      start: p,
      copy: e.ctrlKey || e.metaKey,
    };
    if ($("previewclick").checked && eventColumn(chart, found) > 2)
      preview(chart.resources.WAV[found.value]);
    draw();
  } else if (
    $("lnstyle").value === "nt" &&
    columns[p.lane].id >= 4 &&
    columns[p.lane].id <= 20
  ) {
    drag = { ntwrite: true, start: p, x: e.clientX, y: e.clientY };
  } else mutate(() => place(p));
};
let dragScrollTimer = null,
  dragPointer = null;
function stopDragScroll() {
  clearInterval(dragScrollTimer);
  dragScrollTimer = null;
  dragPointer = null;
}
function snappedBeat(p) {
  return (
    starts[p.measure] +
    (p.slot / p.division) * (starts[p.measure + 1] - starts[p.measure])
  );
}
function updateDragPreview(e) {
  if (!drag || drag.box) return;
  if (!drag.preview && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
  const p = location(e);
  const position = p && [p.lane, snappedBeat(p), $("verticaloff").checked, $("lnstyle").value].join(":");
  if (position && position === drag.previewPosition) return;
  drag.previewPosition = position;
  drag.preview = null;
  if (!p) return;
  try {
    if (drag.ntwrite) {
      const column = columns[drag.start.lane].id;
      const beats = [snappedBeat(drag.start), snappedBeat(p)].sort(
        (a, b) => a - b,
      );
      const channel =
        String(
          Number(columns[drag.start.lane].channel[0]) +
            ($("hiddennote").checked ? 2 : 0) +
            (beats[0] === beats[1] ? 0 : 4),
        ) + columns[drag.start.lane].channel[1];
      const notes = (beats[0] === beats[1] ? [beats[0]] : beats).map(
        (beat) => ({ beat, column, channel, value: $("sample").value }),
      );
      drag.preview = { notes, pairs: notes.length === 2 ? [notes] : [] };
    } else if (drag.resize) {
      const plan = planNoteResize(
        chart,
        new Set(drag.notes.map(eventId)),
        drag.upper,
        snappedBeat(p) - drag.found.beat,
      );
      drag.preview = { notes: plan.plans, pairs: plan.expectedPairs };
    } else {
      const deltaBeat = $("verticaloff").checked
        ? 0
        : snappedBeat(p) - snappedBeat(drag.start);
      const deltaColumn = columns[p.lane].id - columns[drag.start.lane].id;
      const moved = isNineKeyLayout()
        ? shiftVisibleNotes(drag.notes, columns[drag.start.lane].id, columns[p.lane].id, columns)
        : drag.notes.map(n => ({ ...n, column: n.column + deltaColumn }));
      const notes = moved.map((n) => ({
        ...n,
        beat: n.beat + deltaBeat,
      }));
      const map = new Map(notes.map((n) => [eventId(n), n]));
      const pairs = longPairs(chart)
        .pairs.filter((pair) => drag.copy
          ? pair.every(n => map.has(eventId(n)))
          : pair.some(n => map.has(eventId(n))))
        .map((pair) => pair.map((n) => map.get(eventId(n)) || { ...n, column: renderCache.column(n) }));
      drag.preview = { notes, pairs };
    }
    drag.sourceNotes ??= renderCache.all.map(note => ({ ...note, column: renderCache.column(note) }));
    drag.preview = createDragPreview(chart, drag.sourceNotes, drag.notes || [], drag.preview, {
      copy: drag.copy && !drag.resize, nt: $("lnstyle").value === "nt",
    });
  } catch {
    drag.preview = null;
  }
}
function updateSelectionBox(e) {
  if (!drag?.box) return;
  const view = panes.find((p) => p.canvas === e.currentTarget).view,
    r = e.currentTarget.getBoundingClientRect();
  if ($("tool").value !== "time") box.x1 = e.clientX - r.left + view.scrollLeft;
  box.y1 = e.clientY - r.top + view.scrollTop;
  if ($("tool").value === "time") {
    const p = location(e);
    if (p) timeStatus = { start: snappedBeat(drag.start), length: snappedBeat(p) - snappedBeat(drag.start) };
  }
}
canvas.onpointermove = (e) => {
  rememberStatusPointer(e);
  refreshPositionStatus();
  if (!drag) {
    if ($("tool").value === "write") {
      writePointer = { currentTarget: e.currentTarget, clientX: e.clientX, clientY: e.clientY };
      draw();
    } else if ($("tool").value === "select" && currentTheme?.visual?.kMouseOver?.Value !== undefined) draw();
    return;
  }
  dragPointer = {
    currentTarget: e.currentTarget,
    clientX: e.clientX,
    clientY: e.clientY,
  };
  updateSelectionBox(e);
  updateDragPreview(e);
  if (dragScrollTimer === null)
    dragScrollTimer = setInterval(() => {
      if (!drag || !dragPointer) return stopDragScroll();
      const p = dragPointer,
        view = panes.find((pane) => pane.canvas === p.currentTarget).view;
      const r = p.currentTarget.getBoundingClientRect();
      const speed = (v, size) =>
        v < 24
          ? -Math.min(20, (24 - v) / 2)
          : v > size - 24
            ? Math.min(20, (v - size + 24) / 2)
            : 0;
      view.scrollTop = Math.max(
        0,
        Math.min(
          height - view.clientHeight,
          view.scrollTop + speed(p.clientY - r.top, view.clientHeight),
        ),
      );
      view.scrollLeft = Math.max(
        0,
        Math.min(
          contentWidth - view.clientWidth,
          view.scrollLeft + speed(p.clientX - r.left, view.clientWidth),
        ),
      );
      updateSelectionBox(p);
      updateDragPreview(p);
      draw();
    }, 16);
  draw();
};
canvas.onpointerup = (e) => {
  stopDragScroll();
  if (!drag) return;
  const d = drag;
  drag = null;
  draw();
  if (d.ntwrite) {
    const p =
      Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5
        ? d.start
        : location(e) || d.start;
    const a = d.start,
      b = { ...p, lane: a.lane };
    const startBeat =
      starts[a.measure] +
      (a.slot / a.division) * (starts[a.measure + 1] - starts[a.measure]);
    const endBeat =
      starts[b.measure] +
      (b.slot / b.division) * (starts[b.measure + 1] - starts[b.measure]);
    mutate(() => {
      const col = columns[a.lane],
        value = normalizeId(chart, $("sample").value),
        hidden = $("hiddennote").checked;
      writeColumn(chart, col, a.measure, a.slot, a.division, value, {
        long: startBeat !== endBeat,
        hidden,
      });
      if (startBeat !== endBeat)
        writeColumn(chart, col, b.measure, b.slot, b.division, value, {
          long: true,
          hidden,
        });
    });
    return;
  }
  if (d.box) {
    const x0 = Math.min(box.x0, box.x1),
      x1 = Math.max(box.x0, box.x1),
      y0 = Math.min(box.y0, box.y1),
      y1 = Math.max(box.y0, box.y1);
    for (const n of events(chart)) {
      const c = columns[laneOf(n)];
      if (
        c &&
        c.left + c.width > x0 &&
        c.left < x1 &&
        y(n.beat) >= y0 &&
        y(n.beat) <= y1
      )
        selectedIds.add(eventId(n));
    }
    if ($("lnstyle").value === "nt") {
      for (const pair of longPairs(chart).pairs) {
        const col = columns[laneOf(pair[0])];
        if (
          col &&
          col.left + col.width > x0 &&
          col.left < x1 &&
          y(pair[0].beat) >= y0 &&
          y(pair[1].beat) <= y1
        )
          pair.forEach((n) => selectedIds.add(eventId(n)));
      }
    }
    box = null;
    draw();
    return;
  }
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
  const p = location(e);
  if (!p) return;
  if (d.resize) {
    const target =
      starts[p.measure] +
      (p.slot / p.division) * (starts[p.measure + 1] - starts[p.measure]);
    mutate(() =>
      resizeNotes(
        chart,
        new Set(d.notes.map(eventId)),
        d.upper,
        target - d.found.beat,
      ),
    );
    return;
  }
  const deltaColumn = columns[p.lane].id - columns[d.start.lane].id;
  const targetBeat =
    starts[p.measure] +
    (p.slot / p.division) * (starts[p.measure + 1] - starts[p.measure]);
  const deltaBeat = $("verticaloff").checked
    ? 0
    : targetBeat -
      (starts[d.start.measure] +
        (d.start.slot / d.start.division) *
          (starts[d.start.measure + 1] - starts[d.start.measure]));
  mutate(() =>
    isNineKeyLayout()
      ? putCaptured(chart, shiftVisibleNotes(d.notes, columns[d.start.lane].id, columns[p.lane].id, columns), { deltaBeat, copy: d.copy })
      : putCaptured(chart, d.notes, { deltaBeat, deltaColumn, copy: d.copy }),
  );
};
canvas.onpointerleave = () => { writePointer = null; statusPointer = null; draw(); };
canvas.onpointercancel = () => {
  writePointer = null;
  statusPointer = null;
  stopDragScroll();
  drag = null;
  box = null;
  draw();
};
canvas.oncontextmenu = (e) => {
  e.preventDefault();
  const p = location(e),
    n = p && hit(p);
  if (!n) return;
  if (e.shiftKey) {
    if (
      eventColumn(chart, n) <= 2 ||
      [22, 23, 24].includes(eventColumn(chart, n))
    )
      return;
    const source = noteGroup(chart, n, $("lnstyle").value === "nt")[0];
    $("sample").value = source.value;
    $("sample").onchange();
    status("已选取音源 {0}", source.value);
    return;
  }
  mutate(() => removeNoteGroup(chart, n, $("lnstyle").value === "nt"));
};
let editingNote = null;
canvas.ondblclick = (e) => {
  if ($("tool").value !== "select") return;
  const p = location(e),
    n = p && hit(p);
  if (!n) return;
  editingNote = n;
  const source = noteGroup(chart, n, $("lnstyle").value === "nt")[0];
  const column = eventColumn(chart, source);
  ui.text($("noteeditlabel"), column === 1 ? "BPM" : column === 2 ? "STOP" : "音符编号（按当前 BASE，62 区分大小写）");
  $("noteeditvalue").value = String(numericValue(chart, source));
  ui.text($("noteediterror"), "");
  $("noteeditdialog").showModal();
};
$("noteeditcancel").onclick = () => $("noteeditdialog").close();
$("noteeditapply").onclick = () => {
  if (!editingNote) return;
  if (
    mutate(() =>
      relabelNote(
        chart,
        editingNote,
        $("noteeditvalue").value,
        $("lnstyle").value === "nt",
      ),
    )
  ) {
    editingNote = null;
    $("noteeditdialog").close();
  } else ui.copyText($("noteediterror"), $("status"));
};
for (const pane of panes) {
  pane.view.onscroll = () => {
    const delta = pane.view.scrollTop - (pane.lastScrollTop ?? pane.view.scrollTop);
    pane.lastScrollTop = pane.view.scrollTop;
    const lock = (p) => $(p === panes[0] ? "scrolllock" : p === panes[1] ? "scrolllock-left" : "scrolllock-right").checked;
    if (lock(pane) && delta)
      for (const other of panes)
        if (other !== pane && lock(other)) {
          other.view.scrollTop += delta;
          other.lastScrollTop = other.view.scrollTop;
        }
    draw();
  };
  // Rebuilding lanes may change scrollbars and viewport width. Defer writes
  // until the next frame instead of resizing inside observer delivery.
  let resizeQueued = false;
  new ResizeObserver(() => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      rebuildColumns();
      draw();
    });
  }).observe(pane.view);
  if (pane.canvas !== canvas)
    for (const event of [
      "onpointerdown",
      "onpointermove",
      "onpointerup",
      "onpointercancel",
      "onpointerleave",
      "oncontextmenu",
      "ondblclick",
    ])
      pane.canvas[event] = canvas[event];
}
for (const [id, key] of [
  ["title", "TITLE"],
  ["artist", "ARTIST"],
  ["bpm", "BPM"],
  ["level", "PLAYLEVEL"],
  ["genre", "GENRE"],
])
  $(id).onchange = () => {
    const value = $(id).value;
    if (key === "BPM" && (!Number.isFinite(+value) || +value <= 0)) {
      status("BPM 必须为正数");
      refresh();
      return;
    }
    mutate(() => (chart.headers[key] = value));
  };
$("undo").onclick = () => {
  finishExpansionEdit();
  stop();
  chart = history.undo(chart);
  selected = null;
  selectedIds.clear();
  refresh();
};
$("redo").onclick = () => {
  finishExpansionEdit();
  stop();
  chart = history.redo(chart);
  selected = null;
  selectedIds.clear();
  refresh();
};
$("grid").onchange = draw;
$("subgrid").onchange = $("showsubgrid").onchange = draw;
function syncSidebarControls() {
  $("zoomslider").value = Math.min(5, Number($("zoom").value));
  $("widthslider").value = Math.min(5, Number($("widthzoom").value));
  for (const mode of ["absolute", "measure", "cut", "scale"])
    $("beat-" + mode).checked = $("beatmode").value === mode;
}
for (const mode of ["absolute", "measure", "cut", "scale"])
  $("beat-" + mode).onchange = () => {
    if (!$("beat-" + mode).checked) return;
    $("beatmode").value = mode;
    syncSidebarControls();
    persistPreferences();
  };
for (const [slider, input] of [["zoomslider", "zoom"], ["widthslider", "widthzoom"]]) {
  $(slider).oninput = () => {
    $(input).value = $(slider).value;
    $(input).onchange();
  };
  $(slider).onchange = persistPreferences;
}
let horizontalZoom = 1;
function changeHorizontalZoom(next, focusPane = null, anchor = 0) {
  if (!Number.isFinite(next) || next < 0.25 || next > 99) {
    $("widthzoom").value = horizontalZoom;
    status("横向缩放范围为 0.25–99");
    return;
  }
  const positions = panes.map(p => {
    const x = p === focusPane ? anchor : 0;
    return { x, position: (p.view.scrollLeft + x) / horizontalZoom };
  });
  horizontalZoom = next;
  $("widthzoom").value = next;
  rebuildColumns();
  panes.forEach((p, i) => {
    p.view.scrollLeft = Math.max(0, Math.min(contentWidth - p.view.clientWidth,
      positions[i].position * next - positions[i].x));
  });
  syncSidebarControls();
  draw();
}
$("widthzoom").onchange = () => changeHorizontalZoom(Number($("widthzoom").value));
function changeVerticalZoom(zoom, focusPane = null, anchor = 0) {
  if (!Number.isFinite(zoom) || zoom < 0.25 || zoom > 99) {
    $("zoom").value = scale / (48 * editorZoom);
    status("纵向缩放范围为 0.25–99");
    return;
  }
  const positions = panes.map(p => {
    const offset = p === focusPane ? anchor : p.view.clientHeight / 2;
    return { offset, beat: (height - editorInset() - p.view.scrollTop - offset) / scale };
  });
  scale = zoom * 48 * editorZoom;
  $("zoom").value = zoom;
  syncSidebarControls();
  refresh();
  panes.forEach((p, i) => {
    p.view.scrollTop = Math.max(0, Math.min(height - p.view.clientHeight,
      y(positions[i].beat) - positions[i].offset));
    // Zoom moves every pane explicitly; queued scroll events must not move it again.
    p.lastScrollTop = p.view.scrollTop;
  });
  draw();
}
$("zoom").onchange = () => changeVerticalZoom(Number($("zoom").value));
function changeEditorZoom(percent, focusPane = null, anchorX = 0, anchorY = 0) {
  if (!Number.isFinite(percent)) percent = editorZoom * 100;
  const next = Math.max(50, Math.min(300, Math.round(percent))) / 100;
  $("editorzoom").value = Math.round(next * 100);
  if (next === editorZoom) return;
  const pointerScreenY = focusPane ? focusPane.view.getBoundingClientRect().top + anchorY : null;
  const positions = panes.map(p => {
    const x = p === focusPane ? anchorX : p.view.clientWidth / 2;
    const y = p === focusPane ? anchorY : p.view.clientHeight / 2;
    return { x, y, column: (p.view.scrollLeft + x) / editorZoom,
      beat: (height - editorInset() - p.view.scrollTop - y) / scale };
  });
  editorZoom = next;
  scale = Number($("zoom").value) * 48 * editorZoom;
  // Zoom changes geometry only. Keep chart indexes, form edits and audio intact.
  rebuildColumns(false);
  setScrollExtent(scrollEndBeat(chart));
  panes.forEach((p, i) => {
    const position = positions[i];
    p.view.scrollLeft = Math.max(0, Math.min(contentWidth - p.view.clientWidth,
      position.column * next - position.x));
    p.view.scrollTop = Math.max(0, Math.min(height - p.view.clientHeight,
      y(position.beat) - (p === focusPane ? pointerScreenY - p.view.getBoundingClientRect().top : p.view.clientHeight / 2)));
    p.lastScrollTop = p.view.scrollTop;
  });
  draw();
}
$("editorzoom").onchange = () => changeEditorZoom(Number($("editorzoom").value));
for (const pane of panes) {
  pane.view.addEventListener("wheel", (event) => {
    if (navigation?.wheel(event, pane)) return;
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.shiftKey || drag || !Number.isFinite(event.deltaY) || !event.deltaY) return;
    const rect = pane.view.getBoundingClientRect();
    changeEditorZoom(editorZoom * 100 + (event.deltaY < 0 ? 10 : -10), pane,
      Math.max(0, Math.min(pane.view.clientWidth, event.clientX - rect.left)),
      Math.max(0, Math.min(pane.view.clientHeight, event.clientY - rect.top)));
    persistPreferences();
  }, { passive: false });
}
function applySelectedMeasureRatio(ratio) {
  const selected = [...$("measurelist").selectedOptions].map(o => Number(o.value));
  const measures = selected.length ? selected : [Number($("measure").value)];
  const ok = mutate(() => changeMeasureRatios(chart, measures, ratio,
    $("beatmode").value, { nt: $("lnstyle").value === "nt" }));
  if (ok) {
    $("ratio").value = String(ratio);
    const message = "已更新节拍";
    status(message); ui.text($("measurefeedback"), message);
  } else ui.copyText($("measurefeedback"), $("status"));
}
$("applysignature").onclick = () => {
  const n = Number($("beatnumerator").value), d = Number($("beatdenominator").value);
  if (!Number.isInteger(n) || !Number.isInteger(d) || n <= 0 || d <= 0) {
    ui.text($("measurefeedback"), "分子和分母必须为正整数");
    return;
  }
  applySelectedMeasureRatio(n/d);
};
$("applyratio").onclick = () => applySelectedMeasureRatio(Number($("ratio").value));
$("applyrangeratio").onclick = () => {
  const from = Number($("rangefrom").value),
    to = Number($("rangeto").value);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to > 999 ||
    from > to
  )
    return status("小节范围必须为 000–999，起点不得大于终点");
  mutate(() =>
    changeMeasureRatios(
      chart,
      Array.from({ length: to - from + 1 }, (_, i) => from + i),
      Number($("ratio").value),
      $("beatmode").value,
      { nt: $("lnstyle").value === "nt" },
    ),
  );
};
function syncMeasureInputs() {
  const ratio = chart.ratios[$("measure").value] || 1;
  $("ratio").value = String(ratio);
  const fraction = measureLabel($("measure").value, ratio).match(/\( (\d+) \/ (\d+) \)/);
  $("beatnumerator").value = fraction?.[1] || "";
  $("beatdenominator").value = fraction?.[2] || "";
}
function selectPasteMeasure() {
  pasteTarget = { chart, measure: Number($("measure").value),
    pane: keyboardPane, top: keyboardPane.view.scrollTop };
}
$("measurelist").onchange = () => {
  const first = $("measurelist").selectedOptions[0];
  if (first) {
    $("measure").value = first.value;
    syncMeasureInputs();
    selectPasteMeasure();
  }
};
$("measure").onchange = () => {
  selectPasteMeasure();
  for (const option of $("measurelist").children)
    option.selected = Number(option.value) === Number($("measure").value);
  syncMeasureInputs();
};
$("jump").onclick = () => {
  const m = +$("measure").value;
  if (Number.isInteger(m) && m >= 0 && m <= 999) {
    if (starts[m] * scale + 30 * editorZoom >= height)
      setScrollExtent(Math.min(starts.at(-1), starts[m] + 2000 / 48));
    $("viewport").scrollTop = y(starts[m]) - $("viewport").clientHeight + 30 * editorZoom;
    draw();
  }
};
$("new").onclick = async () => {
  if (dirty && !confirm(t("放弃尚未导出的修改？"))) return;
  await window.desktop?.newFile();
  $("encoding").value = generalOptions.defaultencoding;
  stop();
  chart = initializeEditorMode(parseBMS("#PLAYER 1\n#BPM 120\n#LNTYPE 1"));
  resetChartPositionStatus();
  $("saveformat").value = "bms";
  history.reset(chart);
  dirty = false;
  buffers.clear();
  clearSoundReport();
  wavSelection = new Set(["01"]);
  selected = null;
  selectedIds.clear();
  refresh();
  $("viewport").scrollTop = height;
};
let openingFile = false;
const pendingOpenWaiters = [];
let themeBeforePMS;
let presentedEditorMode = "SINGLE";
function isNineKeyLayout() {
  return editorMode(chart) === "PMS";
}
function syncEditorModePresentation(force = false) {
  const mode = editorMode(chart);
  if (!force && mode === presentedEditorMode) return;
  const wasPMS = presentedEditorMode === "PMS";
  if (mode === "PMS") {
    if (!wasPMS || !isPomuTheme(currentTheme)) themeBeforePMS = currentTheme;
    currentTheme = themes.Pomu;
    $("saveformat").value = "pms";
  } else {
    if (themeBeforePMS !== undefined || (wasPMS && isPomuTheme(currentTheme))) {
      currentTheme = themeBeforePMS ?? themes.IIDX;
      themeBeforePMS = undefined;
    }
    if ($("saveformat").value === "pms") $("saveformat").value = "bms";
  }
  presentedEditorMode = mode;
  syncThemeChoices();
}
function syncEditorModeControl() {
  const input = $("chartmode");
  if (!input) return;
  const selected = editorModeSelection(chart);
  input.replaceChildren();
  for (const [value, label] of editorModeChoices(chart)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selected;
    option.disabled = value.startsWith("legacy-");
    input.append(option);
  }
  input.value = selected;
}
function applyFileDefaults(name) {
  $("encoding").value = generalOptions.defaultencoding;
  initializeEditorMode(chart, { pms: /\.pms$/i.test(name) });
  syncEditorModePresentation(true);
  $("saveformat").value = /\.ibmscx$/i.test(name) ? "ibmscx" : /\.ibmsc$/i.test(name) ? "ibmsc" : editorMode(chart) === "PMS" ? "pms" : "bms";
}
async function openNativeFile(recentPath, droppedFile, kind, requestedToken) {
  if (openingFile) {
    if (!requestedToken) return;
    await new Promise(resolve => pendingOpenWaiters.push(resolve));
    return openNativeFile(recentPath, droppedFile, kind, requestedToken);
  }
  if (!window.desktop) {
    $("file").accept = kind === "sm" ? ".sm" : kind === "ibmsc" ? ".ibmsc" : ".bms,.bme,.bml,.pms,.ibmsc,.ibmscx,.sm";
    $("file").click();
    return;
  }
  let file;
  openingFile = true;
  const beforeOpen = JSON.stringify(chart);
  try {
    if (dirty && !confirm(t("放弃尚未保存的修改？"))) return;
    file = requestedToken ? await window.desktop.openRequestedFile(requestedToken) : droppedFile
      ? await window.desktop.openDropped(droppedFile)
      : recentPath
        ? await window.desktop.openRecent(recentPath)
        : await window.desktop.open(kind);
    if (!file) return;
    const next = await parseSelectedFile(file.name, file.bytes);
    if (!next) return;
    if (
      JSON.stringify(chart) !== beforeOpen &&
      !confirm(t("打开文件期间谱面发生了修改，仍要替换当前谱面？"))
    )
      return;
    const accepted = await window.desktop.acceptOpen(file.token);
    stop();
    chart = next;
    resetChartPositionStatus();
    applyFileDefaults(file.name);
    history.reset(chart);
    buffers.clear();
    clearSoundReport();
    wavSelection = new Set(["01"]);
    selected = null;
    selectedIds.clear();
    dirty = false;
    refresh();
    $("viewport").scrollTop = height;
    if (accepted?.warning) status(accepted.warning);
    else status("已打开 {0}", file.name);
    await refreshRecentFiles();
    await loadProjectSounds();
  } catch (e) {
    status(e.message);
  } finally {
    if (file?.token)
      await window.desktop.cancelOpen(file.token).catch(() => {});
    openingFile = false;
    for (const resolve of pendingOpenWaiters.splice(0)) resolve();
  }
}
$("open").onclick = () => openNativeFile();
$("importsm").onclick = () => openNativeFile(null, null, "sm");
$("importibmsc").onclick = () => openNativeFile(null, null, "ibmsc");
$("quit").onclick = () => window.close();
$("checkupdates").onclick = () => window.desktop?.website ? window.desktop.website() :
    window.open("https://github.com/RM-801/iBMSC-electron/releases", "_blank", "noopener");
async function refreshRecentFiles() {
  const container = $("recentfiles");
  container.hidden = !window.desktop?.recent;
  if (!window.desktop?.recent) return;
  try {
    const files = await window.desktop.recent();
    container.replaceChildren();
    files.forEach((filename, index) => {
      const button = document.createElement("button");
      button.textContent = `${index + 1}. ${filename}`;
      button.title = filename;
      button.onclick = () => openNativeFile(filename);
      container.append(button);
    });
  } catch (e) {
    status(e.message);
  }
}
async function openBrowserFile(f) {
  if (!f) return;
  try {
    const data = await f.arrayBuffer();
    const next = await parseSelectedFile(f.name, data);
    if (!next) return;
    if (dirty && !confirm(t("放弃尚未导出的修改？"))) return;
    stop();
    chart = next;
    resetChartPositionStatus();
    applyFileDefaults(f.name);
    history.reset(chart);
    buffers.clear();
    clearSoundReport();
    wavSelection = new Set(["01"]);
    selected = null;
    selectedIds.clear();
    dirty = false;
    refresh();
    $("viewport").scrollTop = height;
    status("已打开 {0}", f.name);
  } catch (e) {
    status(e.message);
  } finally {
    $("file").value = "";
  }
}
$("file").onchange = () => openBrowserFile($("file").files[0]);
function confirmedSaveSnapshot(format = $("saveformat").value) {
  finishExpansionEdit();
  const snapshot = structuredClone(chart);
  if (["ibmsc", "ibmscx"].includes(format) || !bgmLongEvents(snapshot).length) return snapshot;
  if (!confirm(t("BGM 区不可以在 BMS 中存放 LN/CN。继续保存会将这些长音符转为仅在起点播放的普通 BGM 音符，终点不会保存。编辑器中的暂存长条仍保留。是否继续？"))) return null;
  return flattenBGMLongs(snapshot);
}
function serializeForExport(snapshot) {
  return serializeBMS(prepareBMSExport(snapshot, { maxGrid: generalOptions.maxgrid,
    bpmExtended: generalOptions.bpmextended, stopExtended: generalOptions.stopextended }));
}
async function savedBeep() {
  if (!generalOptions.beepsaved) return;
  try {
    if (window.desktop?.beep) { await window.desktop.beep(); return; }
    const audio = await context(), oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.frequency.value = 880; gain.gain.value = 0.06;
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.08);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* A disabled audio device must not turn a successful save into an error. */ }
}
function savePayload(snapshot) {
  const format = $("saveformat").value;
  return {
    format,
    name:
      (snapshot.headers.TITLE || "untitled") +
      (format === "ibmscx" ? ".ibmscx" : format === "ibmsc" ? ".ibmsc" : format === "pms" ? ".pms" : ".bms"),
    ...(format === "ibmscx" ? { text: writePortableProject(snapshot) } : format === "ibmsc"
      ? { bytes: writeProject(snapshot) }
      : { text: serializeForExport(snapshot) }),
  };
}
$("save").onclick = async () => {
  if (window.desktop) {
    try {
      const saveSnapshot = confirmedSaveSnapshot();
      if (!saveSnapshot) return;
      const result = await window.desktop.save({
        ...savePayload(saveSnapshot),
        encoding: $("encoding").value,
        saveAs: false,
      });
      if (result) {
        if (result.encoding) $("encoding").value = result.encoding;
        history.markSaved(saveSnapshot);
        await savedBeep();
        refresh();
        if (result.warning) status(result.warning);
        else status("已保存 {0}", result.name);
        await refreshRecentFiles();
      }
    } catch (e) {
      status(e.message);
    }
    return;
  }
  if ($("saveformat").value === "ibmscx") {
    try { downloadText(writePortableProject(chart), (chart.headers.TITLE || "untitled") + ".ibmscx"); status("已开始下载"); await savedBeep(); }
    catch (e) { status(e.message); }
    return;
  }
  if ($("saveformat").value === "ibmsc") {
    $("projectexport").click();
    return;
  }
  const snapshot = confirmedSaveSnapshot("bms");
  if (!snapshot) return;
  let bytes;
  try { bytes = encodeBMS(serializeForExport(snapshot), $("encoding").value); }
  catch (e) { status(e.message); return; }
  const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/octet-stream" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download =
    (chart.headers.TITLE || "untitled").replace(/[\\/:*?"<>|]/g, "_") + ($("saveformat").value === "pms" ? ".pms" : ".bms");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  refresh();
  status("已开始下载");
  await savedBeep();
};
async function context() {
  audio ??= new AudioContext();
  await audio.resume();
  return audio;
}
async function preview(name) {
  try {
    const buffer = name && buffers.get(name.toLowerCase().replaceAll("\\", "/"));
    await keyPreview.play(buffer);
  } catch (e) {
    status(e.message);
  }
}
$("audiofiles").onclick = () =>
  window.desktop ? loadProjectSounds() : $("sounds").click();
$("audiofolder").hidden = Boolean(window.desktop);
$("audiofolder").onclick = () => {
  if (!("webkitdirectory" in $("soundfolder"))) {
    status("此浏览器不支持选择文件夹，请选择音源文件。");
    $("sounds").click();
    return;
  }
  $("soundfolder").click();
};
$("soundfolder").onchange = async () => {
  const files = [...$("soundfolder").files];
  if (!files.length) return;
  try {
    await loadProjectSounds(files);
  } finally {
    $("soundfolder").value = "";
  }
};
if (window.desktop) {
  ui.text($("audiofiles"), "重新关联音源");
}
async function loadBrowserSounds(files) {
  if (!files.length) return;
  const targetChart = chart,
    generation = ++soundLoadGeneration;
  const active = () =>
    chart === targetChart && generation === soundLoadGeneration;
  clearSoundReport();
  try {
    await context();
    let failed = 0;
    for (const f of files) {
      if (!active()) return;
      try {
        const data = await f.arrayBuffer();
        if (!active()) return;
        const decoded = await decodeAudio(audio, data);
        if (!active()) return;
        buffers.set(f.name.toLowerCase(), decoded);
        for (const name of Object.values(chart.resources.WAV)) {
          if (
            name.replaceAll("\\", "/").split("/").pop().toLowerCase() ===
            f.name.toLowerCase()
          )
            buffers.set(name.toLowerCase().replaceAll("\\", "/"), decoded);
        }
        if (
          !Object.values(chart.resources.WAV).some(
            (name) =>
              name.replaceAll("\\", "/").split("/").pop().toLowerCase() ===
              f.name.toLowerCase(),
          )
        ) {
          const id = resourceIds(chart).find((id) => !chart.resources.WAV[id]);
          if (!id) throw Error("WAV 编号已满");
          mutate(() => (chart.resources.WAV[id] = f.name));
        }
      } catch {
        failed++;
      }
    }
    if (!active()) return;
    refresh();
    ui.text($("soundstatus"), "已加载 {0} 个音源；失败 {1} 个", buffers.size, failed);
    status("已加载 {0} 个音源；失败 {1} 个", buffers.size, failed);
  } catch (e) {
    if (active()) status(e.message);
  } finally {
    $("sounds").value = "";
  }
}
$("sounds").onchange = () => loadBrowserSounds([...$("sounds").files]);
async function startPlayback(fromBeat = 0) {
  stop();
  const generation = playGeneration;
  try {
    await context();
    if (generation !== playGeneration) return;
    const map = timeMap(chart),
      offset = map.beatToSeconds(fromBeat),
      notes = playbackPlan(timeline(chart), offset, n => {
        const name = chart.resources.WAV[n.value];
        return name && buffers.get(name.toLowerCase().replaceAll("\\", "/"));
      }),
      start = audio.currentTime + 0.1;
    let next = 0,
      missing = 0,
      end = start;
    playClock = { map, start, offset };
    const schedule = () => {
      if (generation !== playGeneration) return;
      while (
        next < notes.length &&
        start + notes[next].at < audio.currentTime + 0.2
      ) {
        const voice = notes[next++], { buffer } = voice;
        if (!buffer) {
          missing++;
          continue;
        }
        const timing = voiceStart(voice, start, audio.currentTime);
        if (!timing) continue;
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(audio.destination);
        source.start(timing.when, timing.offset);
        end = Math.max(end, timing.end);
        sources.push(source);
        source.onended = () => {
          sources = sources.filter((s) => s !== source);
        };
      }
      if (next === notes.length && audio.currentTime >= end) {
        stop();
        draw();
        ui.text($("playstatus"), "播放结束；缺失音源 {0} 个", missing);
      }
    };
    const frame = () => {
      if (generation !== playGeneration || !playClock) return;
      playBeat = map.secondsToBeat(
        Math.max(0, audio.currentTime - start) + offset,
      );
      if ($("followplay").checked)
        $("viewport").scrollTop =
          y(playBeat) - $("viewport").clientHeight * 0.8;
      draw();
      playFrame = requestAnimationFrame(frame);
    };
    schedule();
    if (playClock) {
      playTimer = setInterval(schedule, 50);
      frame();
      ui.text($("playstatus"), "播放中，从第 {0} 拍开始", fromBeat.toFixed(3));
    }
  } catch (e) {
    stop();
    status(e.message);
  }
}
$("play").onclick = () => startPlayback();
$("playhere").onclick = () => startPlayback(starts[Number($("measure").value)] || 0);
$("stop").onclick = () => {
  stop();
  draw();
};
let keyboardPane = panes[0];
navigation = createChartNavigation({ panes, options: () => ({ ...generalOptions,
  tool: $("tool").value, middleRelease: visualNumber(currentTheme, "MiddleDeltaRelease", 1) }),
  scale: () => scale, height: () => height, activate: pane => { keyboardPane = pane; },
  draw, stopPreview: () => keyPreview.stop() });
const touchHandlers = new Map(panes.map(p => [p.canvas, {
  down: p.canvas.onpointerdown, move: p.canvas.onpointermove,
  up: p.canvas.onpointerup, cancel: p.canvas.onpointercancel,
}]));
let touchSelection = null, touchZoom = 100, touchZoomChanged = false;
function panTouch(target, dx, dy) {
  const pane = panes.find(p => p.canvas === target);
  pane.view.scrollLeft = Math.max(0, Math.min(Math.max(0, contentWidth - pane.view.clientWidth), pane.view.scrollLeft + dx));
  pane.view.scrollTop = Math.max(0, Math.min(Math.max(0, height - pane.view.clientHeight), pane.view.scrollTop + dy));
  // Synchronize locked panes immediately, before another pinch event changes scale.
  pane.view.onscroll();
}
const touchNavigation = createTouchGestures({
  focus(e) {
    navigation.stop();
    keyboardPane = panes.find(p => p.canvas === e.currentTarget);
    e.currentTarget.focus?.({ preventScroll: true });
    touchZoom = editorZoom * 100;
  },
  canEdit(e) {
    const p = location(e);
    if (!p) return false;
    // A held edit must be a preview until release; immediate writes remain taps.
    return $("tool").value !== "write" || Boolean(hit(p)) ||
      ($("lnstyle").value === "nt" && columns[p.lane].id >= 4 && columns[p.lane].id <= 20);
  },
  beginEdit(e) {
    touchSelection = { selected, ids: new Set(selectedIds), timeStatus: { ...timeStatus },
      measure: $("measure").value, pasteTarget };
    if (generalOptions.clickstop) keyPreview.stop();
    touchHandlers.get(e.currentTarget).down(e);
  },
  moveEdit: e => touchHandlers.get(e.currentTarget).move(e),
  endEdit(e) {
    touchHandlers.get(e.currentTarget).up(e);
    touchSelection = null;
    writePointer = null;
    draw();
  },
  cancelEdit(e) {
    touchHandlers.get(e.currentTarget).cancel();
    if (touchSelection) {
      selected = touchSelection.selected;
      selectedIds = touchSelection.ids;
      timeStatus = touchSelection.timeStatus;
      $("measure").value = touchSelection.measure;
      $("measure").onchange();
      pasteTarget = touchSelection.pasteTarget;
      touchSelection = null;
      draw();
    }
  },
  pan: panTouch,
  transform(target, ratio, previous, next) {
    const pane = panes.find(p => p.canvas === target), rect = pane.view.getBoundingClientRect();
    touchZoom = Math.max(50, Math.min(300, touchZoom * ratio));
    const before = editorZoom;
    changeEditorZoom(touchZoom, pane, previous.x - rect.left, previous.y - rect.top);
    touchZoomChanged ||= before !== editorZoom;
    panTouch(target, previous.x - next.x, previous.y - next.y);
  },
  finishNavigation() {
    if (touchZoomChanged) persistPreferences();
    touchZoomChanged = false;
  },
});
// Pointer cancellation/touch-action do not disable native text selection.
// In Safari, an active touchstart handler also suppresses the hold magnifier.
const preventChartBrowserGesture = e => { if (e.cancelable) e.preventDefault(); };
$("editorpanes").addEventListener("selectstart", preventChartBrowserGesture);
for (const pane of panes) {
  pane.canvas.tabIndex = 0;
  for (const event of ["touchstart", "touchmove"])
    pane.canvas.addEventListener(event, preventChartBrowserGesture, { passive: false });
  for (const [event, handler] of [["onpointerdown", "down"], ["onpointermove", "move"],
    ["onpointerup", "up"], ["oncontextmenu", "context"]]) {
    const original = pane.canvas[event];
    pane.canvas[event] = e => {
      if (touchNavigation[handler](e)) return;
      if (!navigation[handler](e)) return original(e);
    };
  }
  const cancel = pane.canvas.onpointercancel;
  pane.canvas.onpointercancel = e => {
    if (e && touchNavigation.cancel(e)) return;
    cancel(e);
  };
  pane.canvas.addEventListener("lostpointercapture", e => touchNavigation.cancel(e));
  pane.canvas.addEventListener("pointerenter", e => navigation.enter(e));
  pane.canvas.addEventListener("pointercancel", () => navigation.stop());
}
window.addEventListener("blur", () => { navigation.stop(); touchNavigation.stop(); });
window.addEventListener("pointermove", e => {
  if (navigation.isAuto() && !panes.some(pane => pane.canvas === e.target)) navigation.move(e);
});
window.addEventListener("pointerdown", e => {
  if (!panes.some(pane => pane.canvas === e.target)) touchNavigation.stop();
  if (navigation.isAuto() && !panes.some(pane => pane.canvas === e.target)) {
    navigation.stop(); e.preventDefault(); e.stopImmediatePropagation();
  }
}, true);
window.addEventListener("wheel", e => {
  if (navigation.isAuto() && !panes.some(pane => pane.view.contains?.(e.target))) navigation.stop();
}, { passive: true });
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { navigation.stop(); touchNavigation.stop(); }
  if (e.key === "Escape" && viewMenuOpen) {
    e.preventDefault();
    closeViewMenu();
    return;
  }
  if (e.key === "Escape") {
    const openMenu = mainMenus.find((menu) => menu.open);
    if (openMenu) {
      e.preventDefault();
      closeMainMenus();
      openMenu.querySelector("summary").focus();
      return;
    }
  }
  if (e.defaultPrevented || e.target.isContentEditable) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "F10" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    if (viewMenuOpen) closeViewMenu();
    else openViewMenu();
    return;
  }
  if (viewMenuOpen) return;
  // Measure controls target chart paste; text fields retain native clipboard editing.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" &&
      [$("measure"), $("measurelist")].includes(e.target)) {
    e.preventDefault();
    if (e.target === $("measure")) selectPasteMeasure();
    $("pastenotes").click();
    return;
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const mode = { F1: "time", F2: "select", F3: "write" }[e.key];
    if (mode) {
      e.preventDefault();
      $("tool-" + mode).click();
      return;
    }
    const playback = { F5: "play", F6: "playhere", F7: "stop" }[e.key];
    if (playback) {
      e.preventDefault();
      $(playback).click();
      return;
    }
    if (e.key === "F8") {
      e.preventDefault();
      $("toggleln").click();
      return;
    }
    if (/^[1-8]$/.test(e.key)) {
      const column = Number(e.key) + 3;
      if (!columns.some((c) => c.id === column && c.width > 0)) return;
      const notes = captureNotes(chart, selectedIds);
      if (notes.length) {
        e.preventDefault();
        mutate(() => {
          if (notes.some((n) => n.column <= 2))
            throw Error("BPM / STOP 不可转换为音符轨道");
          const plans = notes.map((n) => ({ ...n, column }));
          for (const n of notes) chart.rows[n.row].cells[n.index] = "00";
          putCaptured(chart, plans, { copy: true });
        });
      }
      return;
    }
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    const notes = captureNotes(chart, selectedIds);
    let plans;
    if (
      notes.length &&
      mutate(() => {
        plans = nudgeCaptured(
          chart,
          notes,
          e.key,
          Number($("grid").value),
          e.ctrlKey || e.metaKey,
          columns,
        );
      })
    ) {
      selectedIds = new Set(
        events(chart)
          .filter((event) =>
            plans.some(
              (n) =>
                n.column === eventColumn(chart, event) &&
                Math.abs(n.beat - event.beat) < 1e-9 &&
                n.value === event.value,
            ),
          )
          .map(eventId),
      );
        draw();
    }
    return;
  }
  if (!e.ctrlKey && !e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === "g") {
      $("snap").checked = !$("snap").checked;
      persistPreferences();
    }
    if ((e.code === "Equal" || e.code === "Minus") && !e.altKey) {
      e.preventDefault();
      $("zoom").value = Math.max(
        0.25,
        Math.min(
          99,
          Number($("zoom").value) + (e.code === "Equal" ? 0.25 : -0.25),
        ),
      );
      $("zoom").onchange();
      persistPreferences();
    }
    if (k === "," || k === ".") {
      e.preventDefault();
      const grid = Number($("grid").value);
      $("grid").value =
        k === ","
          ? Math.min(65536, grid * 2)
          : Math.max(1, Math.floor(grid / 2));
      persistPreferences();
      draw();
    }
    if (k === "l" || k === "s") {
      e.preventDefault();
      $("conversion").value = k === "l" ? "long" : "short";
      $("convertnotes").click();
    }
    if (e.code === "NumpadAdd" || e.code === "NumpadSubtract") {
      e.preventDefault();
      const index = Math.max(0, resourceIds(chart).indexOf($("sample").value));
      $("sample").value =
        resourceIds(chart)[
          Math.max(0, Math.min(resourceIds(chart).length - 1, index + (e.code === "NumpadAdd" ? 1 : -1)))
        ];
      $("sample").onchange();
    }
    if (["Home", "End", "PageUp", "PageDown"].includes(e.key)) {
      e.preventDefault();
      const view = keyboardPane.view,
        last = Math.max(0, height - view.clientHeight);
      view.scrollTop =
        e.key === "Home"
          ? last
          : e.key === "End"
            ? 0
            : Math.max(
                0,
                Math.min(
                  last,
                  view.scrollTop +
                    (e.key === "PageUp" ? -1 : 1) *
                      (generalOptions.pageunits / 48) *
                      scale,
                ),
              );
      draw();
    }
    if (k === "d") $("verticaloff").checked = !$("verticaloff").checked;
    if (k === " ") {
      e.preventDefault();
      $(playClock ? "stop" : "playhere").click();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    $(e.shiftKey ? "redo" : "undo").click();
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    $("deletenotes").click();
  }
  if (e.ctrlKey || e.metaKey) {
    const action = {
      a: "selectall",
      c: "copynotes",
      x: "cutnotes",
      v: "pastenotes",
      y: "redo",
      s: e.shiftKey ? "saveas" : "save",
      t: "statistics",
      o: "open",
      n: "new",
      f: "findopen",
    }[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      $(action).click();
    }
  }
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
refresh();
$("viewport").scrollTop = height;
status("");

for (const id of ["showbpm", "showstop", "showbga", "bgmcount"])
  $(id).onchange = () => {
    if (id === "bgmcount") bgmMinimum = Math.min(999, Math.max(1, Math.trunc(Number($(id).value)) || 15));
    rebuildColumns();
    const visible = new Set(columns.filter(c => c.channel).map(c => c.id));
    selectedIds = new Set(events(chart).filter(n => selectedIds.has(eventId(n)) &&
      visible.has(eventColumn(chart, n))).map(eventId));
    draw();
  };
$("sourceopen").onclick = () => {
  closeMainMenus();
  const snapshot = confirmedSaveSnapshot("bms");
  if (!snapshot) return;
  $("source").value = serializeBMS(snapshot);
  ui.text($("sourceerror"), "");
  $("sourcedialog").showModal();
};
$("sourcecancel").onclick = () => $("sourcedialog").close();
$("sourceapply").onclick = () => {
  try {
    const next = initializeEditorMode(parseBMS($("source").value), { pms: editorMode(chart) === "PMS" });
    if (
      !mutate(() => {
        chart = next;
        resetChartPositionStatus();
      })
    )
      return;
    $("sourcedialog").close();
    status("已应用修改");
  } catch (e) {
    ui.text($("sourceerror"), e.message);
  }
};
$("definitionapply").onclick = () => {
  const type = $("definitiontype").value,
    id = normalizeId(chart, $("definitionid").value),
    value = $("definitionvalue").value.trim();
  if (
    !validId(chart, id) ||
    id === "00" ||
    !value ||
    /[\r\n]/.test(value)
  ) {
    status("请输入符合当前 BASE 的编号和有效定义");
    return;
  }
  if (
    ["BPM", "STOP"].includes(type) &&
    (!Number.isFinite(+value) || +value < 0 || (type === "BPM" && +value === 0))
  ) {
    status("BPM 必须大于零，STOP 不得为负");
    return;
  }
  mutate(() => {
    if (type === "BMP") setBMPDefinition(chart, id, value);
    else chart.resources[type][id] = value;
  });
  $("sample").value = id;
  status("已更新 #{0}{1}", type, id);
};

let copiedRows = [], copiedRowsBase = 36, noteClipboardBase = 36, copiedRowsSource = null, noteClipboardSource = null;
const range = () => [Number($("rangefrom").value), Number($("rangeto").value)];
$("copyrange").onclick = () => {
  try {
    copiedRows = copyMeasures(chart, ...range(), activeChannels);
    copiedRowsBase = chartBase(chart); copiedRowsSource = structuredClone(chart);
    status("已复制全部轨道 {0} 行", copiedRows.length);
  } catch (e) {
    status(e.message);
  }
};
$("pasterange").onclick = () => {
  if (!copiedRows.length) {
    status("请先复制非空区域");
    return;
  }
  mutate(() => pasteMeasures(chart, copiedRowsBase === chartBase(chart) ? copiedRows : remapClipboardRows(chart, copiedRowsSource, copiedRows), Number($("measure").value)));
};
$("mirrorrange").onclick = () =>
  mutate(() => mirrorMeasures(chart, ...range(), activeChannels, isNineKeyLayout() ? pomuChannels : null));
$("deleterange").onclick = () =>
  mutate(() => deleteMeasures(chart, ...range(), activeChannels));

$("insertmeasure").onclick = () =>
  mutate(() => insertMeasure(chart, Number($("measure").value)));
$("removemeasure").onclick = () =>
  mutate(() => removeMeasure(chart, Number($("measure").value)));
function report(title, text) {
  $("statstable").hidden = true;
  ui.text($("reporttitle"), title);
  ui.raw($("reporttext"), text);
  $("reporttext").hidden = !text;
  $("reportdialog").showModal();
}
$("reportclose").onclick = () => $("reportdialog").close();
$("statistics").onclick = () => {
  const s = statistics(chart, { nt: $("lnstyle").value === "nt" });
  report("统计", "");
  const table = $("statstable");
  table.replaceChildren();
  const header = document.createElement("tr");
  for (const title of ["轨道", ...s.columns]) {
    const cell = document.createElement("th"); ui.text(cell, title); header.append(cell);
  }
  table.append(header);
  const displayRows = isNineKeyLayout() ? pomuStatisticsRows(s, currentTheme) : s.rows.flatMap((name, i) => i === 2
    ? [...s.aLanes, { name: "A1–A8 小计", counts: s.data[i], subtotal: true }]
    : i === 3 && s.showD
      ? [...s.dLanes, { name: "D1–D8 小计", counts: s.data[i], subtotal: true }]
      : [{ name, counts: s.data[i], subtotal: i === 5 }]);
  displayRows.forEach(({ name, counts, subtotal }) => {
    const row = document.createElement("tr");
    if (subtotal) row.className = "statistics-subtotal";
    const label = document.createElement("th"); ui.text(label, name); row.append(label);
    for (const value of counts) {
      const cell = document.createElement("td"); cell.textContent = String(value); row.append(cell);
    }
    table.append(row);
  });
  table.hidden = false;
};
$("errorcheck").onclick = () => {
  const list = diagnose(chart);
  report("错误检查", "");
  if (list.length) ui.rows($("reporttext"), list.map(i => ({
    prefix: `#${String(i.event.measure).padStart(3, "0")} ${i.event.channel} ${i.event.value}：`,
    source: i.message,
  })));
  else ui.text($("reporttext"), "未发现重叠、缺失定义或未配对长音符");
  $("reporttext").hidden = false;
};
let findEditor;
function findError(error) {
  $("finderror").hidden = !error;
  ui.text($("finderror"), error?.message || "");
}
function runFindAction(action, criteria, value) {
  try {
    const options = { selectedIds, nt: $("lnstyle").value === "nt",
      enabledColumns: columns.filter(c => c.channel && c.width > 0).map(c => c.id), value };
    let result;
    if (["select", "unselect"].includes(action)) {
      result = applyFindOperation(chart, criteria, action, options);
    } else {
      let operationError;
      if (!mutate(() => {
        try { result = applyFindOperation(chart, criteria, action, options); }
        catch (e) { operationError = e; throw e; }
      })) { findError(operationError); return; }
    }
    selected = null; selectedIds = result.selectedIds;
    draw(); findError(null); status("已处理 {0} 个音符", result.count);
  } catch (e) { findError(e); }
}
$("findopen").onclick = () => {
  closeMainMenus();
  const bgmCount = Math.max(maxBGM(chart), ...columns.filter(c => c.id >= 26).map(c => c.id - 25), 1);
  if (!findEditor) {
    findEditor = createFindReplace({ root: $("findeditor"), ui, onAction: runFindAction, onError: findError });
    findEditor.load(createFindCriteria(chart, bgmCount));
  }
  const enabled = new Set(columns.map(c => c.id));
  findEditor.setColumns(originalColumns({ bgm: bgmCount }).filter(c => c.channel).map(c => ({
    id: c.id, title: columns.find(visible => visible.id === c.id)?.title || (c.id < 26 ? currentTheme?.columns.find(style => Number(style.Index) === c.id)?.Title : null) || c.title,
    enabled: enabled.has(c.id),
  })));
  findEditor.setBase(chartBase(chart));
  findError(null); $("finddialog").showModal();
};
$("findclose").onclick = () => $("finddialog").close();

$("projectexport").onclick = async () => {
  try {
    const url = URL.createObjectURL(new Blob([writeProject(chart)])),
      a = document.createElement("a");
    a.href = url;
    a.download = (chart.headers.TITLE || "untitled") + ".ibmsc";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("已导出 IBMSC");
    await savedBeep();
  } catch (e) {
    status(e.message);
  }
};

$("selectall").onclick = () => {
  selectedIds = new Set(events(chart).map(eventId));
  draw();
};
$("copynotes").onclick = () => {
  const captured = captureNotes(chart, selectedIds);
  // Form1.CopyNotes: offsets start at the earliest selected measure, not note.
  const origin = captured.length ? starts[Math.min(...captured.map(n => n.measure))] : 0;
  noteClipboardBase = chartBase(chart); noteClipboardSource = structuredClone(chart);
  noteClipboard = captured.map(n => ({ ...n, beat: n.beat - origin }));
  pasteTarget = null;
  status("已复制 {0} 个音符", noteClipboard.length);
};
$("deletenotes").onclick = () => {
  const list = captureNotes(chart, selectedIds);
  if (list.length)
    mutate(() =>
      list.forEach((e) => (chart.rows[e.row].cells[e.index] = "00")),
    );
};
$("cutnotes").onclick = () => {
  $("copynotes").click();
  $("deletenotes").click();
};
$("pastenotes").onclick = () => {
  if (!noteClipboard.length) return;
  const view = keyboardPane.view;
  // Form1.AddNotes: MeasureBottom(InMeasure(-spV(spFocus)) + 1).
  const bottomBeat = (height - editorInset() - view.scrollTop - view.clientHeight) / scale;
  const visibleMeasure = starts.findIndex(b => b > bottomBeat + 1e-9);
  const explicit = pasteTarget?.chart === chart && pasteTarget.pane === keyboardPane &&
    pasteTarget.top === view.scrollTop;
  const measure = explicit ? pasteTarget.measure : visibleMeasure;
  if (!Number.isInteger(measure) || measure < 0 || measure > 999) {
    status("粘贴目标必须为 000–999 小节");
    return;
  }
  const offset = starts[measure];
  if (mutate(() => putCaptured(chart, noteClipboardBase === chartBase(chart) ? noteClipboard : remapClipboardNotes(chart, noteClipboardSource, noteClipboard), { copy: true, deltaBeat: offset }))) {
    selectedIds = new Set(events(chart).filter(n => noteClipboard.some(c =>
      eventColumn(chart, n) === c.column && Math.abs(n.beat - c.beat - offset) < 1e-8
    )).map(eventId));
    draw();
    status("已粘贴 {0} 个音符至 {1} 小节", noteClipboard.length, String(measure).padStart(3, "0"));
  }
};
$("convertnotes").onclick = () => {
  const notes = captureNotes(chart, selectedIds);
  const type = $("conversion").value;
  if (!notes.length) return;
  if (type === "mirror") {
    mutate(() => mirrorCaptured(chart, notes, isNineKeyLayout() ? pomuColumns : null));
    return;
  }
  const options =
    type === "long"
      ? { long: true }
      : type === "short"
        ? { long: false }
        : type === "hidden"
          ? { hidden: true }
          : type === "visible"
            ? { hidden: false }
            : { value: normalizeId(chart, $("sample").value) };
  mutate(() => putCaptured(chart, notes, options));
};

let soundLoadGeneration = 0;
function clearSoundReport() {
  ui.text($("soundstatus"), "");
  $("sounderrors").hidden = true;
  ui.raw($("sounderrorlist"), "");
}
async function loadProjectSounds(folderFiles = null) {
  if (!window.desktop && !folderFiles) return;
  const targetChart = chart,
    generation = ++soundLoadGeneration;
  const active = () =>
    chart === targetChart && generation === soundLoadGeneration;
  const names = [...new Set(Object.values(targetChart.resources.WAV))];
  const folderMatches = folderFiles
    ? new Map(
        resolveBrowserSoundFiles(folderFiles, names).map(match => [match.name, match]),
      )
    : null;
  const decodedFiles = new Map();
  let loaded = 0;
  const errors = [];
  $("sounderrors").hidden = true;
  ui.raw($("sounderrorlist"), "");
  ui.text($("soundstatus"), "正在自动关联音源…");
  try {
    if (names.length) {
      if (folderFiles) await context();
      else audio ??= new AudioContext();
    }
    for (const name of names) {
      if (!active()) return;
      const key = name.toLowerCase().replaceAll("\\", "/");
      try {
        let decoded;
        if (folderMatches) {
          const { file, error } = folderMatches.get(name);
          if (!file) throw Error(error);
          decoded = decodedFiles.get(file);
          if (!decoded) {
            const data = await file.arrayBuffer();
            if (!active()) return;
            decoded = await decodeAudio(audio, data);
            decodedFiles.set(file, decoded);
          }
        } else {
          const data = await window.desktop.asset(name);
          if (!active()) return;
          decoded = await decodeAudio(audio, new Uint8Array(data).buffer);
        }
        if (!active()) return;
        buffers.set(key, decoded);
        loaded++;
      } catch (e) {
        if (!active()) return;
        buffers.delete(key);
        errors.push({ prefix: name + "：", source: e.message });
      }
    }
    if (!active()) return;
    refresh();
    const message = names.length
      ? "音源已关联：{0} 个；未能加载：{1} 个"
      : "谱面未定义音源";
    ui.text($("soundstatus"), message, loaded, errors.length);
    $("sounderrors").hidden = !errors.length;
    ui.rows($("sounderrorlist"), errors);
    status(message, loaded, errors.length);
  } catch (e) {
    if (active()) {
      ui.text($("soundstatus"), "音源关联失败：{0}", e.message);
      ui.copyText($("status"), $("soundstatus"));
    }
  } finally {
    if (generation === soundLoadGeneration && chart !== targetChart)
      clearSoundReport();
  }
}
$("saveas").onclick = async () => {
  if (!window.desktop) {
    $("save").click();
    return;
  }
  try {
    const saveSnapshot = confirmedSaveSnapshot();
      if (!saveSnapshot) return;
    const result = await window.desktop.save({
      ...savePayload(saveSnapshot),
      encoding: $("encoding").value,
      saveAs: true,
    });
    if (result) {
      if (result.encoding) $("encoding").value = result.encoding;
      history.markSaved(saveSnapshot);
      await savedBeep();
      refresh();
      if (result.warning) status(result.warning);
      else status("已另存为 {0}", result.name);
      await refreshRecentFiles();
    }
  } catch (e) {
    status(e.message);
  }
};
$("recover").onclick = async () => {
  try {
    const text = window.desktop
      ? await window.desktop.recover()
      : localStorage.getItem("ibmsc-recovery");
    if (!text) {
      status("没有恢复文件");
      return;
    }
    const recovered = text.startsWith('{"format":"ibmsc-recovery-v1"')
      ? migrateExpansion(validateProjectChart(JSON.parse(text).chart)) : parseBMS(text);
    await window.desktop?.newFile();
    mutate(() => {
      chart = initializeEditorMode(recovered);
      syncEditorModePresentation(true);
      $("saveformat").value = editorMode(chart) === "PMS" ? "pms" : "bms";
      resetChartPositionStatus();
    });
    status("已恢复自动保存内容，请另存为文件");
  } catch (e) {
    status(e.message);
  }
};
let autosaveTimer = null;
function restartAutosave() {
  if (autosaveTimer !== null) clearInterval(autosaveTimer);
  autosaveTimer = generalOptions.autosave ? setInterval(async () => {
    if (!dirty) return;
    try {
      const text = JSON.stringify({ format: "ibmsc-recovery-v1", chart });
      if (window.desktop) await window.desktop.autosave(text);
      else localStorage.setItem("ibmsc-recovery", text);
    } catch (e) { status("自动保存失败：{0}", e.message); }
  }, generalOptions.autosaveminutes * 60000) : null;
}
restartAutosave();
function syncHeaderControl(key, input) {
  const value = chart.headers[key] ?? "";
  if (headerChoices[key]) {
    const choices = [...headerChoices[key]];
    if (!choices.some(([id]) => id === value))
      choices.push([value, null]);
    input.replaceChildren();
    for (const [id, label] of choices) {
      const option = document.createElement("option");
      option.value = id;
      if (label === null) ui.text(option, "原文件值：{0}", value);
      else ui.text(option, label);
      option.selected = id === value;
      input.append(option);
    }
  }
  input.value = value;
}
const modeLabel = document.createElement("label");
modeLabel.id = "chart-mode-label";
const modeCaption = document.createElement("span");
ui.text(modeCaption, "谱面类型");
const modeInput = document.createElement("select");
modeInput.id = "chartmode";
modeLabel.append(modeCaption, modeInput);
$("primaryheaders").append(modeLabel);
syncEditorModeControl();
modeInput.onchange = () => {
  const mode = modeInput.value;
  if (!["SINGLE", "DOUBLE", "PMS"].includes(mode)) { syncEditorModeControl(); return; }
  mutate(() => setEditorMode(chart, mode));
};
const extraHeaders = [
  "SUBTITLE",
  "SUBARTIST",
  "RANK",
  "DIFFICULTY",
  "EXRANK",
  "TOTAL",
  "STAGEFILE",
  "BANNER",
  "BACKBMP",
  "COMMENT",
  "LNOBJ",
];
for (const key of extraHeaders) {
  const label = document.createElement("label");
  const caption = document.createElement("span");
  ui.text(caption, headerLabels[key] || key);
  label.append(caption);
  const input = document.createElement(headerChoices[key] ? "select" : "input");
  input.id = "header-" + key;
  syncHeaderControl(key, input);
  input.onchange = () => {
    const value = key === "LNOBJ" ? normalizeId(chart, input.value) : input.value;
    if (key === "LNOBJ" && value && !validId(chart, value, true)) {
      status("LNOBJ 编号超出当前 BASE 范围"); refresh(); return;
    }
    if (
      headerChoices[key] &&
      !headerChoices[key].some(([id]) => id === value)
    ) {
      status(key + " 请选择菜单中的有效值");
      refresh();
      return;
    }
    mutate(() => {
      if (value) chart.headers[key] = value;
      else delete chart.headers[key];
    });
  };
  label.append(input);
  $(key === "RANK" ? "primaryheaders" : "extraheaders").append(label);
}

function argb(value) {
  const n = Number(value) >>> 0;
  return `rgba(${(n >>> 16) & 255},${(n >>> 8) & 255},${n & 255},${(n >>> 24) / 255})`;
}
for (const [name, metadata] of Object.entries(themeMetadata)) if (themes[name]) Object.assign(themes[name], metadata);
let customTheme = null;
function themeChoice() {
  if (!currentTheme) return "IIDX";
  return Object.keys(themes).find(name => themes[name] === currentTheme ||
    JSON.stringify(themes[name]) === JSON.stringify(currentTheme)) || "custom";
}
function syncThemeChoices() {
  const select = $("theme");
  select.replaceChildren();
  const choices = Object.keys(themes).map(name => [name, name]);
  if (customTheme) choices.push(["custom", "自定义"]);
  for (const [value, label] of choices) {
    const option = document.createElement("option"); option.value = value;
    if (value === "custom") ui.text(option, label); else option.textContent = label;
    select.append(option);
  }
  select.value = themeChoice();
  populateChoiceMenu("theme-menu", choices, value => {
    select.value = value; select.onchange();
  }, () => select.value);
}
$("theme").onchange = () => {
  themeBeforePMS = undefined;
  currentTheme = ($("theme").value === "custom" ? customTheme : themes[$("theme").value]) || themes.IIDX;
  persistTheme(); syncThemeChoices(); rebuildColumns(); draw();
};
$("themeimport").onclick = () => $("themefile").click();
$("themefile").onchange = async () => {
  try {
    const f = $("themefile").files[0];
    if (!f) return;
    const text = decodeXML(await f.arrayBuffer());
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const imported = readThemeDocument(xml, text);
    currentTheme = customTheme = imported;
    themeBeforePMS = undefined;
    persistTheme(); syncThemeChoices(); rebuildColumns(); draw();
    status("已载入主题 {0}", f.name);
  } catch (e) { status(e.message); }
  finally { $("themefile").value = ""; }
};
async function parseSelectedFile(name, bytes) {
  if (/\.ibmscx$/i.test(name)) return readPortableProject(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (/\.ibmsc$/i.test(name)) return readProject(bytes);
  const text = decodeBMS(bytes, $("inputencoding").value);
  if (!/\.sm$/i.test(name)) return parseBMS(text);
  const list = smDifficulties(text);
  if (list.length < 2) return importSM(text);
  $("smdifficulty").replaceChildren();
  list.forEach((d, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = d.style + " / " + d.name + " / " + d.level;
    $("smdifficulty").append(o);
  });
  $("smdialog").showModal();
  return new Promise((resolve, reject) => {
    pendingSM = { text, resolve, reject };
  });
}
$("smapply").onclick = () => {
  try {
    const c = importSM(pendingSM.text, Number($("smdifficulty").value));
    pendingSM.resolve(c);
    pendingSM = null;
    $("smdialog").close();
  } catch (e) {
    status(e.message);
  }
};
$("smcancel").onclick = () => {
  pendingSM?.resolve(null);
  pendingSM = null;
  $("smdialog").close();
};
$("smdialog").addEventListener("cancel", () => {
  pendingSM?.resolve(null);
  pendingSM = null;
});

function drawWaveform(name) {
  const buffer = buffers.get(name?.toLowerCase().replaceAll("\\", "/"));
  const wave = $("waveform"),
    w = wave.width,
    h = wave.height,
    c = wave.getContext("2d");
  c.fillStyle = "#080808";
  c.fillRect(0, 0, w, h);
  if (!buffer) {
    ui.text($("waveinfo"), "未加载音源");
    return;
  }
  const peaks = waveformPeaks(buffer.getChannelData(0), w);
  c.strokeStyle = "#77cf82";
  c.beginPath();
  peaks.forEach(([min, max], i) => {
    c.moveTo(i, h / 2 - min * h * 0.45);
    c.lineTo(i, h / 2 - max * h * 0.45);
  });
  c.stroke();
  ui.raw($("waveinfo"), `${name} · ${buffer.duration.toFixed(3)} s · ${buffer.sampleRate} Hz`);
}
$("sample").onchange = () => {
  const id = normalizeId(chart, $("sample").value);
  if (!validId(chart, id)) {
    status("WAV 编号超出当前 BASE 范围");
    return;
  }
  wavSelection = new Set([id]);
  refreshWAVList();
  drawWaveform(chart.resources.WAV[id]);
};
$("bpmtap").onclick = (() => {
  let taps = [];
  return () => {
    const now = performance.now();
    if (taps.length && now - taps.at(-1) > 2500) taps = [];
    taps.push(now);
    if (taps.length > 16) taps.shift();
    if (taps.length > 1)
      $("bpmresult").textContent = calculateBPM(
        taps.length - 1,
        (taps.at(-1) - taps[0]) / 1000,
      ).toFixed(4);
  };
})();
$("bpmcalculate").onclick = () => {
  try {
    $("bpmresult").textContent = calculateBPM(
      Number($("bpmbeats").value),
      Number($("bpmseconds").value),
    ).toFixed(4);
  } catch (e) {
    status(e.message);
  }
};

for (const side of ["left", "right"])
  $("split-" + side).onchange = () => {
    const pane = panes.find((p) => p.panel.id === "pane-" + side);
    pane.panel.hidden = !$("split-" + side).checked;
    pane.view.scrollTop = $("viewport").scrollTop;
    draw();
  };
const toolModes = ["time", "select", "write"];
function syncToolButtons() {
  refreshPositionStatus();
  for (const mode of toolModes) {
    document.querySelectorAll(`[data-action="tool-${mode}"]`).forEach(button => {
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", String($("tool").value === mode));
    });
    $("tool-" + mode).setAttribute(
      "aria-pressed",
      String($("tool").value === mode),
    );
  }
}
for (const mode of toolModes)
  $("tool-" + mode).onclick = () => {
    $("tool").value = mode;
    syncToolButtons();
  };
$("tool").onchange = syncToolButtons;
syncToolButtons();

let myo2Scan = null;
const myo2Options = () => ({ nt: $("lnstyle").value === "nt", titles: Object.fromEntries(columns.map(c => [c.id, c.title])) });
function scanMyO2() {
  finishExpansionEdit();
  const options = myo2Options();
  const items = checkMyO2Grid(chart, options);
  myo2Scan = { snapshot: JSON.stringify(chart), options, items };
  $("myo2results").replaceChildren();
  for (const item of items) {
    const row = document.createElement("tr");
    for (const value of [String(item.measure).padStart(3, "0"), item.title, item.grid,
      item.long ? "✓" : "", item.hidden ? "✓" : "", null, item.d64, item.d48]) {
      const cell = document.createElement("td");
      if (value === null) {
        const check = document.createElement("input"); check.type = "checkbox";
        check.checked = item.to64; ui.attribute(check, "aria-label", "{0} {1} 调整到64线", item.measure, item.title);
        check.onchange = () => { item.to64 = check.checked; };
        cell.append(check);
      } else cell.textContent = String(value);
      row.append(cell);
    }
    $("myo2results").append(row);
  }
  $("myo2adjust").disabled = !items.length;
  ui.text($("myo2message"), items.length ? "发现 {0} 项" : "未发现超过 64 线的格数", items.length);
}
$("myo2").onclick = () => {
  closeMainMenus(); myo2Scan = null;
  $("myo2bpm").value = chart.headers.BPM;
  $("myo2results").replaceChildren(); $("myo2adjust").disabled = true;
  ui.text($("myo2message"), "");
  $("myo2dialog").showModal();
};
$("myo2check").onclick = scanMyO2;
$("myo2constant").onclick = () => {
  if (mutate(() => { chart = constantBPM(chart, Number($("myo2bpm").value)); })) {
    myo2Scan = null; $("myo2results").replaceChildren(); $("myo2adjust").disabled = true;
    ui.text($("myo2message"), "已恒速化");
  } else ui.copyText($("myo2message"), $("status"));
};
$("myo2adjust").onclick = () => {
  if (!myo2Scan || myo2Scan.snapshot !== JSON.stringify(chart) || myo2Scan.options.nt !== myo2Options().nt) {
    ui.text($("myo2message"), "谱面已改变，请重新检查"); $("myo2adjust").disabled = true; return;
  }
  if (mutate(() => { chart = adjustMyO2Grid(chart, myo2Scan.items, myo2Scan.options); })) {
    scanMyO2(); ui.text($("myo2message"), "已调整");
  } else ui.copyText($("myo2message"), $("status"));
};
const mainMenus = [...document.querySelectorAll("header nav details.menu")];
let viewMenuOpen = false;
function openViewMenu() {
  closeMainMenus();
  const menu = $("viewmenu");
  const anchor = $("view-toggle").getBoundingClientRect();
  // F10 still opens the same controls when the menu and toolbar are both hidden.
  const anchorVisible = $("show-menu").checked && !window.desktop?.nativeMenu;
  const left = anchorVisible ? anchor.left : 4;
  const top = anchorVisible ? anchor.bottom : 4;
  menu.style.left = "0px";
  menu.style.top = "0px";
  if (!viewMenuOpen) menu.showPopover();
  viewMenuOpen = true;
  $("view-toggle").setAttribute("aria-expanded", "true");
  const bounds = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(left, window.innerWidth - bounds.width - 4)) + "px";
  menu.style.top = Math.max(4, Math.min(top, window.innerHeight - bounds.height - 4)) + "px";
  menu.querySelector("input:not(:disabled)")?.focus();
}
function closeViewMenu(restoreFocus = true) {
  $("viewmenu").hidePopover();
  viewMenuOpen = false;
  $("view-toggle").setAttribute("aria-expanded", "false");
  if (restoreFocus) {
    if ($("show-menu").checked && !window.desktop?.nativeMenu) $("view-toggle").focus();
    else keyboardPane.canvas.focus?.({ preventScroll: true });
  }
}
$("view-toggle").onclick = event => {
  // Keep the native invoker relationship for light-dismiss, but position it ourselves.
  event.preventDefault();
  if (viewMenuOpen) closeViewMenu();
  else openViewMenu();
};
$("view-toggle").addEventListener("pointerenter", () => {
  if (mainMenus.some(menu => menu.open)) openViewMenu();
});
$("view-toggle").addEventListener("keydown", event => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openViewMenu();
  }
});
$("viewmenu").addEventListener("toggle", event => {
  viewMenuOpen = event.newState === "open";
  $("view-toggle").setAttribute("aria-expanded", String(viewMenuOpen));
});
$("viewmenu").addEventListener("keydown", event => {
  // Number fields retain native arrow stepping and text-caret navigation.
  if (event.target?.type === "number") return;
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...$("viewmenu").querySelectorAll("input:not(:disabled)")];
  const index = items.indexOf(document.activeElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
    (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
  event.preventDefault();
});
function applyViewLayout() {
  const menuHidden = !$('show-menu').checked && !window.desktop?.nativeMenu;
  $("main-menu-bar").hidden = menuHidden;
  $("main-toolbar").hidden = !$("show-toolbar").checked;
  $("status-bar").hidden = !$("show-status").checked;
  document.body.classList.toggle("menu-hidden", menuHidden);
  document.body.classList.toggle("toolbar-hidden", !$("show-toolbar").checked);
  document.body.classList.toggle("status-hidden", !$("show-status").checked);
  const hidden = !$("show-options").checked;
  $("options-panel").hidden = hidden;
  $("options-resizer").hidden = hidden;
  $("workspace").classList.toggle("options-hidden", hidden);
  $("toggle-options").setAttribute("aria-expanded", String(!hidden));
}
for (const id of ["show-menu", "show-toolbar", "show-options", "show-status"])
  $(id).onchange = () => { applyViewLayout(); rebuildColumns(); draw(); };
for (const id of ["showbackground", "showcolumncaption"])
  $(id).onchange = () => { rebuildColumns(); draw(); };
for (const id of ["showmeasureindex", "showmeasureline", "showvertical"])
  $(id).onchange = draw;
if (window.desktop?.nativeMenu) $("show-menu").disabled = true;
applyViewLayout();
function updateMenuAvailability() {
  for (const action of ["undo", "redo"])
    document.querySelectorAll(`[data-action="${action}"]`).forEach(button => { button.disabled = $(action).disabled; });
  for (const type of ["long", "short", "togglelong", "hidden", "visible", "togglehidden", "value", "mirror"])
    $("convert-" + type).disabled = !selectedIds.size ||
      ($("lnstyle").value === "nt" && ["long", "togglelong"].includes(type));
}
function closeMainMenus(except = null) {
  for (const menu of mainMenus) if (menu !== except) {
    menu.open = false;
    menu.querySelectorAll("details.submenu").forEach(sub => { sub.open = false; });
  }
}
for (const menu of mainMenus) {
  menu.addEventListener("toggle", updateMenuAvailability);
  menu.addEventListener("pointerenter", () => {
    if (viewMenuOpen || mainMenus.some(other => other !== menu && other.open)) {
      if (viewMenuOpen) closeViewMenu(false);
      closeMainMenus(menu); menu.open = true;
    }
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeMainMenus(); menu.querySelector("summary").focus(); event.preventDefault(); }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      const items = [...menu.querySelectorAll("button, label input, summary")].filter(el => !el.disabled && el.offsetParent !== null);
      const index = items.indexOf(document.activeElement);
      items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      event.preventDefault();
    }
  });
}
// Close synchronously when switching, including in runtimes without details.name.
for (const menu of mainMenus)
  menu
    .querySelector("summary")
    .addEventListener("click", () => closeMainMenus(menu));
for (const menu of mainMenus)
  menu.addEventListener("click", (event) => {
    if (event.target.closest?.("button")) closeMainMenus();
  });
window.addEventListener("pointerdown", (e) => {
  if (!e.target.closest?.("header nav details.menu")) closeMainMenus();
});

document.querySelectorAll("[data-action]").forEach(
  (button) =>
    (button.onclick = () => {
      $(button.dataset.action).click();
      const menu = button.closest("details.menu");
      if (menu) menu.open = false;
    }),
);

// Settings belong to menu-launched dialogs. The same controls and handlers
// remain authoritative, so moving them does not fork the editor's state.
for (const name of ["generalsettings", "displaysettings",
  "languagesettings", "themesettings", "fileoptions", "inputsettings", "bpmtools"]) {
  $(name).onclick = () => {
    closeMainMenus();
    $(name + "dialog").showModal();
  };
}
function syncGeneralControls() {
  for (const id of generalPreferenceIds) {
    const node = $(id), value = generalOptions[id];
    if (typeof value === "boolean") node.checked = value;
    else {
      if (["wheelunits", "pageunits"].includes(id) && ![...node.children].some(o => o.value === String(value))) {
        const option = document.createElement("option"); option.value = String(value);
        option.textContent = String(value / 192); node.append(option);
      }
      node.value = String(value);
    }
  }
  $("middleauto").checked = generalOptions.middlemove === 0;
  $("middledrag").checked = generalOptions.middlemove === 1;
  $("autosaveminutes").disabled = !generalOptions.autosave;
}
$("generalsettings").onclick = () => {
  closeMainMenus(); syncGeneralControls();
  $("general-error").hidden = true;
  $("generalsettingsdialog").showModal();
};
$("autosave").onchange = () => { $("autosaveminutes").disabled = !$("autosave").checked; };
$("middleauto").onchange = () => { if ($("middleauto").checked) $("middlemove").value = "0"; };
$("middledrag").onchange = () => { if ($("middledrag").checked) $("middlemove").value = "1"; };
$("general-ok").onclick = () => {
  try {
    const values = validateGeneralSettings(Object.fromEntries(generalPreferenceIds.map(id => [id,
      typeof generalDefaults[id] === "boolean" ? $(id).checked : $(id).value])));
    applyPreferences(values); navigation.stop(); persistPreferences();
    $("generalsettingsdialog").close();
  } catch (e) { ui.text($("general-error"), e.message); $("general-error").hidden = false; }
};
$("general-cancel").onclick = () => { syncGeneralControls(); $("generalsettingsdialog").close(); };
$("generalsettingsdialog").addEventListener("cancel", syncGeneralControls);
for (const extension of ["bms", "bme", "bml", "pms", "ibmsc"]) {
  const button = $("associate-" + extension);
  button.disabled = !window.desktop?.capabilities?.fileAssociation;
  if (button.disabled) ui.title(button, "文件关联需要 Windows 桌面版");
  button.onclick = async () => {
    try {
      const result = await window.desktop.associateFile("." + extension);
      ui.text($("general-error"), result.settingsOpened
        ? "已注册文件类型，请在 Windows 默认应用中选择 iBMSC"
        : "已注册文件类型，请手动打开 Windows 默认应用选择 iBMSC");
      $("general-error").hidden = false;
    } catch (e) { ui.text($("general-error"), e.message); $("general-error").hidden = false; }
  };
}
let themeEditor;
let themeEditorInitial;
function themeEditorError(error) {
  $("themeedit-error").hidden = !error;
  ui.text($("themeedit-error"), error?.message || "");
}
$("displaysettings").onclick = () => {
  closeMainMenus();
  if (!themeEditor) themeEditor = createThemeEditor({ root: $("themeeditor"),
    preview: $("themeedit-preview"), ui, onError: themeEditorError });
  const draft = editableTheme(currentTheme);
  themeEditorInitial = JSON.stringify(draft);
  themeEditor.load(draft); themeEditorError(null);
  $("displaysettingsdialog").showModal();
};
$("themecustomize").onclick = () => {
  $("themesettingsdialog").close(); $("displaysettings").click();
};
$("themeedit-ok").onclick = () => {
  try {
    const draft = themeEditor.read();
    if (JSON.stringify(draft) !== themeEditorInitial) {
      currentTheme = customTheme = draft; themeBeforePMS = undefined;
      persistTheme(); syncThemeChoices(); rebuildColumns(); draw();
    }
    $("displaysettingsdialog").close();
  } catch (e) { themeEditorError(e); }
};
$("themeedit-cancel").onclick = () => $("displaysettingsdialog").close();
function syncNativeMenuState() {
  if (window.desktop?.updateMenuState)
    window.desktop.updateMenuState({ nt: $("lnstyle").value === "nt",
      previewclick: $("previewclick").checked,
      showfilename: $("showfilename").checked, language: ui.language }).catch(e => status(e.message));
}
for (const id of ["previewclick", "showfilename"])
  $(id).addEventListener("change", syncNativeMenuState);
function syncInputMode() {
  errorEvents = new Set(statistics(chart, { nt: $("lnstyle").value === "nt" }).errorEvents);
  syncNativeMenuState();
  const nt = $("lnstyle").value === "nt";
  $("toggleln").setAttribute("aria-checked", String(nt));
  $("toggleln").setAttribute("aria-pressed", String(nt));
  document.querySelectorAll('[data-action="toggleln"]').forEach(button => {
    button.textContent = nt ? "NT" : "BMSE";
    button.setAttribute("aria-pressed", String(nt));
    ui.title(button, "当前 {0}，切换输入方式（F8）", nt ? "NT" : "BMSE");
  });
}
$("toggleln").onclick = () => {
  $("lnstyle").value = $("lnstyle").value === "nt" ? "bmse" : "nt";
  persistPreferences();
  syncInputMode();
  closeMainMenus();
  draw();
};
$("lnstyle").addEventListener("change", syncInputMode);
for (const type of ["long", "short", "togglelong", "hidden", "visible", "togglehidden", "value", "mirror"]) {
  $("convert-" + type).onclick = () => {
    closeMainMenus();
    if (!selectedIds.size) { status("请先选择要转换的音符"); return; }
    if (type === "value") {
      $("conversionvalue").value = $("sample").value;
      ui.text($("conversionerror"), "");
      $("convertvaluedialog").showModal();
      return;
    }
    if (type === "togglelong" || type === "togglehidden") {
      const captured = captureNotes(chart, selectedIds);
      mutate(() => {
        for (const n of captured) chart.rows[n.row].cells[n.index] = "00";
        for (const n of captured) putCaptured(chart, [n], { copy: true,
          ...(type === "togglelong" ? { long: !(n.bgmLong || /^[5-8]/.test(n.channel)) } : { hidden: !/^[3478]/.test(n.channel) }) });
      });
      return;
    }
    $("conversion").value = type;
    $("convertnotes").click();
  };
}
$("applyconversionvalue").onclick = () => {
  try {
    const value = normalizeId(chart, $("conversionvalue").value);
    if (!validId(chart, value)) throw Error("编号超出当前谱面进制范围");
    const notes = captureNotes(chart, selectedIds);
    if (mutate(() => putCaptured(chart, notes, { value }))) $("convertvaluedialog").close();
    else ui.copyText($("conversionerror"), $("status"));
  } catch (e) { ui.text($("conversionerror"), e.message); }
};
syncInputMode();

$("wavrename").onclick = () => {
  const from = normalizeId(chart, $("sample").value),
    to = normalizeId(chart, $("wavtarget").value);
  if (mutate(() => renameWAV(chart, from, to, $("wavsync").checked))) {
    $("sample").value = to;
    wavSelection = new Set([to]);
    refresh();
  }
};
$("wavremove").onclick = () => {
  const ids = [...wavSelection];
  const usage = ids.reduce((n, id) => n + wavUsage(chart, id), 0);
  if (
    usage &&
    !confirm(
      t("选中编号被 {0} 个事件引用，移除定义会保留音符但使音源缺失。仍然移除？", usage),
    )
  )
    return;
  mutate(() => {
    for (const id of ids) delete chart.resources.WAV[id];
  });
};
for (const id of ["showfilename", "showgrid"]) $(id).onchange = draw;

function applyLanguage(id, custom = null) {
  ui.setLanguage(id, custom);
  if (document.documentElement) document.documentElement.lang = { chs: "zh-CN", jpn: "ja", eng: "en", kor: "ko" }[ui.language];
  for (const button of [...$("language-menu").children, ...$("languagepopover").children])
    button.setAttribute("aria-checked", String(!custom && button.dataset.language === ui.language));
  syncNativeMenuState();
}
for (const id of languageIds) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = locales[id].name;
  $("language").append(o);
}
function populateChoiceMenu(id, choices, choose, selected) {
  const list = $(id); list.replaceChildren();
  for (const [value, label] of choices) {
    const button = document.createElement("button");
    if (id === "language-menu" || id === "languagepopover") { button.textContent = label; button.dataset.language = value; }
    else if (!value || value === "custom") ui.text(button, label);
    else button.textContent = label;
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", String(value === selected()));
    button.onclick = () => {
      choose(value);
      if (id === "languagepopover") $("languagepopover").hidePopover();
      for (const other of list.children) other.setAttribute("aria-checked", String(other === button));
      closeMainMenus();
    };
    list.append(button);
  }
}
for (const menu of ["language-menu", "languagepopover"])
  populateChoiceMenu(menu, languageIds.map(id => [id, locales[id].name]), value => {
    $("language").value = value; $("language").onchange();
  }, () => $("language").value || defaultLanguage);
$("language-toggle").onclick = event => {
  event.preventDefault();
  closeMainMenus(); closeViewMenu(false);
  const menu = $("languagepopover"), anchor = $("language-toggle").getBoundingClientRect();
  if (menu.matches?.(":popover-open")) { menu.hidePopover(); return; }
  menu.style.left = "0px"; menu.style.top = "0px";
  menu.showPopover();
  const bounds = menu.getBoundingClientRect();
  menu.style.left = Math.max(4, Math.min(anchor.left, window.innerWidth - bounds.width - 4)) + "px";
  menu.style.top = Math.max(4, Math.min(anchor.bottom, window.innerHeight - bounds.height - 4)) + "px";
  menu.querySelector('button[aria-checked="true"]')?.focus();
};
$("languagepopover").addEventListener("keydown", event => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...$("languagepopover").children];
  const index = items.indexOf(document.activeElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
    (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus(); event.preventDefault();
});
$("languagepopover").addEventListener("toggle", event => {
  $("language-toggle").setAttribute("aria-expanded", String(event.newState === "open"));
});
syncThemeChoices();
$("language").onchange = () => {
  const id = $("language").value;
  if (!locales[id]) return;
  applyLanguage(id);
  try { localStorage.setItem("ibmsc-language", JSON.stringify({ id })); }
  catch (e) { status(e.message); }
};
$("languageimport").onclick = () => $("languagefile").click();
async function readXMLFile(file) {
  const text = decodeXML(await file.arrayBuffer());
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw Error("XML 格式无效");
  return doc;
}
$("languagefile").onchange = async () => {
  try {
    const file = $("languagefile").files[0];
    if (!file) return;
    const doc = await readXMLFile(file),
      values = {};
    function walk(node, path) {
      if (!node.children.length) values[path] = node.textContent;
      for (const child of node.children)
        walk(child, path ? path + "/" + child.tagName : child.tagName);
    }
    walk(doc.documentElement, "");
    applyLanguage(ui.language, values);
    localStorage.setItem("ibmsc-language", JSON.stringify({ id: ui.language, values }));
    status("已载入语言文件 {0}", file.name);
  } catch (e) {
    status(e.message);
  } finally {
    $("languagefile").value = "";
  }
};
let importedSettings = null;
function preferenceValues() {
  return { ...Object.fromEntries(
    [...Object.keys(preferenceFields), "lnstyle", "beatmode"].map((id) => [
      id,
      preferenceFields[id]?.[2] === "boolean" ? $(id).checked : $(id).value,
    ]),
  ), ...generalOptions, bgmcount: bgmMinimum };
}
function applyPreferences(values) {
  if (values.bgmcount !== undefined) bgmMinimum = Number(values.bgmcount);
  const previousEncoding = generalOptions.defaultencoding;
  generalOptions = validateGeneralSettings({ ...generalOptions, ...Object.fromEntries(
    Object.entries(values).filter(([id]) => generalPreferenceIds.includes(id))) });
  syncGeneralControls();
  restartAutosave();
  if (previousEncoding !== generalOptions.defaultencoding) $("encoding").value = generalOptions.defaultencoding;
  for (const [id, value] of Object.entries(values)) {
    if (!$(id) || generalPreferenceIds.includes(id)) continue;
    if (typeof value === "boolean") $(id).checked = value;
    else $(id).value = value;
  }
  editorZoom = Number($("editorzoom").value) / 100;
  scale = Number($("zoom").value) * 48 * editorZoom;
  horizontalZoom = Number($("widthzoom").value);
  syncSidebarControls();
  $("samples").multiple = $("wavmulti").checked;
  for (const side of ["left", "right"])
    $("pane-" + side).hidden = !$("split-" + side).checked;
  syncInputMode();
  applyViewLayout();
  refresh();
}
$("settingsimport").onclick = () => $("settingsfile").click();
$("settingsfile").onchange = async () => {
  try {
    const file = $("settingsfile").files[0];
    if (!file) return;
    const doc = await readXMLFile(file),
      elements = {};
    if (doc.documentElement.tagName !== "iBMSC")
      throw Error("不是 iBMSC 配置文件");
    for (const el of doc.documentElement.children)
      elements[el.tagName] = Object.fromEntries(
        [...el.attributes].map((a) => [a.name, a.value]),
      );
    const values = readPreferenceAttributes(elements);
    applyPreferences(values);
    importedSettings = doc;
    persistPreferences();
    status("已导入设置");
  } catch (e) {
    status(e.message);
  } finally {
    $("settingsfile").value = "";
  }
};
$("settingsexport").onclick = async () => {
  try {
  const original =
    importedSettings ||
    new DOMParser().parseFromString(
      '<iBMSC Major="3" Minor="0" Build="5" />',
      "application/xml",
    );
  const doc = updateSettingsDocument(original, preferenceValues());
  // XMLSerializer preserves the imported declaration, so explicitly use a UTF-8 declaration.
  const body = new XMLSerializer()
    .serializeToString(doc)
    .replace(/<\?xml[^?]*\?>/i, "");
  downloadText(
    '<?xml version="1.0" encoding="utf-8"?>\n' + body,
    "iBMSC.Settings.xml",
  );
  } catch(e) { status(e.message); }
};
function downloadText(text, name) {
  const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("themeexport").onclick = () => {
  try { downloadText(serializeTheme(editableTheme(currentTheme)), "Custom.Theme.xml"); }
  catch (e) { status(e.message); }
};

try {
  const saved = localStorage.getItem("ibmsc-preferences");
  if (saved) {
    const original = JSON.parse(saved);
    const stored = migrateLayoutPreferences(original);
    // The early simplified UI persisted 8 as its default and had no gxHeight.
    const legacyDefault =
      stored.Grid?.gxHeight === undefined && Number(stored.Grid?.gCol) === 8;
    if (legacyDefault) stored.Grid.gCol = "15";
    applyPreferences(readPreferenceAttributes(stored));
    if (legacyDefault || original.layoutVersion !== 1) persistPreferences();
  }
} catch {
  /* Unsupported storage environments retain defaults. */
}
function persistPreferences() {
  try {
    localStorage.setItem(
      "ibmsc-preferences",
      JSON.stringify({ ...writePreferenceAttributes(preferenceValues()), layoutVersion: 1 }),
    );
    if (importedSettings)
      localStorage.setItem(
        "ibmsc-settings-xml",
        new XMLSerializer().serializeToString(importedSettings),
      );
  } catch (e) {
    status("设置未能持久保存：{0}", e.message);
  }
}
try {
  const xml = localStorage.getItem("ibmsc-settings-xml");
  if (xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (
      !doc.querySelector("parsererror") &&
      doc.documentElement.tagName === "iBMSC"
    )
      importedSettings = doc;
  }
} catch {}
for (const id of [...Object.keys(preferenceFields), "lnstyle", "beatmode"])
  if (!generalPreferenceIds.includes(id)) $(id).addEventListener("change", persistPreferences);

refreshRecentFiles();

// POptionsResizer: right-docked options panel, independently collapsible.
let optionsWidth = 200,
  optionsDrag = null;
function setOptionsWidth(value) {
  optionsWidth = Math.round(
    Math.max(180, Math.min(480, window.innerWidth - 240, value)),
  );
  $("workspace").style.setProperty("--options-width", optionsWidth + "px");
  $("options-resizer").setAttribute("aria-valuenow", String(optionsWidth));
}
$("toggle-options").onclick = () => {
  $("show-options").checked = !$("show-options").checked;
  $("show-options").onchange();
  persistPreferences();
};
$("options-resizer").onpointerdown = (e) => {
  if (e.button !== 0) return;
  optionsDrag = { x: e.clientX, width: optionsWidth };
  e.currentTarget.setPointerCapture(e.pointerId);
};
$("options-resizer").onpointermove = (e) => {
  if (optionsDrag)
    setOptionsWidth(optionsDrag.width + optionsDrag.x - e.clientX);
};
$("options-resizer").onpointerup = $("options-resizer").onpointercancel =
  () => {
    optionsDrag = null;
  };
$("options-resizer").onkeydown = (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home"].includes(e.key)) return;
  e.preventDefault();
  setOptionsWidth(
    e.key === "Home" ? 200 : optionsWidth + (e.key === "ArrowLeft" ? 10 : -10),
  );
};

$("wavbrowse").onclick = () => browseWAV();
async function browseWAV(single = false) {
  if (!window.desktop?.chooseSounds) {
    status(
      "目录内音源分配请使用桌面版；网页版可通过加载音源文件关联已有定义。",
    );
    return;
  }
  const target = chart,
    selection = single ? [$("sample").value] : [...wavSelection];
  try {
    const names = await window.desktop.chooseSounds(!single && $("wavmulti").checked);
    if (!names?.length || chart !== target) return;
    let assigned;
    if (
      !mutate(() => {
        assigned = assignWAV(chart, selection, names);
      })
    )
      return;
    wavSelection = new Set(assigned);
    $("sample").value = assigned[0];
    refreshWAVList();
    await loadProjectSounds();
  } catch (e) {
    status(e.message);
  }
}

function drawWaveOverlay(ctx, top, left, pixels) {
  if (!overlayBuffer || !overlayClock) return;
  const precision = Number($("waveprecision").value);
  if (!Number.isFinite(precision) || precision <= 0 || precision > 50) return;
  const position = Number($("waveposition").value) / 48;
  const firstBGM = $("wavelock").checked
    ? events(chart).find((e) => e.channel === "01")
    : null;
  const origin = overlayClock(firstBGM?.beat ?? position);
  const center = left + Number($("waveleft").value) * editorZoom,
    amplitude = Number($("wavewidth").value) * editorZoom / 2;
  if (![origin, center, amplitude].every(Number.isFinite)) return;
  ctx.save();
  ctx.strokeStyle = visualColor(currentTheme, "BGMWav", "rgb(80,160,220)");
  ctx.globalAlpha = Math.max(0, Math.min(1, Number($("waveopacity").value) / 255));
  ctx.lineWidth = editorZoom;
  for (
    let channel = 0;
    channel < Math.min(2, overlayBuffer.numberOfChannels);
    channel++
  ) {
    const samples = overlayBuffer.getChannelData(channel);
    ctx.beginPath();
    for (let step = 0; step <= Math.ceil(pixels * precision); step++) {
      const yy = top + step / precision;
      const beat = (height - editorInset() - yy) / scale;
      const seconds = overlayClock(beat) - origin;
      const x =
        center +
        waveformSample(samples, overlayBuffer.sampleRate, seconds) * amplitude;
      if (!step) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
$("waveload").onclick = () => $("wavefile").click();
$("wavefile").onchange = async () => {
  const file = $("wavefile").files[0];
  if (!file) return;
  const generation = ++overlayGeneration;
  try {
    if (file.size > 256 * 1024 * 1024) throw Error("波形文件超过 256 MB");
    audio ??= new AudioContext();
    const buffer = await decodeAudio(audio, await file.arrayBuffer());
    if (generation !== overlayGeneration) return;
    overlayBuffer = buffer;
    ui.raw($("overlayname"), file.name);
    draw();
  } catch (e) {
    status(e.message);
  } finally {
    $("wavefile").value = "";
  }
};
$("waveuse").onclick = () => {
  const name = chart.resources.WAV[$("sample").value];
  const buffer = buffers.get(name?.toLowerCase().replaceAll("\\", "/"));
  if (!buffer) {
    status("当前音源尚未加载");
    return;
  }
  overlayGeneration++;
  overlayBuffer = buffer;
  ui.raw($("overlayname"), name);
  draw();
};
$("waveclear").onclick = () => {
  overlayGeneration++;
  overlayBuffer = null;
  ui.text($("overlayname"), "未加载叠加波形");
  draw();
};
for (const id of [
  "wavelock",
  "waveposition",
  "waveleft",
  "wavewidth",
  "waveprecision",
  "waveopacity",
])
  $(id).addEventListener("change", draw);

window.addEventListener("dragover", (e) => {
  if ([...(e.dataTransfer?.types || [])].includes("Files")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
});
window.addEventListener("drop", async (e) => {
  const files = [...(e.dataTransfer?.files || [])];
  if (!files.length) return;
  e.preventDefault();
  if (document.querySelector("dialog[open]")) {
    status("请先完成或关闭当前对话框，再拖入文件");
    return;
  }
  try {
    const dropped = classifyDrop(files);
    if (dropped.chart) {
      if (window.desktop) await openNativeFile(null, dropped.chart);
      else await openBrowserFile(dropped.chart);
    } else if (dropped.sounds.length) {
      if (window.desktop) {
        const target = chart,
          selection = [...wavSelection];
        const names = await window.desktop.dropSounds(dropped.sounds);
        if (chart !== target) return;
        let assigned;
        if (
          mutate(() => {
            assigned = assignWAV(chart, selection, names);
          })
        ) {
          wavSelection = new Set(assigned);
          $("sample").value = assigned[0];
          refreshWAVList();
          await loadProjectSounds();
        }
      } else await loadBrowserSounds(dropped.sounds);
    }
  } catch (error) {
    status(error.message);
  }
});

// macOS owns the menu bar; browser builds keep the in-page menus.
if (window.desktop?.nativeMenu) {
  document.body.classList.add("native-menu");
  window.desktop.onMenuAction((action, payload) => {
    const active = document.activeElement;
    const edit = ["undo", "redo", "cutnotes", "copynotes", "pastenotes", "deletenotes", "selectall"].includes(action);
    const measurePaste = action === "pastenotes" && [$("measure"), $("measurelist")].includes(active);
    if (edit && !measurePaste && (active?.isContentEditable || ["INPUT", "TEXTAREA"].includes(active?.tagName))) {
      window.desktop.editText(action).catch(e => status(e.message));
      return;
    }
    // Do not edit the chart behind an open dialog.
    if (document.querySelector("dialog[open]")) return;
    if (action === "openRecent") { openNativeFile(payload); return; }
    if (measurePaste && active === $("measure")) selectPasteMeasure();
    const allowed = [ "myo2", "importsm", "importibmsc", "checkupdates", "convert-togglelong", "convert-togglehidden", "portableexport", "about", "new", "open", "save", "saveas", "projectexport", "recover", "undo", "redo", "cutnotes", "copynotes", "pastenotes", "deletenotes", "selectall", "findopen", "statistics", "errorcheck", "themeimport", "toggle-options", "convertnotes", "play", "playhere", "stop",
      "generalsettings", "displaysettings", "languagesettings", "themesettings", "fileoptions", "inputsettings", "bpmtools", "toggleln", "previewclick", "showfilename",
      "tool-time", "tool-select", "tool-write",
      "convert-long", "convert-short", "convert-hidden", "convert-visible", "convert-value", "convert-mirror", "sourceopen"];
    if (allowed.includes(action)) $(action).click();
  });
}

$("about").onclick = () => {
  report("关于 iBMSC", "");
  ui.rows($("reporttext"), creditsRows);
  $("reporttext").hidden = false;
};

function noteHeight() { return visualNumber(currentTheme, "kHeight", 10) * editorZoom; }

function persistTheme() {
  try {
    localStorage.setItem("ibmsc-theme", JSON.stringify(currentTheme));
    localStorage.setItem("ibmsc-custom-theme", JSON.stringify(customTheme));
  } catch(e) { status("主题已应用，但设置保存失败：{0}", e.message); }
}
try {
  const savedCustom = JSON.parse(localStorage.getItem("ibmsc-custom-theme") || "null");
  if (savedCustom) customTheme = validateTheme(createThemeDraft(savedCustom));
} catch(e) { status("已忽略无效的主题设置：{0}", e.message); }
try {
  const savedTheme = JSON.parse(localStorage.getItem("ibmsc-theme") || "null");
  if (savedTheme) {
    currentTheme = validateTheme(createThemeDraft(savedTheme));
    if (themeChoice() === "custom") customTheme = currentTheme;
    rebuildColumns(); draw();
  }
} catch(e) { status("已忽略无效的主题设置：{0}", e.message); }
syncThemeChoices();
$("portableexport").onclick = async () => {
  $("saveformat").value = "ibmscx";
  await $("saveas").onclick();
};

function drawNoteLabel(ctx, col, timeY, text, long = false) {
  paintNoteLabel(ctx, col, timeY, text, {
    height: noteHeight(), zoom: editorZoom, font: editorFont("kFont", "10px monospace"),
    shiftX: visualNumber(currentTheme, long ? "kLabelHShiftL" : "kLabelHShift", 0) * editorZoom,
    shiftY: visualNumber(currentTheme, "kLabelVShift", 0) * editorZoom,
  });
}

// Apply the saved choice or system language after all controls are registered.
let languageStorage;
try { languageStorage = window.localStorage || globalThis.localStorage; } catch { /* Storage may be blocked. */ }
const initialLanguage = await initialLanguagePreferences({
  storage: languageStorage, navigator: window.navigator, desktop: window.desktop,
});
$("language").value = initialLanguage.id;
applyLanguage(initialLanguage.id, initialLanguage.values);

window.desktop?.onOpenFile?.(token => openNativeFile(null, null, null, token));
