import test from "node:test";
import assert from "node:assert/strict";
import association from "../electron/file-association.cjs";

const executable = "C:\\Portable apps\\音符 & tools\\iBMSC-0.1.27.exe";
const options = {
  platform: "win32",
  isPackaged: true,
  execPath: "C:\\Temp\\portable-unpacked\\iBMSC.exe",
  env: { PORTABLE_EXECUTABLE_FILE: executable, SystemRoot: "C:\\Windows" },
};

test("all five file association plans use the durable portable EXE and only offer per-user handlers", () => {
  assert.deepEqual(association.extensions, [
    ".bms",
    ".bme",
    ".bml",
    ".pms",
    ".ibmsc",
  ]);
  for (const extension of association.extensions) {
    const plan = association.associationPlan(extension.toUpperCase(), options);
    assert.equal(plan.executable, executable);
    assert.equal(plan.extension, extension);
    assert.equal(
      plan.entries.find(([key]) => key.endsWith("\\shell\\open\\command"))[2],
      `"${executable}" "%1"`,
    );
    assert.ok(
      plan.entries.some(
        ([key, name]) =>
          key.endsWith(extension + "\\OpenWithProgids") &&
          name.endsWith(extension.slice(1).toUpperCase()),
      ),
    );
    for (const [key] of plan.entries) {
      assert.ok(key.startsWith("HKCU\\Software\\"));
      assert.doesNotMatch(key, /UserChoice|Explorer\\FileExts|HKLM|HKCR/i);
      assert.notEqual(key, "HKCU\\Software\\Classes\\" + extension);
    }
    assert.doesNotMatch(JSON.stringify(plan.entries), /portable-unpacked/);
  }
  assert.equal(
    association.associationPlan(".bms", {
      ...options,
      env: {},
      execPath: executable,
    }).executable,
    executable,
  );
});

test("association registration executes only on explicit calls, using argument arrays without a shell", async () => {
  const calls = [],
    opened = [],
    inspected = [];
  const injected = {
    ...options,
    stat: async (value) => {
      inspected.push(value);
      return { isFile: () => true };
    },
    run: async (...args) => calls.push(args),
    openExternal: async (url) => opened.push(url),
  };
  association.associationPlan(".pms", injected);
  assert.equal(calls.length, 0);
  assert.equal(inspected.length, 0);
  const result = await association.associateFile(".pms", injected);
  assert.deepEqual(result, {
    extension: ".pms",
    registered: true,
    settingsOpened: true,
  });
  assert.deepEqual(inspected, [executable]);
  assert.deepEqual(opened, ["ms-settings:defaultapps"]);
  assert.equal(calls.length, 10);
  for (const [command, args, spawn] of calls) {
    assert.equal(command, "C:\\Windows\\System32\\reg.exe");
    assert.equal(args[0], "add");
    assert.equal(args.at(-1), "/f");
    assert.equal(args[args.indexOf("/t") + 1], "REG_SZ");
    assert.deepEqual(spawn, { windowsHide: true, shell: false });
  }
  const openCommand = calls.find(([, args]) =>
    args[1].endsWith("\\shell\\open\\command"),
  )[1];
  assert.equal(
    openCommand[openCommand.indexOf("/d") + 1],
    `"${executable}" "%1"`,
  );
});

test("unsupported platforms, unpackaged apps and malformed association requests cannot write registry values", async () => {
  let calls = 0;
  const injected = {
    ...options,
    run: async () => {
      calls++;
    },
    stat: async () => {
      calls++;
    },
    openExternal: async () => {
      calls++;
    },
  };
  for (const [extension, overrides] of [
    [".cmd", {}],
    [".bms\\shell", {}],
    [null, {}],
    [".bms", { platform: "darwin" }],
    [".bms", { isPackaged: false }],
    [".bms", { env: { PORTABLE_EXECUTABLE_FILE: "relative.exe" } }],
    [".bms", { env: { PORTABLE_EXECUTABLE_FILE: "\\relative.exe" } }],
    [".bms", { env: { PORTABLE_EXECUTABLE_FILE: 'C:\\bad"name.exe' } }],
    [".bms", { env: { PORTABLE_EXECUTABLE_FILE: "C:\\bad\0name.exe" } }],
  ])
    await assert.rejects(
      association.associateFile(extension, { ...injected, ...overrides }),
    );
  assert.equal(calls, 0);
  await assert.rejects(
    association.associateFile(".bms", {
      ...injected,
      stat: async () => ({ isFile: () => false }),
    }),
    /应用程序路径/,
  );
  assert.equal(calls, 0);
});

test("registry failures do not open Settings or claim success, and Settings failure reports partial completion", async () => {
  let writes = 0,
    opens = 0;
  const injected = {
    ...options,
    stat: async () => ({ isFile: () => true }),
    run: async () => {
      if (++writes === 3) throw Error("Access denied");
    },
    openExternal: async () => {
      opens++;
    },
  };
  await assert.rejects(
    association.associateFile(".bml", injected),
    /Access denied/,
  );
  assert.equal(writes, 3);
  assert.equal(opens, 0);
  const result = await association.associateFile(".ibmsc", {
    ...injected,
    run: async () => {},
    openExternal: async () => {
      throw Error("Settings unavailable");
    },
  });
  assert.deepEqual(result, {
    extension: ".ibmsc",
    registered: true,
    settingsOpened: false,
    warning: "Settings unavailable",
  });
});
