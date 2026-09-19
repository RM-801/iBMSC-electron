const { contextBridge, ipcRenderer, webUtils } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  nativeMenu: process.platform === "darwin",
  onMenuAction: (callback) => {
    const listener = (_event, action, payload) => callback(action, payload);
    ipcRenderer.on("menu:action", listener);
    return () => ipcRenderer.removeListener("menu:action", listener);
  },
  editText: (action) => ipcRenderer.invoke("menu:edit", action),
  choosePlayer: (id = null) => ipcRenderer.invoke("player:choose", id),
  importPlayers: (settings) => ipcRenderer.invoke("player:import", settings),
  players: () => ipcRenderer.invoke("player:list"),
  updatePlayer: (id, templates) =>
    ipcRenderer.invoke("player:update", id, templates),
  selectPlayer: (id) => ipcRenderer.invoke("player:select", id),
  removePlayer: (id) => ipcRenderer.invoke("player:remove", id),
  runPlayer: (request) => ipcRenderer.invoke("player:run", request),
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
  open: () => ipcRenderer.invoke("file:open"),
  save: (request) => ipcRenderer.invoke("file:save", request),
  chooseSounds: (multiple) => ipcRenderer.invoke("file:chooseSounds", multiple),
  asset: (name) => ipcRenderer.invoke("file:asset", name),
  recover: () => ipcRenderer.invoke("file:recover"),
  autosave: (text) => ipcRenderer.invoke("file:autosave", text),
});
