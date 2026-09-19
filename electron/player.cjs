function playerArguments(template, values) {
  if (typeof template !== "string" || template.length > 4096)
    throw Error("播放器参数过长");
  const tokens = [];
  let token = "",
    quoted = false,
    started = false;
  for (const char of template) {
    if (char === '"') {
      quoted = !quoted;
      started = true;
    } else if (/\s/.test(char) && !quoted) {
      if (started) {
        tokens.push(token);
        token = "";
        started = false;
      }
    } else {
      token += char;
      started = true;
    }
  }
  if (quoted) throw Error("播放器参数的引号未闭合");
  if (started) tokens.push(token);
  return tokens.map((t) =>
    t.replace(/<(filename|measure|apppath)>/g, (_, key) => String(values[key])),
  );
}
module.exports = { playerArguments };
