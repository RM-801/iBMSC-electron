import { generalMessages } from "./general-messages.js";
import { coreMessages } from "./core-messages.js";
import { desktopMessages } from "./desktop-messages.js";
import { appMessages } from "./app-messages.js";

export const messageCatalog = [
  ...generalMessages,
  ...coreMessages,
  ...desktopMessages,
  ...appMessages,
];
const exact = new Map(messageCatalog.map((entry) => [entry.source, entry]));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = messageCatalog
  .filter((entry) => /\{\d+\}/.test(entry.source))
  .map((entry) => {
    const slots = [],
      fragments = [];
    let position = 0;
    for (const match of entry.source.matchAll(/\{(\d+)\}/g)) {
      fragments.push(
        escape(entry.source.slice(position, match.index)),
        "([\\s\\S]*?)",
      );
      slots.push(Number(match[1]));
      position = match.index + match[0].length;
    }
    fragments.push(escape(entry.source.slice(position)));
    return {
      entry,
      slots,
      pattern: new RegExp("^" + fragments.join("") + "$"),
    };
  });
const interpolate = (template, values) =>
  template.replace(/\{(\d+)\}/g, (token, index) =>
    values[index] === undefined ? token : String(values[index]),
  );

// Domain errors keep their original messages for logs and existing callers.
// Match complete, authored messages only at the UI boundary. Captured filenames,
// chart lines and characters are opaque data, not another translation source.
export function formatMessage(source, language, values = [], depth = 0) {
  source = String(source);
  if (depth > 8) return source;
  // Electron serializes remote exceptions into this wrapper. Its IPC channel is
  // an implementation detail; retain an unknown cause verbatim if not catalogued.
  const remote = source.match(
    /^Error invoking remote method '[\w:-]+': (?:Error: )?([\s\S]+)$/,
  );
  if (remote)
    return formatMessage(remote[1], language, [], depth + 1) ?? remote[1];
  let entry = exact.get(source),
    parameters = values;
  if (!entry) {
    for (const item of patterns) {
      const match = item.pattern.exec(source);
      if (!match) continue;
      entry = item.entry;
      parameters = [];
      item.slots.forEach((slot, index) => {
        parameters[slot] = match[index + 1];
      });
      break;
    }
  }
  if (!entry) return null;
  parameters = [...parameters];
  for (const index of entry.causes || []) {
    if (parameters[index] !== undefined)
      parameters[index] =
        formatMessage(parameters[index], language, [], depth + 1) ??
        parameters[index];
  }
  return interpolate(
    language === "chs"
      ? entry.source
      : entry[language] || entry.eng || entry.source,
    parameters,
  );
}
