import { test, before } from "node:test";
import assert from "node:assert/strict";
import { read, write, readSync, writeSync } from "../lib/storage";

before(() => {
  const store = new Map<string, string>();
  const memory = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memory,
    configurable: true,
  });
});

test("local read/write round-trips through localStorage in Node", async () => {
  localStorage.clear();
  await write("demo", { ok: true, n: 3 });
  assert.deepEqual(await read("demo", null), { ok: true, n: 3 });
  assert.equal(await read("missing", "fallback"), "fallback");
});

test("sync helpers fall back to localStorage when chrome.storage is absent", async () => {
  localStorage.clear();
  await writeSync("companion", { shape: 2, color: "#007AFF" });
  assert.deepEqual(await readSync("companion", null), {
    shape: 2,
    color: "#007AFF",
  });
  assert.deepEqual(await readSync("absent", { shape: 0, color: "#8E8E93" }), {
    shape: 0,
    color: "#8E8E93",
  });
});
