import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const { PlayerProfiles, defaults } = createRequire(import.meta.url)(
  "../electron/player-profiles.cjs",
);
test("multiple players retain independent templates, selection and removal across restart", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ibmsc-players-"));
  try {
    const filename = path.join(dir, "players.json");
    const profiles = new PlayerProfiles(filename);
    await profiles.load();
    assert.deepEqual(profiles.snapshot(), { current: null, players: [] });
    await profiles.choose(path.join(dir, "one.exe"));
    const first = profiles.get().id;
    await profiles.update(first, {
      ...defaults,
      here: '-seek <measure> "<filename>"',
    });
    await profiles.choose(path.join(dir, "two.app"));
    const second = profiles.get().id;
    assert.equal(profiles.get().here, defaults.here);
    await profiles.select(first);
    const reloaded = new PlayerProfiles(filename);
    await reloaded.load();
    assert.equal(reloaded.get().id, first);
    assert.equal(reloaded.get().here, '-seek <measure> "<filename>"');
    const unchanged = reloaded.snapshot();
    await assert.rejects(
      reloaded.update(first, { ...defaults, begin: '"unclosed' }),
    );
    await assert.rejects(reloaded.select("unknown"));
    await assert.rejects(reloaded.choose("relative.exe"));
    assert.deepEqual(reloaded.snapshot(), unchanged);
    await reloaded.choose(path.join(dir, "new.exe"), first);
    assert.equal(reloaded.get().here, unchanged.players[0].here);
    await reloaded.remove(first);
    assert.equal(reloaded.get().id, second);
    await reloaded.remove(second);
    assert.deepEqual(reloaded.snapshot(), { current: null, players: [] });
    assert.throws(() => reloaded.get());
    await writeFile(
      filename,
      JSON.stringify({ current: "missing", players: [] }),
    );
    await assert.rejects(reloaded.load());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('XML player imports merge by path and retain foreign paths without launching them', async () => {
 const dir=await mkdtemp(path.join(tmpdir(),'ibmsc-playerxml-'));
 try {
  const p=new PlayerProfiles(path.join(dir,'profiles.json'));
  await p.choose('/Applications/Test.app');
  const settings={current:4,players:[{index:4,path:'C:\\BMS\\player.exe',...defaults}]};
  await p.importSettings(settings);
  assert.equal(p.snapshot().players.length,2);
  assert.equal(p.get().path,'C:\\BMS\\player.exe');
  await p.importSettings(settings); assert.equal(p.snapshot().players.length,2);
  const reload=new PlayerProfiles(p.filename); await reload.load();
  assert.equal(reload.get().path,'C:\\BMS\\player.exe');
  const before=p.snapshot();
  await assert.rejects(p.importSettings({players:[{index:0,path:'relative',...defaults}]}));
  assert.deepEqual(p.snapshot(),before);
 } finally { await rm(dir,{recursive:true,force:true}); }
});
