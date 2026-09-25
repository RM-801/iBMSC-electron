import { playbackPlan, voiceStart } from "./playback-plan.js";
import { positionStatus, statusNumber } from "./position-status.js";
import { defaultColumns } from "./default-columns.js";
import { gridOffsets } from "./grid-lines.js";
import { playableNoteCount, isPomuTheme, pomuColumns, pomuChannels, pomuStatisticsRows, shiftVisibleNotes } from "./key-layout.js";
import { readPlayerSettings, writePlayerSettings } from "./player-settings.js";
import { remapClipboardNotes, remapClipboardRows } from "./clipboard-base.js";
import { writePortableProject, readPortableProject, validateProjectChart } from "./portable-project.js";
import { themeMetadata } from "./theme-metadata.js";
import { validateVisual, visualNumber, visualColor, visualFont } from "./visual-settings.js";
import { creditsText } from "./credits.js";
import { chartBase, normalizeId, validId, resourceIds } from "./identifiers.js";
import { measureLabel } from "./measure-edit.js";
import { fillBGMColumns } from "./columns.js";
import { headerChoices, headerLabels } from "./header-fields.js";
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
import {
  updateSettingsDocument,
  migrateLayoutPreferences,
  preferenceFields,
  readPreferenceAttributes,
  writePreferenceAttributes,
  xmlEscape,
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
let chart = parseBMS("#BPM 120\n#LNTYPE 1"),
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
  currentTheme = null,
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
function status(s) {
  $("status").textContent = s;
}
function stop() {
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
  $("playstatus").textContent = "";
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
    "PLAYER",
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
  $("show2p").checked = showsSecondPlayer(chart);
  rebuildColumns();
  starts = measureStarts(chart);
  setScrollExtent(scrollEndBeat(chart));
  draw();
}
function setScrollExtent(endBeat) {
  const oldHeight = height;
  height = Math.max(
    endBeat * scale + 30,
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
function resetBGMColumns() {
  statusPointer = null;
  timeStatus = { start: 0, length: 0 };
  for (const key of ["column", "note", "measure", "grid", "reduced", "measurePosition", "absolute", "length", "hidden"])
    $("status-" + key).textContent = "";
  $("bgmcount").value = Math.max(15, maxBGM(chart));
}
function rebuildColumns() {
  const pomu = isPomuTheme(currentTheme);
  $("count").textContent = String(playableNoteCount(statistics(chart, { nt: $("lnstyle").value === "nt" }), currentTheme, showsSecondPlayer(chart)));
  $("secondplayer-option").hidden = pomu;
  $("show2p").disabled = pomu;
  $("show2p").checked = !pomu && showsSecondPlayer(chart);
  if ($("header-player-label")) $("header-player-label").hidden = pomu;
  const bgm = Math.max(
    Math.min(999, Math.max(1, Number($("bgmcount").value) || 15)),
    maxBGM(chart),
  );
  $("bgmcount").value = bgm;
  columns = originalColumns({
    double: pomu || $("show2p").checked,
    bpm: $("showbpm").checked,
    stop: $("showstop").checked,
    bga: $("showbga").checked,
    bgm,
  });
  if (currentTheme) {
    let left = 0;
    for (const col of columns) {
      const style = currentTheme.columns.find(
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
  columns = columns.filter(col => col.width > 0);
  for (const col of columns) {
    col.width *= Number($("widthzoom").value) || 1;
    col.left = columnLeft;
    columnLeft += col.width;
  }
  columns = fillBGMColumns(columns, Math.max(0,
    ...panes.filter(p => !p.panel.hidden).map(p => p.view.clientWidth)));
  contentWidth = columns.at(-1).left + columns.at(-1).width;
  for (const pane of panes) {
    pane.space.style.width = contentWidth + "px";
    const heads = pane.heads;
    heads.replaceChildren();
    heads.style.font = visualFont(currentTheme, "ColumnTitleFont", "10px Tahoma");
    heads.style.color = visualColor(currentTheme, "ColumnTitle", "#ddd");
    heads.style.backgroundColor = visualColor(currentTheme, "Bg", "#000");
    heads.style.width = contentWidth + "px";
    heads.style.gridTemplateColumns = columns
      .map((c) => c.width + "px")
      .join(" ");
    for (const col of columns) {
      const b = document.createElement("b");
      b.textContent = col.title;
      b.style.backgroundColor = col.theme ? argb(col.theme.BG) : "transparent";
      heads.append(b);
    }
  }
}
function laneOf(e) {
  return columns.findIndex((c) => c.id === renderCache.column(e));
}
function y(beat) {
  return height - 20 - beat * scale;
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
  ctx.fillStyle = visualColor(currentTheme, "Bg", "#000");
  ctx.fillRect(left, top, width, h);
  for (const col of columns) {
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
    ctx.fillRect(col.left, top, col.width - 1, h);
  }
  ctx.font = visualFont(currentTheme, "kMFont", "10px monospace");
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
    line(0, visualColor(currentTheme, "MLine", "#808080"));
    ctx.fillStyle = "#ddd";
    ctx.fillText(String(m).padStart(3, "0"), 10, bottom - 5);
  }
  drawWaveOverlay(ctx, top, left, h);
  for (const [a, b] of renderCache.visiblePairs(
    (height - 20 - top - h) / scale,
    (height - 20 - top) / scale,
  )) {
    const col = columns[laneOf(a)];
    if (!col || col.width <= 0) continue;
    ctx.fillStyle = noteColor(columnStyle(col).LongNoteColor);
    ctx.globalAlpha = /^[3478]/.test(a.channel) ? visualNumber(currentTheme, "kOpacity", 0.5) : 1;
    ctx.fillRect(
      col.left + 2,
      y(b.beat),
      col.width - 4,
      Math.max(0, y(a.beat) - y(b.beat) - noteHeight()),
    );
    ctx.globalAlpha = 1;
  }
  for (const e of renderCache.visible(
    (height - 20 - top - h - noteHeight() - 2) / scale,
    (height - 20 - top + noteHeight() + 2) / scale,
  )) {
    const col = columns[laneOf(e)],
      yy = y(e.beat);
    if (!col || col.width <= 0 || yy < top - noteHeight() || yy > top + h + noteHeight()) continue;
    const hidden = /^[3478]/.test(e.channel);
    paintNote(ctx, col, yy, {
      height: noteHeight(), opacity: visualNumber(currentTheme, "kOpacity", 0.5), selectedColor: visualColor(currentTheme, "kSelected", "red"),
      long: e.bgmLong || /^[5678]/.test(e.channel),
      hidden,
      selected:
        selectedIds.has(eventId(e)) ||
        (selected?.row === e.row && selected?.index === e.index),
    });
    const label =
      $("showfilename").checked && col.id > 2
        ? ([22, 23, 24].includes(col.id)
            ? chart.resources.BMP[e.value]
            : chart.resources.WAV[e.value]) || e.value
        : String(numericValue(chart, e));
    drawNoteLabel(ctx, col, yy, label, e.bgmLong || /^[5678]/.test(e.channel));
    ctx.globalAlpha = 1;
  }
  if (drag?.preview) {
    ctx.save();
    ctx.globalAlpha = 0.65;
    for (const [a, b] of drag.preview.pairs) {
      const col = columns.find((c) => c.id === a.column);
      if (!col || col.width <= 0) continue;
      ctx.fillStyle = noteColor(columnStyle(col).LongNoteColor);
      ctx.fillRect(
        col.left + 2,
        y(b.beat),
        col.width - 4,
        Math.max(0, y(a.beat) - noteHeight() - y(b.beat)),
      );
    }
    for (const note of drag.preview.notes) {
      const col = columns.find((c) => c.id === note.column),
        yy = y(note.beat);
      if (!col || col.width <= 0 || yy < top - noteHeight() || yy > top + h + noteHeight())
        continue;
      paintNote(ctx, col, yy, {
      height: noteHeight(), opacity: visualNumber(currentTheme, "kOpacity", 0.5), selectedColor: visualColor(currentTheme, "kSelected", "red"),
        long: note.bgmLong || /^[5678]/.test(note.channel),
        hidden: /^[3478]/.test(note.channel),
        selected: true,
      });
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
      ctx.strokeStyle = "#63ffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(col.left + 2, yy - noteHeight(), col.width - 4, noteHeight());
      ctx.beginPath();
      ctx.moveTo(col.left, yy); ctx.lineTo(col.left + col.width, yy);
      ctx.stroke();
      ctx.strokeStyle = "#ff9e38";
      ctx.beginPath();
      ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py);
      ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4);
      ctx.stroke();
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
    ctx.strokeStyle = visualColor(currentTheme, "SelBox", "#ffda50");
    ctx.fillStyle = "#ffda5020";
    const x = Math.min(box.x0, box.x1),
      yy = Math.min(box.y0, box.y1),
      w = Math.abs(box.x1 - box.x0),
      h = Math.abs(box.y1 - box.y0);
    ctx.fillRect(x, yy, w, h);
    ctx.strokeRect(x, yy, w, h);
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
  let length = "", hidden = "";
  if (note) {
    const pair = renderCache.pairs.find(pair => pair.some(n => eventId(n) === eventId(note)));
    if ($("lnstyle").value === "nt") {
      if (pair) note = pair[0];
      length = "长度 = " + statusNumber(pair ? (pair[1].beat - pair[0].beat) * 48 : 0);
    } else if (note.bgmLong || /^[5678]/.test(note.channel)) length = "长音符";
    if (/^[3478]/.test(note.channel)) hidden = "隐藏";
  } else if (writing) {
    if (drag?.ntwrite && drag.preview) {
      const notes = drag.preview.notes;
      length = "长度 = " + statusNumber((notes.at(-1).beat - notes[0].beat) * 48);
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
  $("status-length").textContent = length;
  $("status-hidden").textContent = hidden;
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
        laneOf(e) === p.lane &&
        p.beat >= e.beat &&
        (p.beat - e.beat) * scale <= noteHeight(),
    );
  if (endpoint) return endpoint;
  if ($("lnstyle").value === "nt" || columns[p.lane].channel === "01") {
    const pair = renderCache.pairs.find(
      ([a, b]) => laneOf(a) === p.lane && p.beat >= a.beat && p.beat <= b.beat,
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
  e.currentTarget.setPointerCapture(e.pointerId);
  const mode = $("tool").value;
  if (mode !== "write" && !found) {
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
  const p = location(e);
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
      const moved = isPomuTheme(currentTheme)
        ? shiftVisibleNotes(drag.notes, columns[drag.start.lane].id, columns[p.lane].id, columns)
        : drag.notes.map(n => ({ ...n, column: n.column + deltaColumn }));
      const notes = moved.map((n) => ({
        ...n,
        beat: n.beat + deltaBeat,
      }));
      const map = new Map(notes.map((n) => [eventId(n), n]));
      const pairs = longPairs(chart)
        .pairs.filter((pair) => pair.every((n) => map.has(eventId(n))))
        .map((pair) => pair.map((n) => map.get(eventId(n))));
      drag.preview = { notes, pairs };
    }
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
    }
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
    isPomuTheme(currentTheme)
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
    status(`已选取音源 ${source.value}`);
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
  $("noteeditlabel").textContent =
    column === 1 ? "BPM" : column === 2 ? "STOP" : "音符编号（按当前 BASE，62 区分大小写）";
  $("noteeditvalue").value = String(numericValue(chart, source));
  $("noteediterror").textContent = "";
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
  } else $("noteediterror").textContent = $("status").textContent;
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
$("widthzoom").onchange = () => {
  const next = Number($("widthzoom").value);
  if (!Number.isFinite(next) || next < 0.25 || next > 99) {
    $("widthzoom").value = horizontalZoom;
    status("横向缩放范围为 0.25–99");
    return;
  }
  const positions = panes.map(p => p.view.scrollLeft / horizontalZoom);
  horizontalZoom = next;
  rebuildColumns();
  panes.forEach((p, i) => { p.view.scrollLeft = positions[i] * next; });
  syncSidebarControls();
  draw();
};
$("zoom").onchange = () => {
  const beat =
    (height - 20 - $("viewport").scrollTop - $("viewport").clientHeight / 2) /
    scale;
  const zoom = Number($("zoom").value);
  if (!Number.isFinite(zoom) || zoom < 0.25 || zoom > 99) {
    $("zoom").value = scale / 48;
    status("纵向缩放范围为 0.25–99");
    return;
  }
  scale = zoom * 48;
  syncSidebarControls();
  refresh();
  $("viewport").scrollTop = y(beat) - $("viewport").clientHeight / 2;
  draw();
};
function applySelectedMeasureRatio(ratio) {
  const selected = [...$("measurelist").selectedOptions].map(o => Number(o.value));
  const measures = selected.length ? selected : [Number($("measure").value)];
  const ok = mutate(() => changeMeasureRatios(chart, measures, ratio,
    $("beatmode").value, { nt: $("lnstyle").value === "nt" }));
  if (ok) {
    $("ratio").value = String(ratio);
    const message = "已更新节拍";
    status(message); $("measurefeedback").textContent = message;
  } else $("measurefeedback").textContent = $("status").textContent;
}
$("applysignature").onclick = () => {
  const n = Number($("beatnumerator").value), d = Number($("beatdenominator").value);
  if (!Number.isInteger(n) || !Number.isInteger(d) || n <= 0 || d <= 0) {
    $("measurefeedback").textContent = "分子和分母必须为正整数";
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
    if (starts[m] * scale + 30 >= height)
      setScrollExtent(Math.min(starts.at(-1), starts[m] + 2000 / 48));
    $("viewport").scrollTop = y(starts[m]) - $("viewport").clientHeight + 30;
    draw();
  }
};
$("new").onclick = async () => {
  if (dirty && !confirm("放弃尚未导出的修改？")) return;
  await window.desktop?.newFile();
  stop();
  chart = parseBMS("#BPM 120\n#LNTYPE 1");
  resetBGMColumns();
  $("saveformat").value = isPomuTheme(currentTheme) ? "pms" : "bms";
  history.reset(chart);
  dirty = false;
  buffers.clear();
  wavSelection = new Set(["01"]);
  $("soundstatus").textContent = "";
  $("sounderrors").hidden = true;
  selected = null;
  selectedIds.clear();
  refresh();
  $("viewport").scrollTop = height;
};
let openingFile = false;
let themeBeforePMS;
function applyFileDefaults(name) {
  const pms = /\.pms$/i.test(name);
  $("saveformat").value = /\.ibmscx$/i.test(name) ? "ibmscx" : /\.ibmsc$/i.test(name) ? "ibmsc" : pms ? "pms" : "bms";
  if (pms) {
    if (!isPomuTheme(currentTheme)) {
      themeBeforePMS = currentTheme;
      currentTheme = themes.Pomu;
      $("theme").value = "Pomu";
    }
  } else if (themeBeforePMS !== undefined) {
    currentTheme = themeBeforePMS;
    themeBeforePMS = undefined;
    $("theme").value = Object.keys(themes).find(name => themes[name] === currentTheme) || "";
  }
}
async function openNativeFile(recentPath, droppedFile) {
  if (openingFile) return;
  if (!window.desktop) {
    $("file").click();
    return;
  }
  let file;
  openingFile = true;
  const beforeOpen = JSON.stringify(chart);
  try {
    if (dirty && !confirm("放弃尚未保存的修改？")) return;
    file = droppedFile
      ? await window.desktop.openDropped(droppedFile)
      : recentPath
        ? await window.desktop.openRecent(recentPath)
        : await window.desktop.open();
    if (!file) return;
    const next = await parseSelectedFile(file.name, file.bytes);
    if (!next) return;
    if (
      JSON.stringify(chart) !== beforeOpen &&
      !confirm("打开文件期间谱面发生了修改，仍要替换当前谱面？")
    )
      return;
    const accepted = await window.desktop.acceptOpen(file.token);
    stop();
    chart = next;
    resetBGMColumns();
    applyFileDefaults(file.name);
    history.reset(chart);
    buffers.clear();
    wavSelection = new Set(["01"]);
    selected = null;
    selectedIds.clear();
    dirty = false;
    refresh();
    $("viewport").scrollTop = height;
    status(accepted?.warning || "已打开 " + file.name);
    await refreshRecentFiles();
    await loadProjectSounds();
  } catch (e) {
    status(e.message);
  } finally {
    openingFile = false;
    if (file?.token)
      await window.desktop.cancelOpen(file.token).catch(() => {});
  }
}
$("open").onclick = () => openNativeFile();
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
    if (dirty && !confirm("放弃尚未导出的修改？")) return;
    stop();
    chart = next;
    resetBGMColumns();
    applyFileDefaults(f.name);
    history.reset(chart);
    buffers.clear();
    wavSelection = new Set(["01"]);
    selected = null;
    selectedIds.clear();
    dirty = false;
    refresh();
    $("viewport").scrollTop = height;
    status("已打开 " + f.name);
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
  if (!confirm("BGM 区不可以在 BMS 中存放 LN/CN。继续保存会将这些长音符转为仅在起点播放的普通 BGM 音符，终点不会保存。编辑器中的暂存长条仍保留。是否继续？")) return null;
  return flattenBGMLongs(snapshot);
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
      : { text: serializeBMS(snapshot) }),
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
        history.markSaved(saveSnapshot);
        refresh();
        status(result.warning || "已保存 " + result.name);
        await refreshRecentFiles();
      }
    } catch (e) {
      status(e.message);
    }
    return;
  }
  if ($("saveformat").value === "ibmscx") {
    try { downloadText(writePortableProject(chart), (chart.headers.TITLE || "untitled") + ".ibmscx"); status("已开始下载"); }
    catch (e) { status(e.message); }
    return;
  }
  if ($("saveformat").value === "ibmsc") {
    $("projectexport").click();
    return;
  }
  const snapshot = confirmedSaveSnapshot("bms");
  if (!snapshot) return;
  const url = URL.createObjectURL(
      new Blob([serializeBMS(snapshot)], { type: "text/plain;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download =
    (chart.headers.TITLE || "untitled").replace(/[\\/:*?"<>|]/g, "_") + ($("saveformat").value === "pms" ? ".pms" : ".bms");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  refresh();
  status("已开始下载");
};
async function context() {
  audio ??= new AudioContext();
  await audio.resume();
  return audio;
}
async function preview(name) {
  try {
    await context();
    const b = buffers.get(name.toLowerCase().replaceAll("\\", "/"));
    if (!b) {
      status("请先加载音源文件");
      return;
    }
    const s = audio.createBufferSource();
    s.buffer = b;
    s.connect(audio.destination);
    s.start();
    sources.push(s);
  } catch (e) {
    status(e.message);
  }
}
$("audiofiles").onclick = () =>
  window.desktop ? loadProjectSounds() : $("sounds").click();
if (window.desktop) {
  $("audiofiles").textContent = "重新关联音源";
}
async function loadBrowserSounds(files) {
  try {
    await context();
    let failed = 0;
    for (const f of files) {
      try {
        const decoded = await audio.decodeAudioData(await f.arrayBuffer());
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
    refresh();
    status(`已加载 ${buffers.size} 个音源；失败 ${failed} 个`);
  } catch (e) {
    status(e.message);
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
        $("playstatus").textContent = "播放结束；缺失音源 " + missing + " 个";
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
      $("playstatus").textContent =
        "播放中，从第 " + fromBeat.toFixed(3) + " 拍开始";
    }
  } catch (e) {
    stop();
    status(e.message);
  }
}
$("play").onclick = () => startPlayback();
$("playhere").onclick = () =>
  startPlayback(starts[Number($("measure").value)] || 0);
$("stop").onclick = () => {
  stop();
  draw();
};
let keyboardPane = panes[0];
for (const pane of panes) {
  pane.canvas.tabIndex = 0;
  pane.canvas.addEventListener("pointerdown", () => {
    keyboardPane = pane;
    pane.canvas.focus?.({ preventScroll: true });
  });
}
window.addEventListener("keydown", (e) => {
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
    if (k === "/") {
      e.preventDefault();
      $("grid").value = $("slashgrid").value;
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
                      (Number($("pageunits").value) / 48) *
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

$("show2p").onchange = () => {
  if (isPomuTheme(currentTheme)) return;
  mutate(() => {
    chart.headers.PLAYER = $("show2p").checked ? "3" : "1";
  });
};
for (const id of ["showbpm", "showstop", "showbga", "bgmcount"])
  $(id).onchange = () => {
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
  $("sourcedialog").showModal();
};
$("sourcecancel").onclick = () => $("sourcedialog").close();
$("sourceapply").onclick = () => {
  try {
    const next = parseBMS($("source").value);
    if (
      !mutate(() => {
        chart = next;
        resetBGMColumns();
      })
    )
      return;
    $("sourcedialog").close();
    status("已应用修改");
  } catch (e) {
    $("sourceerror").textContent = e.message;
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
  mutate(() => (chart.resources[type][id] = value));
  $("sample").value = id;
  status("已更新 #" + type + id);
};

let copiedRows = [], copiedRowsBase = 36, noteClipboardBase = 36, copiedRowsSource = null, noteClipboardSource = null;
const range = () => [Number($("rangefrom").value), Number($("rangeto").value)];
$("copyrange").onclick = () => {
  try {
    copiedRows = copyMeasures(chart, ...range(), activeChannels);
    copiedRowsBase = chartBase(chart); copiedRowsSource = structuredClone(chart);
    status("已复制全部轨道 " + copiedRows.length + " 行");
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
  mutate(() => mirrorMeasures(chart, ...range(), activeChannels, isPomuTheme(currentTheme) ? pomuChannels : null));
$("deleterange").onclick = () =>
  mutate(() => deleteMeasures(chart, ...range(), activeChannels));

$("insertmeasure").onclick = () =>
  mutate(() => insertMeasure(chart, Number($("measure").value)));
$("removemeasure").onclick = () =>
  mutate(() => removeMeasure(chart, Number($("measure").value)));
function report(title, text) {
  $("statstable").hidden = true;
  $("reporttitle").textContent = title;
  $("reporttext").textContent = text;
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
    const cell = document.createElement("th"); cell.textContent = title; header.append(cell);
  }
  table.append(header);
  const displayRows = isPomuTheme(currentTheme) ? pomuStatisticsRows(s, currentTheme) : s.rows.flatMap((name, i) => i === 2
    ? [...s.aLanes, { name: "A1–A8 小计", counts: s.data[i], subtotal: true }]
    : i === 3 && s.showD
      ? [...s.dLanes, { name: "D1–D8 小计", counts: s.data[i], subtotal: true }]
      : [{ name, counts: s.data[i], subtotal: i === 5 }]);
  displayRows.forEach(({ name, counts, subtotal }) => {
    const row = document.createElement("tr");
    if (subtotal) row.className = "statistics-subtotal";
    const label = document.createElement("th"); label.textContent = name; row.append(label);
    for (const value of counts) {
      const cell = document.createElement("td"); cell.textContent = String(value); row.append(cell);
    }
    table.append(row);
  });
  table.hidden = false;
};
$("errorcheck").onclick = () => {
  const list = diagnose(chart);
  report(
    "错误检查",
    list.length
      ? list
          .map(
            (i) =>
              `#${String(i.event.measure).padStart(3, "0")} ${i.event.channel} ${i.event.value}：${i.message}`,
          )
          .join("\n")
      : "未发现重叠、缺失定义或未配对长音符",
  );
};
$("findopen").onclick = () => $("finddialog").showModal();
$("findclose").onclick = () => $("finddialog").close();
function matches() {
  const value = normalizeId(chart, $("findvalue").value),
    ch = $("findchannel").value.toUpperCase();
  return events(chart).filter(
    (e) => (!value || e.value === value) && (!ch || e.channel === ch),
  );
}
$("findnext").onclick = () => {
  const found = matches();
  if (!found.length) {
    status("没有匹配事件");
    return;
  }
  const n =
    found[
      (found.findIndex(
        (e) => e.row === selected?.row && e.index === selected?.index,
      ) +
        1) %
        found.length
    ];
  selected = n;
  $("viewport").scrollTop = y(n.beat) - $("viewport").clientHeight / 2;
  const col = columns[laneOf(n)];
  if (col) $("viewport").scrollLeft = Math.max(0, col.left - 80);
  draw();
  status("找到 " + found.length + " 个匹配事件");
};
$("replaceall").onclick = () => {
  const value = normalizeId(chart, $("replacevalue").value);
  if (!validId(chart, value) || value === "00") {
    status("替换编号超出当前 BASE 范围");
    return;
  }
  const found = matches();
  if (found.some((e) => e.channel === "03" && !/^[0-9A-F]{2}$/.test(value))) {
    status("BPM 03 只能使用十六进制编号");
    return;
  }
  mutate(() =>
    found.forEach((e) => (chart.rows[e.row].cells[e.index] = value)),
  );
};
$("deletefound").onclick = () => {
  const found = matches();
  mutate(() => found.forEach((e) => (chart.rows[e.row].cells[e.index] = "00")));
};

$("projectexport").onclick = () => {
  try {
    const url = URL.createObjectURL(new Blob([writeProject(chart)])),
      a = document.createElement("a");
    a.href = url;
    a.download = (chart.headers.TITLE || "untitled") + ".ibmsc";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("已导出 IBMSC");
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
  status("已复制 " + noteClipboard.length + " 个音符");
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
  const bottomBeat = (height - 20 - view.scrollTop - view.clientHeight) / scale;
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
    status(`已粘贴 ${noteClipboard.length} 个音符至 ${String(measure).padStart(3, "0")} 小节`);
  }
};
$("convertnotes").onclick = () => {
  const notes = captureNotes(chart, selectedIds);
  const type = $("conversion").value;
  if (!notes.length) return;
  if (type === "mirror") {
    mutate(() => mirrorCaptured(chart, notes, isPomuTheme(currentTheme) ? pomuColumns : null));
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
async function loadProjectSounds() {
  if (!window.desktop) return;
  const targetChart = chart,
    generation = ++soundLoadGeneration;
  const active = () =>
    chart === targetChart && generation === soundLoadGeneration;
  const names = [...new Set(Object.values(targetChart.resources.WAV))];
  let loaded = 0;
  const errors = [];
  $("sounderrors").hidden = true;
  $("sounderrorlist").textContent = "";
  $("soundstatus").textContent = "正在自动关联音源…";
  try {
    if (names.length) audio ??= new AudioContext();
    for (const name of names) {
      if (!active()) return;
      const key = name.toLowerCase().replaceAll("\\", "/");
      try {
        const data = await window.desktop.asset(name);
        if (!active()) return;
        const decoded = await audio.decodeAudioData(
          new Uint8Array(data).buffer,
        );
        if (!active()) return;
        buffers.set(key, decoded);
        loaded++;
      } catch (e) {
        if (!active()) return;
        buffers.delete(key);
        errors.push(name + "：" + e.message);
      }
    }
    if (!active()) return;
    refresh();
    const message = names.length
      ? `音源已关联：${loaded} 个；未能加载：${errors.length} 个`
      : "谱面未定义音源";
    $("soundstatus").textContent = message;
    $("sounderrors").hidden = !errors.length;
    $("sounderrorlist").textContent = errors.join("\n");
    status(message);
  } catch (e) {
    if (active()) {
      $("soundstatus").textContent = "音源关联失败：" + e.message;
      status($("soundstatus").textContent);
    }
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
      history.markSaved(saveSnapshot);
      refresh();
      status(result.warning || "已另存为 " + result.name);
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
      ? validateProjectChart(JSON.parse(text).chart) : parseBMS(text);
    await window.desktop?.newFile();
    mutate(() => {
      chart = recovered;
      resetBGMColumns();
    });
    status("已恢复自动保存内容，请另存为文件");
  } catch (e) {
    status(e.message);
  }
};
setInterval(async () => {
  if (!dirty || !$("autosave").checked) return;
  try {
    const text = JSON.stringify({ format: "ibmsc-recovery-v1", chart });
    if (window.desktop) await window.desktop.autosave(text);
    else localStorage.setItem("ibmsc-recovery", text);
  } catch (e) {
    status("自动保存失败：" + e.message);
  }
}, 60000);

function syncHeaderControl(key, input) {
  const value = chart.headers[key] ?? (key === "PLAYER" ? "1" : "");
  if (headerChoices[key]) {
    const choices = [...headerChoices[key]];
    if (!choices.some(([id]) => id === value))
      choices.push([value, `原文件值：${value}`]);
    input.replaceChildren();
    for (const [id, label] of choices) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      option.selected = id === value;
      input.append(option);
    }
  }
  input.value = value;
}
const extraHeaders = [
  "SUBTITLE",
  "SUBARTIST",
  "PLAYER",
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
  if (key === "PLAYER") label.id = "header-player-label";
  label.textContent = headerLabels[key] || key;
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
  $(["PLAYER", "RANK"].includes(key) ? "primaryheaders" : "extraheaders").append(label);
}

function argb(value) {
  const n = Number(value) >>> 0;
  return `rgba(${(n >>> 16) & 255},${(n >>> 8) & 255},${n & 255},${(n >>> 24) / 255})`;
}
for (const [name, metadata] of Object.entries(themeMetadata)) if (themes[name]) Object.assign(themes[name], metadata);
for (const name of Object.keys(themes)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  $("theme").append(option);
}
$("theme").onchange = () => {
  themeBeforePMS = undefined;
  currentTheme = themes[$("theme").value] || null;
  persistTheme();
  rebuildColumns();
  draw();
};
$("themeimport").onclick = () => $("themefile").click();
$("themefile").onchange = async () => {
  try {
    const f = $("themefile").files[0];
    if (!f) return;
    const text = decodeXML(await f.arrayBuffer());
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.querySelector("parsererror")) throw Error("主题 XML 无效");
    const cols = [...xml.querySelectorAll("Columns > Column")].map((e) =>
      Object.fromEntries([...e.attributes].map((a) => [a.name, a.value])),
    );
    if (
      !cols.length ||
      cols.some(
        (c) =>
          !Number.isInteger(+c.Index) ||
          !Number.isFinite(+c.Width) ||
          +c.Width < 0 ||
          +c.Width > 500,
      )
    )
      throw Error("主题列定义无效");
    const visual = Object.fromEntries([...xml.querySelectorAll("VisualSettings > *")].map(e => [e.tagName, Object.fromEntries([...e.attributes].map(a => [a.name, a.value]))]));
    validateVisual(visual);
    currentTheme = { columns: cols, visual, sourceXml: text };
    themeBeforePMS = undefined;
    persistTheme();
    rebuildColumns();
    draw();
    status("已载入主题 " + f.name);
  } catch (e) {
    status(e.message);
  } finally {
    $("themefile").value = "";
  }
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
    $("waveinfo").textContent = "未加载音源";
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
  $("waveinfo").textContent =
    `${name} · ${buffer.duration.toFixed(3)} s · ${buffer.sampleRate} Hz`;
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
  for (const mode of toolModes)
    $("tool-" + mode).setAttribute(
      "aria-pressed",
      String($("tool").value === mode),
    );
}
for (const mode of toolModes)
  $("tool-" + mode).onclick = () => {
    $("tool").value = mode;
    syncToolButtons();
  };
$("tool").onchange = syncToolButtons;
syncToolButtons();

const mainMenus = [...document.querySelectorAll("header nav details.menu")];
function closeMainMenus(except = null) {
  for (const menu of mainMenus) if (menu !== except) menu.open = false;
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
for (const name of ["generalsettings", "displaysettings", "playersettings",
  "languagesettings", "themesettings", "fileoptions", "inputsettings", "bpmtools", "slashsettings"]) {
  $(name).onclick = () => {
    closeMainMenus();
    $(name + "dialog").showModal();
  };
}
function syncInputMode() {
  const nt = $("lnstyle").value === "nt";
  $("toggleln").textContent = `长音符输入方式：${nt ? "NT" : "BMSE"}　F8`;
  $("toggleln").setAttribute("aria-pressed", String(nt));
  document.querySelectorAll('[data-action="toggleln"]').forEach(button => {
    button.textContent = nt ? "NT" : "BMSE";
    button.setAttribute("aria-pressed", String(nt));
    button.title = `当前 ${nt ? "NT" : "BMSE"}，切换输入方式（F8）`;
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
for (const type of ["long", "short", "hidden", "visible", "value", "mirror"]) {
  $("convert-" + type).onclick = () => {
    closeMainMenus();
    if (!selectedIds.size) { status("请先选择要转换的音符"); return; }
    if (type === "value") {
      $("conversionvalue").value = $("sample").value;
      $("conversionerror").textContent = "";
      $("convertvaluedialog").showModal();
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
    else $("conversionerror").textContent = $("status").textContent;
  } catch (e) { $("conversionerror").textContent = e.message; }
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
      `选中编号被 ${usage} 个事件引用，移除定义会保留音符但使音源缺失。仍然移除？`,
    )
  )
    return;
  mutate(() => {
    for (const id of ids) delete chart.resources.WAV[id];
  });
};
for (const id of ["showfilename", "showgrid"]) $(id).onchange = draw;

let activePlayer = null;
function renderPlayers(state) {
  $("playerlist").replaceChildren();
  for (const p of state.players) {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.path.split(/[\\/]/).at(-1);
    $("playerlist").append(option);
  }
  activePlayer = state.current;
  $("playerlist").value = activePlayer || "";
  const player = state.players.find((p) => p.id === activePlayer);
  $("playername").textContent = player?.path || "尚未选择";
  for (const mode of ["begin", "here", "stop"]) {
    $("player" + mode).value = player?.[mode] || "";
    $("player" + mode).disabled = !player;
  }
  $("playerremove").disabled = !player;
}
async function savePlayerTemplates() {
  if (!activePlayer) return;
  const templates = Object.fromEntries(
    ["begin", "here", "stop"].map((mode) => [mode, $("player" + mode).value]),
  );
  await window.desktop.updatePlayer(activePlayer, templates);
}
async function choosePlayer(add) {
  if (!window.desktop) {
    status("外部播放器配置需要桌面版");
    return;
  }
  try {
    await savePlayerTemplates();
    const state = await window.desktop.choosePlayer(add ? null : activePlayer);
    if (state) renderPlayers(state);
  } catch (e) {
    status(e.message);
  }
}
$("playerchoose").onclick = () => choosePlayer(false);
$("playeradd").onclick = () => choosePlayer(true);
$("playerlist").onchange = async () => {
  try {
    const next = $("playerlist").value;
    await savePlayerTemplates();
    renderPlayers(await window.desktop.selectPlayer(next));
  } catch (e) {
    $("playerlist").value = activePlayer || "";
    status(e.message);
  }
};
$("playerremove").onclick = async () => {
  if (!activePlayer) return;
  try {
    renderPlayers(await window.desktop.removePlayer(activePlayer));
  } catch (e) {
    status(e.message);
  }
};
for (const mode of ["begin", "here", "stop"])
  $("player" + mode).onchange = () =>
    savePlayerTemplates().catch((e) => status(e.message));
if (window.desktop?.players)
  window.desktop
    .players()
    .then(renderPlayers)
    .catch((e) => status(e.message));
async function runExternal(mode) {
  if (!window.desktop) {
    status("外部播放器需要桌面版");
    return;
  }
  try {
    const snapshot = confirmedSaveSnapshot("bms");
    if (!snapshot) return;
    await savePlayerTemplates();
    await window.desktop.runPlayer({
      playerId: activePlayer,
      mode,
      text: serializeBMS(snapshot),
      measure: Number($("measure").value),
    });
    status("已发送外部播放器命令");
  } catch (e) {
    status(e.message);
  }
}
$("externalbegin").onclick = () => runExternal("begin");
$("externalhere").onclick = () => runExternal("here");
$("externalstop").onclick = () => runExternal("stop");

const languageButtons = {
  new: "Menu/File/New",
  open: "Menu/File/Open",
  save: "Menu/File/Save",
  saveas: "Menu/File/SaveAs",
  projectexport: "Menu/File/ExportIBMSC",
  undo: "Menu/Edit/Undo",
  redo: "Menu/Edit/Redo",
  cutnotes: "Menu/Edit/Cut",
  copynotes: "Menu/Edit/Copy",
  pastenotes: "Menu/Edit/Paste",
  deletenotes: "Menu/Edit/Delete",
  selectall: "Menu/Edit/SelectAll",
  findopen: "Menu/Edit/Find",
  statistics: "Menu/Edit/Stat",
  errorcheck: "Menu/Options/ErrorCheck",
  play: "Menu/Preview/PlayBegin",
  playhere: "Menu/Preview/PlayHere",
  stop: "Menu/Preview/PlayStop",
};
function applyLanguage(locale) {
  for (const [id, path] of Object.entries(languageButtons)) {
    if (!locale.values[path]) continue;
    $(id).textContent = locale.values[path];
    $(id).title = locale.values[path];
    document.querySelectorAll(`[data-action="${id}"]`).forEach((el) => {
      el.textContent = locale.values[path];
      el.title = locale.values[path];
    });
  }
  const groups = ["File", "Edit", "Options", "Conversion", "Preview"];
  document
    .querySelectorAll("header nav > details > summary")
    .forEach((el, i) => {
      const key =
        groups[i] === "Conversion"
          ? "Menu/Conversion"
          : "Menu/" + groups[i] + "/Title";
      if (locale.values[key]) el.textContent = locale.values[key];
    });
}
for (const [id, locale] of Object.entries(locales)) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = locale.name;
  $("language").append(o);
}
$("language").onchange = () => {
  const locale = locales[$("language").value];
  if (locale) applyLanguage(locale);
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
    applyLanguage({ values });
    status("已载入语言文件 " + file.name);
  } catch (e) {
    status(e.message);
  } finally {
    $("languagefile").value = "";
  }
};
let importedSettings = null;
function preferenceValues() {
  return Object.fromEntries(
    [...Object.keys(preferenceFields), "lnstyle", "beatmode"].map((id) => [
      id,
      preferenceFields[id]?.[2] === "boolean" ? $(id).checked : $(id).value,
    ]),
  );
}
function applyPreferences(values) {
  for (const [id, value] of Object.entries(values)) {
    if (!$(id)) continue;
    if (typeof value === "boolean") $(id).checked = value;
    else $(id).value = value;
  }
  scale = Number($("zoom").value) * 48;
  horizontalZoom = Number($("widthzoom").value);
  syncSidebarControls();
  $("samples").multiple = $("wavmulti").checked;
  for (const side of ["left", "right"])
    $("pane-" + side).hidden = !$("split-" + side).checked;
  syncInputMode();
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
    const players = readPlayerSettings(doc);
    if (players && window.desktop?.importPlayers) renderPlayers(await window.desktop.importPlayers(players));
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
  if (window.desktop?.players) writePlayerSettings(doc, await window.desktop.players());
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
  if (currentTheme?.sourceXml) {
    downloadText(currentTheme.sourceXml.replace(/<\?xml[^?]*\?>/i, '<?xml version="1.0" encoding="utf-8"?>'), "Custom.Theme.xml");
    return;
  }
  const cols = currentTheme?.columns || defaultColumns;
  const unique = [...new Map(cols.map((c) => [Number(c.Index), c])).values()];
  downloadText(
    '<?xml version="1.0" encoding="utf-8"?>\n<iBMSC Major="3" Minor="0" Build="5"><Columns>' +
      unique
        .map(
          (c) =>
            "<Column " +
            Object.entries(c)
              .filter(([key]) => /^[A-Za-z][\w.-]*$/.test(key))
              .map(([key, value]) => key + '="' + xmlEscape(value) + '"')
              .join(" ") +
            " />",
        )
        .join("") +
      "</Columns></iBMSC>",
    "Custom.Theme.xml",
  );
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
    status("设置未能持久保存：" + e.message);
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
  $(id).addEventListener("change", persistPreferences);

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
  const hidden = !$("options-panel").hidden;
  $("options-panel").hidden = hidden;
  $("options-resizer").hidden = hidden;
  $("workspace").classList.toggle("options-hidden", hidden);
  $("toggle-options").setAttribute("aria-expanded", String(!hidden));
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
  const center = left + Number($("waveleft").value),
    amplitude = Number($("wavewidth").value) / 2;
  if (![origin, center, amplitude].every(Number.isFinite)) return;
  ctx.strokeStyle = `rgba(80,160,220,${Number($("waveopacity").value) / 255})`;
  ctx.lineWidth = 1;
  for (
    let channel = 0;
    channel < Math.min(2, overlayBuffer.numberOfChannels);
    channel++
  ) {
    const samples = overlayBuffer.getChannelData(channel);
    ctx.beginPath();
    for (let step = 0; step <= Math.ceil(pixels * precision); step++) {
      const yy = top + step / precision;
      const beat = (height - 20 - yy) / scale;
      const seconds = overlayClock(beat) - origin;
      const x =
        center +
        waveformSample(samples, overlayBuffer.sampleRate, seconds) * amplitude;
      if (!step) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}
$("waveload").onclick = () => $("wavefile").click();
$("wavefile").onchange = async () => {
  const file = $("wavefile").files[0];
  if (!file) return;
  const generation = ++overlayGeneration;
  try {
    if (file.size > 256 * 1024 * 1024) throw Error("波形文件超过 256 MB");
    audio ??= new AudioContext();
    const buffer = await audio.decodeAudioData(await file.arrayBuffer());
    if (generation !== overlayGeneration) return;
    overlayBuffer = buffer;
    $("overlayname").textContent = file.name;
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
  $("overlayname").textContent = name;
  draw();
};
$("waveclear").onclick = () => {
  overlayGeneration++;
  overlayBuffer = null;
  $("overlayname").textContent = "未加载叠加波形";
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
    const allowed = ["portableexport", "about", "new", "open", "save", "saveas", "projectexport", "recover", "undo", "redo", "cutnotes", "copynotes", "pastenotes", "deletenotes", "selectall", "findopen", "statistics", "errorcheck", "themeimport", "toggle-options", "convertnotes", "play", "playhere", "stop",
      "generalsettings", "displaysettings", "playersettings", "languagesettings", "themesettings", "fileoptions", "inputsettings", "bpmtools", "toggleln", "previewclick", "showfilename",
      "tool-time", "tool-select", "tool-write", "externalbegin", "externalhere", "externalstop",
      "convert-long", "convert-short", "convert-hidden", "convert-visible", "convert-value", "convert-mirror", "sourceopen"];
    if (allowed.includes(action)) $(action).click();
  });
}

$("about").onclick = () => report("关于 iBMSC · 作者与贡献者", creditsText);

function noteHeight() { return visualNumber(currentTheme, "kHeight", 10); }

function persistTheme() {
  try { localStorage.setItem("ibmsc-theme", JSON.stringify(currentTheme)); }
  catch(e) { status("主题已应用，但设置保存失败：" + e.message); }
}
try {
  const savedTheme = JSON.parse(localStorage.getItem("ibmsc-theme") || "null");
  if (savedTheme && Array.isArray(savedTheme.columns) && savedTheme.columns.length <= 27 && savedTheme.columns.every(c => Number.isInteger(+c.Index) && +c.Index>=0 && +c.Index<=26 && Number.isFinite(+c.Width) && +c.Width>=0 && +c.Width<=500)) {
    validateVisual(savedTheme.visual);
    currentTheme = savedTheme;
    rebuildColumns(); draw();
  }
} catch(e) { status("已忽略无效的主题设置：" + e.message); }
$("portableexport").onclick = async () => {
  $("saveformat").value = "ibmscx";
  await $("saveas").onclick();
};

function drawNoteLabel(ctx, col, timeY, text, long = false) {
  paintNoteLabel(ctx, col, timeY, text, {
    height: noteHeight(), font: visualFont(currentTheme, "kFont", "10px monospace"),
    shiftX: visualNumber(currentTheme, long ? "kLabelHShiftL" : "kLabelHShift", 0),
    shiftY: visualNumber(currentTheme, "kLabelVShift", 0),
  });
}
