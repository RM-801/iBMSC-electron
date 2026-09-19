export function readPlayerSettings(doc) {
  const parent = [...doc.documentElement.children].find(
    (e) => e.tagName === "Player",
  );
  if (!parent) return null;
  const players = [...parent.children]
    .filter((e) => e.tagName === "Player")
    .map((e) => ({
      index: Number(e.getAttribute("Index")),
      path: e.getAttribute("Path"),
      begin: e.getAttribute("FromBeginning"),
      here: e.getAttribute("FromHere"),
      stop: e.getAttribute("Stop"),
    }))
    .sort((a, b) => a.index - b.index);
  if (
    players.length > 128 ||
    players.some((p) => !Number.isInteger(p.index) || p.index < 0 || !p.path) ||
    new Set(players.map((p) => p.index)).size !== players.length
  )
    throw Error("播放器 XML 无效");
  return {
    players,
    current: Number(parent.getAttribute("CurrentPlayer") || 0),
  };
}
export function writePlayerSettings(doc, state) {
  let parent = [...doc.documentElement.children].find(
    (e) => e.tagName === "Player",
  );
  if (!parent) {
    parent = doc.createElement("Player");
    doc.documentElement.appendChild(parent);
  }
  const old = [...parent.children].filter((e) => e.tagName === "Player");
  for (const node of old) parent.removeChild(node);
  parent.setAttribute("Count", String(state.players.length));
  parent.setAttribute(
    "CurrentPlayer",
    String(
      Math.max(
        0,
        state.players.findIndex((p) => p.id === state.current),
      ),
    ),
  );
  state.players.forEach((p, index) => {
    const node =
      old.find((e) => e.getAttribute("Path") === p.path) ||
      doc.createElement("Player");
    for (const [key, value] of Object.entries({
      Index: index,
      Path: p.path,
      FromBeginning: p.begin,
      FromHere: p.here,
      Stop: p.stop,
    }))
      node.setAttribute(key, String(value));
    parent.appendChild(node);
  });
  return doc;
}
