import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldGreet, type BlobState } from "../lib/pact-blob";

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

import { idleDelay, lookOffset, pickIdle, reactionFor } from "../lib/pact-blob";

test("lookOffset caps reach and reaches further when small", () => {
  assert.ok(Math.abs(lookOffset(1000, 0, 16).x - 6) < 1e-9);
  assert.ok(Math.abs(lookOffset(1000, 0, 96).x - 3.2) < 1e-9);
  assert.deepEqual(lookOffset(0, 0, 20), { x: 0, y: 0 });
});
test("idle delay 8-20s, pickIdle in range", () => {
  assert.equal(idleDelay(0), 8000);
  assert.equal(idleDelay(1), 20000);
  assert.ok(["stretch", "look", "yawn"].includes(pickIdle(0.99)));
});
test("reactionFor", () => {
  assert.equal(reactionFor("speaking", "idle"), "cheer");
  assert.equal(reactionFor("idle", "error"), "worry");
  assert.equal(reactionFor("idle", "idle"), null);
});
