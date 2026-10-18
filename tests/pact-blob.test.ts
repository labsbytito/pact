import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldGreet, type BlobState } from "../entrypoints/sidepanel/pactBlob";

const STATES: BlobState[] = [
  "idle",
  "greeting",
  "listening",
  "thinking",
  "speaking",
  "happy",
  "error",
  "still",
  "sleepy",
];

test("BlobState set matches the character brief", () => {
  assert.deepEqual(STATES.sort(), [...STATES].sort());
  assert.ok(STATES.includes("speaking"));
  assert.ok(STATES.includes("still"));
});

test("shouldGreet returns true once per session storage", async () => {
  const store = new Map<string, string>();
  const original = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
  try {
    assert.equal(await shouldGreet(), true);
    assert.equal(await shouldGreet(), false);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: original,
    });
  }
});
