export function classifyDrop(files) {
  const charts = [],
    sounds = [];
  for (const file of files) {
    if (/\.(bms|bme|bml|pms|ibmsc|ibmscx|sm)$/i.test(file.name)) charts.push(file);
    else if (/\.(wav|ogg|mp3)$/i.test(file.name)) sounds.push(file);
    else throw Error("不支持拖入的文件：" + file.name);
  }
  if (charts.length > 1) throw Error("一次只能拖入一份谱面，请分别打开");
  if (charts.length && sounds.length)
    throw Error("请先拖入谱面，再拖入音源；桌面版打开谱面后会自动关联目录音源");
  return { chart: charts[0], sounds };
}
