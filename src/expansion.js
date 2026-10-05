import { normalizeId, validId } from "./identifiers.js";

// Form1.vb OpenBMS: only these headers/lanes have dedicated editor controls.
// BASE is an additional supported feature of the port.
const headers = new Set([
  "TITLE",
  "ARTIST",
  "GENRE",
  "BPM",
  "PLAYER",
  "RANK",
  "PLAYLEVEL",
  "SUBTITLE",
  "SUBARTIST",
  "STAGEFILE",
  "BANNER",
  "BACKBMP",
  "DIFFICULTY",
  "EXRANK",
  "TOTAL",
  "COMMENT",
  "LNOBJ",
  "LNTYPE",
  "BASE",
]);
export const isEditorHeader = (key) => headers.has(key);
export const isEditorChannel = (channel) =>
  /^(?:01|03|04|06|07|08|09|[1-8][1-689])$/.test(channel);

// Older port projects stored extension directives in parsed tables. Recover them
// ahead of raw text, preserving the precedence used by their BMS serializer.
export function expansionLines(c) {
  return [
    ...Object.entries(c.headers)
      .filter(([key]) => !isEditorHeader(key))
      .map(([key, value]) => `#${key} ${value}`),
    ...Object.entries(c.resources.BMP).map(
      ([id, value]) => `#BMP${id} ${value}`,
    ),
    ...c.rows
      .filter((row) => !isEditorChannel(row.channel))
      .map(
        (row) =>
          `#${String(row.measure).padStart(3, "0")}${row.channel}:${row.cells.join("")}`,
      ),
    ...c.raw,
  ];
}

export function migrateExpansion(c) {
  c.raw = expansionLines(c);
  for (const key of Object.keys(c.headers))
    if (!isEditorHeader(key)) delete c.headers[key];
  c.resources.BMP = {};
  c.rows = c.rows.filter((row) => isEditorChannel(row.channel));
  return c;
}

// BMP definitions remain editable raw text. This derived index serves filename
// display, diagnostics and clipboard remapping; it is never serialized separately.
function topLevelBMP(lines) {
  let depth = 0;
  const found = [];
  lines.forEach((line, index) => {
    const s = line.trim();
    if (/^#(?:IF|SWITCH|SETSWITCH)\b/i.test(s)) {
      depth++;
      return;
    }
    if (depth) {
      if (/^#(?:ENDIF|ENDSW)\b/i.test(s)) depth--;
      return;
    }
    const match = s.match(/^#BMP([0-9a-z]{2})\s+(.+)$/i);
    if (match) found.push({ index, id: match[1], value: match[2] });
  });
  return found;
}
export function bmpDefinitions(c) {
  const result = { ...c.resources.BMP };
  for (const { id, value } of topLevelBMP(c.raw))
    if (validId(c, id, true)) result[normalizeId(c, id)] = value;
  return result;
}
export function setBMPDefinition(c, id, value) {
  migrateExpansion(c);
  id = normalizeId(c, id);
  const existing = topLevelBMP(c.raw).findLast(
    (entry) => normalizeId(c, entry.id) === id,
  );
  const line = `#BMP${id} ${value}`;
  if (existing) c.raw[existing.index] = line;
  else c.raw.push(line);
}
