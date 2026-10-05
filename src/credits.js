const contributors = "hitkey、Nekokan、MusicGameLAB、Freefire、the DtTvB、Wen-DB、BJmz、BombTrack、C.R.S、enderdz、复仇天神、ILSPQ、獠牙、L.-S.P.、Origin (Fantasy_Date)、Rogue、银羽のK’";
export const creditsRows = [
  { source: "iBMSC 跨平台谱面编辑器" },
  { source: "" },
  { source: "原作：{0}", values: ["iBMS / iBMS.[4th Age]"] },
  { source: "Copyright (C) iBMS.[4th Age]" },
  { source: "移植与维护：{0}", values: ["SeaRay"] },
  { source: "" },
  { source: "原作贡献者" },
  { source: "{0}", values: [contributors] },
  { source: "" },
  { source: "项目：{0}", values: ["https://github.com/RM-801/ibmsc-node"] },
];
export const creditsText = creditsRows.map(row => row.source.replace(/\{(\d+)\}/g, (_, i) => row.values?.[i] ?? "")).join("\n");
