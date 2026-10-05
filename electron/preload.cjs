const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  nativeMenu: process.platform === "darwin",
  nativePlatform: process.platform,
  systemLanguages: () => ipcRenderer.invoke("app:languages"),
  capabilities: { fileAssociation: process.platform === "win32", beep: true },
  beep: () => ipcRenderer.invoke("app:beep"),
  associateFile: (extension) =>
    ipcRenderer.invoke("app:associateFile", extension),
  openRequestedFile: (token) => ipcRenderer.invoke("file:openRequested", token),
  onOpenFile: (callback) => {
    const listener = (_event, token) => {
      // Wait for the renderer's discard/parse/accept flow before delivering the
      // next request. Canceling before requesting bytes also consumes the token.
      Promise.resolve()
        .then(() => callback(token))
        .catch(() => {})
        .finally(() =>
          ipcRenderer.invoke("file:finishOpenRequest", token).catch(() => {}),
        );
    };
    ipcRenderer.on("file:openRequested", listener);
    ipcRenderer.invoke("file:readyForOpen").catch(() => {});
    return () => ipcRenderer.removeListener("file:openRequested", listener);
  },
  onMenuAction: (callback) => {
    const listener = (_event, action, payload) => callback(action, payload);
    ipcRenderer.on("menu:action", listener);
    return () => ipcRenderer.removeListener("menu:action", listener);
  },
  updateMenuState: (state) => ipcRenderer.invoke("menu:state", state),
  editText: (action) => ipcRenderer.invoke("menu:edit", action),
  acceptOpen: (token) => ipcRenderer.invoke("file:accept", token),
  cancelOpen: (token) => ipcRenderer.invoke("file:cancelOpen", token),
  recent: () => ipcRenderer.invoke("file:recent"),
  openRecent: (filename) => ipcRenderer.invoke("file:openRecent", filename),
  newFile: () => ipcRenderer.invoke("file:new"),
  openDropped: (file) =>
    ipcRenderer.invoke("file:openDropped", webUtils.getPathForFile(file)),
  dropSounds: (files) =>
    ipcRenderer.invoke(
      "file:dropSounds",
      files.map((file) => webUtils.getPathForFile(file)),
    ),
  open: (kind) => ipcRenderer.invoke("file:open", kind),
  website: () => ipcRenderer.invoke("app:website"),
  save: (request) => ipcRenderer.invoke("file:save", request),
  chooseSounds: (multiple) => ipcRenderer.invoke("file:chooseSounds", multiple),
  asset: (name) => ipcRenderer.invoke("file:asset", name),
  recover: () => ipcRenderer.invoke("file:recover"),
  autosave: (text) => ipcRenderer.invoke("file:autosave", text),
});
