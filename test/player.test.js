import { test } from "node:test";
import assert from "node:assert/strict";
import player from "../electron/player.cjs";
test("player placeholders are expanded after tokenization and never interpreted by a shell", () => {
  const filename = '/chart/a "quoted" $(touch malicious).bms';
  assert.deepEqual(
    player.playerArguments('-P -N<measure> "<filename>"', {
      filename,
      measure: 42,
      apppath: "/app",
    }),
    ["-P", "-N42", filename],
  );
  assert.throws(() => player.playerArguments('"bad', {}));
});
