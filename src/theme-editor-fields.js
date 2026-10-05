export const columnColors = [
  ["NoteColor", "音符"],
  ["TextColor", "音符文字"],
  ["LongNoteColor", "长音符"],
  ["LongTextColor", "长音符文字"],
  ["BG", "轨道背景"],
];

export const visualColors = [
  ["ColumnTitle", "轨道标题"],
  ["Bg", "工作区背景"],
  ["Grid", "主格线"],
  ["Sub", "副格线"],
  ["VLine", "轨道分隔线"],
  ["MLine", "小节线"],
  ["BGMWav", "BGM 波形"],
  ["SelBox", "框选边框"],
  ["TSCursor", "时间选择边框"],
  ["TSHalf", "时间选择中线"],
  ["TSSel", "时间选择背景"],
  ["kSelected", "选中音符"],
  ["kMouseOver", "音符悬停"],
  ["kMouseOverE", "调整长度边框"],
  ["kError", "错误音符"],
];

export const themeFonts = [
  ["ColumnTitleFont", "轨道标题字体"],
  ["kFont", "音符字体"],
  ["kMFont", "小节字体"],
];

export const themeNumbers = [
  ["kHeight", "音符高度", 1, 100, 1],
  ["kLabelVShift", "文字垂直偏移", -999, 999, 1],
  ["kLabelHShift", "文字水平偏移", -999, 999, 1],
  ["kLabelHShiftL", "长音符文字水平偏移", -999, 999, 1],
  ["kOpacity", "隐藏音符不透明度", 0, 1, 0.05],
];

// Shared with localization checks so new controls cannot silently miss a label.
export const themeEditorLabels = [
  "轨道",
  "颜色",
  "字体和音符",
  "标题",
  "宽度",
  "不透明度",
  "字体",
  "大小",
  "粗体",
  "斜体",
  "预览",
  ...columnColors.map(([, label]) => label),
  ...visualColors.map(([, label]) => label),
  ...themeFonts.map(([, label]) => label),
  ...themeNumbers.map(([, label]) => label),
];
