import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const { RecentFiles } = createRequire(import.meta.url)(
  "../electron/recent.cjs",
);
test("recent files persist five most recent distinct paths and reject arbitrary opens", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ibmsc-recent-"));
  try {
    const filename = path.join(directory, "recent.json");
    const recent = new RecentFiles(filename);
    await recent.load();
    const paths = Array.from({ length: 7 }, (_, i) =>
      path.join(directory, `${i}.bms`),
    );
    await Promise.all(paths.map((file) => recent.remember(file)));
    assert.deepEqual(recent.list(), paths.slice(2).reverse());
    await recent.remember(paths[4]);
    assert.deepEqual(recent.list(), [
      paths[4],
      paths[6],
      paths[5],
      paths[3],
      paths[2],
    ]);
    const reloaded = new RecentFiles(filename);
    await reloaded.load();
    assert.deepEqual(reloaded.list(), recent.list());
    assert.equal(reloaded.resolve(paths[4]), paths[4]);
    assert.throws(() => reloaded.resolve(paths[0]));
    reloaded.list().pop();
    assert.equal(reloaded.list().length, 5);
    await writeFile(
      filename,
      JSON.stringify([null, "relative.bms", paths[0], paths[0]]),
    );
    await reloaded.load();
    assert.deepEqual(reloaded.list(), [paths[0]]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
