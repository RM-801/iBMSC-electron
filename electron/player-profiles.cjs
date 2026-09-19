const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { atomicWrite } = require("./files.cjs");
const { playerArguments } = require("./player.cjs");
const defaults = {
  begin: '-P -N0 "<filename>"',
  here: '-P -N<measure> "<filename>"',
  stop: "-S",
};
class PlayerProfiles {
  constructor(filename) {
    this.filename = filename;
    this.state = { current: null, players: [] };
    this.queue = Promise.resolve();
  }
  snapshot() {
    return structuredClone(this.state);
  }
  get(id = this.state.current) {
    const player = this.state.players.find((p) => p.id === id);
    if (!player) throw Error("请先选择播放器程序");
    return structuredClone(player);
  }
  async load() {
    try {
      const state = JSON.parse(await fs.readFile(this.filename, "utf8"));
      if (!Array.isArray(state.players) || state.players.length > 128)
        throw Error("播放器配置格式无效");
      const ids = new Set();
      for (const p of state.players) {
        if (
          !p ||
          typeof p.id !== "string" ||
          ids.has(p.id) ||
          typeof p.path !== "string" ||
          (!path.isAbsolute(p.path) && !path.win32.isAbsolute(p.path)) ||
          p.path.includes("\0")
        )
          throw Error("播放器配置无效");
        ids.add(p.id);
        this.validate(p);
      }
      if (state.current !== null && !ids.has(state.current))
        throw Error("当前播放器无效");
      this.state = state;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  validate(templates) {
    for (const key of Object.keys(defaults))
      playerArguments(templates[key], {
        filename: "chart.bms",
        measure: 0,
        apppath: ".",
      });
  }
  persist() {
    const bytes = Buffer.from(JSON.stringify(this.state));
    this.queue = this.queue
      .catch(() => {})
      .then(() => atomicWrite(this.filename, bytes));
    return this.queue.then(() => this.snapshot());
  }
  async choose(executable, id = null) {
    if (
      typeof executable !== "string" ||
      !path.isAbsolute(executable) ||
      executable.includes("\0")
    )
      throw Error("播放器路径无效");
    if (id !== null) {
      this.get(id);
      this.state.players.find((p) => p.id === id).path = executable;
    } else {
      if (this.state.players.length >= 128) throw Error("播放器数量过多");
      id = randomUUID();
      this.state.players.push({ id, path: executable, ...defaults });
    }
    this.state.current = id;
    return this.persist();
  }
  async importSettings(settings) {
    if (
      !settings ||
      !Array.isArray(settings.players) ||
      settings.players.length > 128
    )
      throw Error("播放器导入数据无效");
    const next = structuredClone(this.state),
      mapped = new Map();
    for (const p of settings.players) {
      if (
        typeof p.path !== "string" ||
        p.path.includes("\0") ||
        (!path.isAbsolute(p.path) && !path.win32.isAbsolute(p.path)) ||
        !Number.isInteger(p.index)
      )
        throw Error("导入播放器路径或索引无效");
      this.validate(p);
      let item = next.players.find((item) => item.path === p.path);
      if (!item) {
        item = { id: randomUUID(), path: p.path };
        next.players.push(item);
      }
      for (const key of Object.keys(defaults)) item[key] = p[key];
      mapped.set(p.index, item.id);
    }
    if (next.players.length > 128) throw Error("播放器数量过多");
    next.current = mapped.get(settings.current) || next.current;
    this.state = next;
    return this.persist();
  }
  async update(id, templates) {
    this.get(id);
    this.validate(templates);
    const p = this.state.players.find((p) => p.id === id);
    for (const key of Object.keys(defaults)) p[key] = templates[key];
    return this.persist();
  }
  async select(id) {
    this.get(id);
    this.state.current = id;
    return this.persist();
  }
  async remove(id) {
    this.get(id);
    const index = this.state.players.findIndex((p) => p.id === id);
    this.state.players.splice(index, 1);
    if (this.state.current === id)
      this.state.current =
        this.state.players[Math.min(index, this.state.players.length - 1)]
          ?.id ?? null;
    return this.persist();
  }
}
module.exports = { PlayerProfiles, defaults };
