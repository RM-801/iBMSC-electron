const iconv = require("iconv-lite");
function saveBytes(request) {
  if (request?.format === "ibmscx") {
    if (
      typeof request.text !== "string" ||
      Buffer.byteLength(request.text) > 32 * 1024 * 1024
    )
      throw Error("无效移植版工程数据");
    const data = JSON.parse(request.text);
    if (
      data.format !== "ibmsc-node-project" ||
      data.version !== 1 ||
      !Array.isArray(data.chart?.rows)
    )
      throw Error("无效移植版工程数据");
    return Buffer.from(request.text, "utf8");
  }
  if (request?.format === "ibmsc") {
    if (
      !(request.bytes instanceof Uint8Array) ||
      request.bytes.length > 32 * 1024 * 1024 ||
      Buffer.from(request.bytes.subarray(0, 5)).toString("ascii") !== "iBMSC"
    )
      throw Error("无效 iBMSC 工程数据");
    return Buffer.from(request.bytes);
  }
  if (request?.format && !["bms", "pms"].includes(request.format)) throw Error("无效保存格式");
  if (
    typeof request?.text !== "string" ||
    request.text.length > 32 * 1024 * 1024
  )
    throw Error("无效谱面数据");
  const encoding = ["utf8", "shift_jis", "gbk"].includes(request.encoding)
    ? request.encoding
    : "utf8";
  const bytes = iconv.encode(request.text, encoding);
  if (iconv.decode(bytes, encoding) !== request.text)
    throw Error("所选编码无法表示所有字符，请改用 UTF-8");
  return bytes;
}
module.exports = { saveBytes };
