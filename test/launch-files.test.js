import test from "node:test";
import assert from "node:assert/strict";
import launch from "../electron/launch-files.cjs";

test("packaged and development arguments select supported chart paths without treating flags or URLs as files", () => {
  const options = { platform: "win32", cwd: "C:\\曲目", isPackaged: true };
  assert.deepEqual(
    launch.launchFiles(
      [
        "C:\\iBMSC.exe",
        "one song.BMS",
        "C:\\別の曲\\test.ibmsc",
        "--inspect=bad.bms",
        "https://example.test/bad.bms",
        "image.png",
      ],
      options,
    ),
    ["C:\\曲目\\one song.BMS", "C:\\別の曲\\test.ibmsc"],
  );
  assert.deepEqual(
    launch.launchFiles(["electron", "C:\\app.bms", "song.pms"], {
      ...options,
      isPackaged: false,
    }),
    ["C:\\曲目\\song.pms"],
  );
  assert.deepEqual(
    launch.launchFiles(["iBMSC", "../曲/saved.ibmscx", "notes.sm"], {
      cwd: "/home/editor",
      platform: "darwin",
    }),
    ["/home/曲/saved.ibmscx", "/home/editor/notes.sm"],
  );
});

test("launch requests wait for renderer readiness and finish serially, including cancellation before reading", () => {
  const notices = [];
  let sequence = 0;
  const queue = new launch.FileOpenRequests(
    (token) => notices.push(token),
    () => "request-" + ++sequence,
  );
  queue.add("C:\\one.bms");
  queue.add("C:\\two.pms");
  assert.deepEqual(notices, []);
  queue.setReady(true);
  assert.deepEqual(notices, ["request-1"]);
  queue.finish("unknown");
  assert.deepEqual(notices, ["request-1"]);
  queue.finish("request-1");
  assert.deepEqual(notices, ["request-1", "request-2"]);
  assert.equal(queue.resolve("request-2"), "C:\\two.pms");
  assert.throws(() => queue.resolve("request-1"), /已失效/);
  queue.finish("request-2");
  assert.throws(() => queue.resolve("request-2"), /已失效/);
});

test("renderer reconnect replays an undelivered request before newer ones", () => {
  const notices = [];
  let sequence = 0;
  const queue = new launch.FileOpenRequests(
    (token) => notices.push(token),
    () => "request-" + ++sequence,
  );
  queue.setReady(true);
  queue.add("C:\\one.bms");
  queue.setReady(false);
  queue.add("C:\\two.bme");
  assert.equal(notices.length, 1);
  queue.setReady(true);
  assert.notEqual(notices[0], notices.at(-1));
  queue.finish(notices[0]);
  assert.equal(queue.resolve(notices.at(-1)), "C:\\one.bms");
  queue.finish(notices.at(-1));
  assert.equal(queue.resolve(notices.at(-1)), "C:\\two.bme");
});
