const path = require("node:path");
const fs = require("node:fs/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const extensions = Object.freeze([".bms", ".bme", ".bml", ".pms", ".ibmsc"]);
const applicationName = "iBMSC.Node";
const capabilitiesKey = "Software\\iBMSC.Node\\Capabilities";
const defaultAppsURL = "ms-settings:defaultapps";

function associationPlan(extension, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") throw Error("当前平台不支持文件关联");
  if (!options.isPackaged)
    throw Error("请使用打包后的 Windows 版本设置文件关联");
  const normalized =
    typeof extension === "string" ? extension.toLowerCase() : "";
  if (!extensions.includes(normalized)) throw Error("不支持的文件关联类型");
  const env = options.env ?? process.env;
  // electron-builder's portable launcher sets this to the durable outer EXE.
  // process.execPath points into its temporary extraction directory instead.
  const executable =
    env.PORTABLE_EXECUTABLE_FILE || options.execPath || process.execPath;
  if (
    typeof executable !== "string" ||
    /[\x00-\x1f"]/.test(executable) ||
    !path.win32.isAbsolute(executable) ||
    !/^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+\\)/.test(executable) ||
    !/\.exe$/i.test(executable)
  )
    throw Error("无法确定应用程序路径");
  const programId = applicationName + "." + normalized.slice(1).toUpperCase();
  const programKey = "HKCU\\Software\\Classes\\" + programId;
  const entries = [
    [
      programKey,
      null,
      normalized === ".ibmsc"
        ? "iBMSC project"
        : normalized.slice(1).toUpperCase() + " chart",
    ],
    [programKey + "\\DefaultIcon", null, `"${executable}",0`],
    [programKey + "\\shell\\open", null, "Open with iBMSC"],
    [programKey + "\\shell\\open\\command", null, `"${executable}" "%1"`],
    [
      "HKCU\\Software\\Classes\\" + normalized + "\\OpenWithProgids",
      programId,
      "",
    ],
    ["HKCU\\" + capabilitiesKey, "ApplicationName", "iBMSC"],
    ["HKCU\\" + capabilitiesKey, "ApplicationDescription", "BMS chart editor"],
    ["HKCU\\" + capabilitiesKey, "ApplicationIcon", `"${executable}",0`],
    ["HKCU\\" + capabilitiesKey + "\\FileAssociations", normalized, programId],
    [
      "HKCU\\Software\\RegisteredApplications",
      applicationName,
      capabilitiesKey,
    ],
  ];
  return { extension: normalized, executable, entries };
}

// Merely importing this module, starting the app or building a package never
// executes this function. Its only production caller is the explicit UI IPC.
async function associateFile(extension, options = {}) {
  const plan = associationPlan(extension, options);
  const stat = await (options.stat || fs.stat)(plan.executable);
  if (!stat.isFile()) throw Error("无法确定应用程序路径");
  const env = options.env ?? process.env;
  const registry = path.win32.join(
    env.SystemRoot || env.WINDIR || "C:\\Windows",
    "System32",
    "reg.exe",
  );
  const run = options.run || promisify(execFile);
  for (const [key, name, value] of plan.entries) {
    await run(
      registry,
      [
        "add",
        key,
        ...(name === null ? ["/ve"] : ["/v", name]),
        "/t",
        "REG_SZ",
        "/d",
        value,
        "/f",
      ],
      { windowsHide: true, shell: false },
    );
  }
  // Registration offers the app as a choice. UserChoice and existing extension
  // defaults are deliberately untouched; Windows Settings owns that decision.
  try {
    await options.openExternal(defaultAppsURL);
    return {
      extension: plan.extension,
      registered: true,
      settingsOpened: true,
    };
  } catch (error) {
    return {
      extension: plan.extension,
      registered: true,
      settingsOpened: false,
      warning: error.message,
    };
  }
}

module.exports = { extensions, associationPlan, associateFile, defaultAppsURL };
