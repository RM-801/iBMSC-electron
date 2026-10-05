import {
  createThemeDraft,
  validateTheme,
  argbToParts,
  partsToARGB,
} from "./theme-editor.js";
import {
  columnColors,
  visualColors,
  themeFonts,
  themeNumbers,
} from "./theme-editor-fields.js";
import { noteColor, paintNote, paintNoteLabel } from "./note-render.js";
import { visualColor, visualFont, visualNumber } from "./visual-settings.js";

export function createThemeEditor({ root, preview, ui, onChange, onError }) {
  const document = root.ownerDocument || globalThis.document;
  const bindings = [],
    columnOptions = [];
  let draft = null,
    columnIndex = 4;
  const element = (tag, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  };
  const text = (tag, source) => {
    const el = element(tag);
    ui.text(el, source);
    return el;
  };
  const fieldset = (source) => {
    const group = element("fieldset", "themeedit-group");
    group.append(text("legend", source));
    root.append(group);
    return group;
  };
  const input = (id, type, label, min, max, step) => {
    const control = element("input");
    control.id = "themeedit-" + id;
    control.type = type;
    if (min !== undefined) control.min = String(min);
    if (max !== undefined) control.max = String(max);
    if (step !== undefined) control.step = String(step);
    ui.attribute(control, "aria-label", label);
    control.oninput = changed;
    control.onchange = changed;
    return control;
  };
  const row = (group, label, control) => {
    const line = element("div", "themeedit-row");
    const name = text("label", label);
    name.htmlFor = control.id;
    line.append(name, control);
    group.append(line);
    return line;
  };
  const bind = (control, get, set, property = "value") => {
    bindings.push({ control, get, set, property });
  };
  const colorRow = (group, id, label, get, set) => {
    const color = input(id, "color", label);
    const alpha = input(id + "-alpha", "number", "不透明度", 0, 255, 1);
    const line = row(group, label, color);
    line.className += " themeedit-color";
    const alphaLabel = text("label", "不透明度");
    alphaLabel.htmlFor = alpha.id;
    line.append(alphaLabel, alpha);
    bindings.push({
      fill() {
        const parts = argbToParts(get());
        color.value = parts.color;
        alpha.value = String(parts.alpha);
      },
      commit() {
        const value = partsToARGB(color.value, alpha.value);
        // Presets store signed ARGB while the picker returns unsigned ARGB.
        // Preserve the source representation when the actual color is unchanged.
        if (Number(value) >>> 0 !== Number(get()) >>> 0) set(value);
      },
    });
  };

  const columnsGroup = fieldset("轨道");
  const columnSelect = element("select");
  columnSelect.id = "themeedit-column";
  ui.attribute(columnSelect, "aria-label", "轨道");
  row(columnsGroup, "轨道", columnSelect);
  columnSelect.onchange = () => {
    const next = Number(columnSelect.value);
    try {
      read();
      columnIndex = next;
      fill();
      render();
      onError?.(null);
    } catch (error) {
      columnSelect.value = String(columnIndex);
      onError?.(error);
    }
  };
  const title = input("column-Title", "text", "标题");
  row(columnsGroup, "标题", title);
  bind(
    title,
    () => draft.columns[columnIndex].Title,
    (value) => (draft.columns[columnIndex].Title = value),
  );
  const width = input("column-Width", "number", "宽度", 0, 999, 1);
  row(columnsGroup, "宽度", width);
  bind(
    width,
    () => draft.columns[columnIndex].Width,
    (value) => (draft.columns[columnIndex].Width = value),
  );
  for (const [key, label] of columnColors)
    colorRow(
      columnsGroup,
      "column-" + key,
      label,
      () => draft.columns[columnIndex][key],
      (value) => (draft.columns[columnIndex][key] = value),
    );

  const colorsGroup = fieldset("颜色");
  for (const [key, label] of visualColors)
    colorRow(
      colorsGroup,
      key,
      label,
      () => draft.visual[key].Value,
      (value) => (draft.visual[key].Value = value),
    );

  const fontsGroup = fieldset("字体和音符");
  for (const [key, label] of themeFonts) {
    const fontGroup = element("fieldset", "themeedit-font");
    fontGroup.append(text("legend", label));
    fontsGroup.append(fontGroup);
    const name = input(key + "-Name", "text", "字体");
    row(fontGroup, "字体", name);
    bind(
      name,
      () => draft.visual[key].Name,
      (value) => (draft.visual[key].Name = value),
    );
    const size = input(key + "-Size", "number", "大小", 1, 100, 0.5);
    row(fontGroup, "大小", size);
    bind(
      size,
      () => draft.visual[key].Size,
      (value) => (draft.visual[key].Size = value),
    );
    const styles = element("div", "themeedit-fontstyle");
    for (const [style, bit, styleLabel] of [
      ["Bold", 1, "粗体"],
      ["Italic", 2, "斜体"],
    ]) {
      const check = input(key + "-" + style, "checkbox", styleLabel);
      const checkLabel = element("label");
      checkLabel.append(check, text("span", styleLabel));
      styles.append(checkLabel);
      bind(
        check,
        () => Boolean(Number(draft.visual[key].Style) & bit),
        (checked) => {
          // Changing bold/italic leaves legacy underline and strikeout bits intact.
          const previous = Number(draft.visual[key].Style);
          draft.visual[key].Style = String(
            checked ? previous | bit : previous & ~bit,
          );
        },
        "checked",
      );
    }
    fontGroup.append(styles);
  }
  for (const [key, label, min, max, step] of themeNumbers) {
    const control = input(key, "number", label, min, max, step);
    row(fontsGroup, label, control);
    bind(
      control,
      () => draft.visual[key].Value,
      (value) => (draft.visual[key].Value = value),
    );
  }
  preview.width = 320;
  preview.height = 180;
  ui.attribute(preview, "aria-label", "预览");
  columnsGroup.append(preview);

  function refreshOptions() {
    draft.columns.forEach((column, index) => {
      let option = columnOptions[index];
      if (!option) {
        option = element("option");
        option.value = String(index);
        columnSelect.append(option);
        columnOptions.push(option);
      }
      // Column titles are user content, not translation keys.
      ui.raw(
        option,
        String(index).padStart(2, "0") +
          (column.Title ? " · " + column.Title : ""),
      );
    });
    columnSelect.value = String(columnIndex);
  }
  function fill() {
    for (const binding of bindings) {
      if (binding.fill) binding.fill();
      else binding.control[binding.property] = binding.get();
    }
    refreshOptions();
  }
  function read() {
    for (const binding of bindings) {
      if (binding.commit) binding.commit();
      else binding.set(binding.control[binding.property]);
    }
    validateTheme(draft);
    return createThemeDraft(draft);
  }
  function changed() {
    if (!draft) return;
    try {
      const result = read();
      refreshOptions();
      render();
      onError?.(null);
      onChange?.(result);
    } catch (error) {
      onError?.(error);
    }
  }
  function render() {
    if (!draft) return;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    const style = draft.columns[columnIndex];
    const width = Number(style.Width);
    const height = visualNumber(draft, "kHeight", 10);
    const cols = [0, 1, 2].map((index) => ({
      id: columnIndex,
      theme: style,
      width,
      left: 44 + index * width,
    }));
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.fillStyle = visualColor(draft, "Bg", "#000");
    ctx.fillRect(0, 0, preview.width, preview.height);
    for (const col of cols) {
      ctx.fillStyle = noteColor(style.BG);
      ctx.fillRect(col.left, 22, Math.max(0, width - 1), 158);
      ctx.strokeStyle = visualColor(draft, "VLine", "#444");
      ctx.beginPath();
      ctx.moveTo(col.left, 22);
      ctx.lineTo(col.left, 180);
      ctx.stroke();
    }
    for (let y = 42; y < 180; y += 20) {
      ctx.strokeStyle = visualColor(
        draft,
        y === 122 ? "MLine" : y % 40 === 2 ? "Grid" : "Sub",
        "#444",
      );
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(320, y);
      ctx.stroke();
    }
    ctx.fillStyle = noteColor(draft.columns[0].TextColor);
    ctx.font = visualFont(draft, "kMFont", "10px monospace");
    ctx.fillText("000", 5, 117);
    for (const col of cols) {
      if (width <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(col.left, 0, width, 22);
      ctx.clip();
      ctx.fillStyle = visualColor(draft, "ColumnTitle", "#0f0");
      ctx.font = visualFont(draft, "ColumnTitleFont", "10px Tahoma");
      ctx.fillText(style.Title, col.left + 2, 15);
      ctx.restore();
    }
    const note = (col, y, flags, label) => {
      if (width <= 0) return;
      paintNote(ctx, col, y, {
        ...flags,
        height,
        opacity: visualNumber(draft, "kOpacity", 0.5),
        selectedColor: visualColor(draft, "kSelected", "red"),
      });
      paintNoteLabel(ctx, col, y, label, {
        height,
        font: visualFont(draft, "kFont", "10px monospace"),
        shiftX: visualNumber(
          draft,
          flags.long ? "kLabelHShiftL" : "kLabelHShift",
          0,
        ),
        shiftY: visualNumber(draft, "kLabelVShift", 0),
      });
      ctx.globalAlpha = 1;
    };
    note(cols[0], 82, {}, "01");
    note(cols[0], 142, { selected: true }, "02");
    if (width > 0) {
      ctx.fillStyle = noteColor(style.LongNoteColor);
      ctx.fillRect(
        cols[1].left + 2,
        62,
        Math.max(0, width - 4),
        Math.max(0, 140 - 62 - height),
      );
    }
    note(cols[1], 62, { long: true }, "03");
    note(cols[1], 140, { long: true }, "03");
    note(cols[2], 102, { hidden: true }, "04");
    ctx.restore();
  }
  return {
    load(theme) {
      draft = createThemeDraft(theme);
      columnIndex = Math.min(columnIndex, draft.columns.length - 1);
      fill();
      render();
      onError?.(null);
    },
    read,
    render,
  };
}
