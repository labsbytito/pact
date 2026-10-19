import { test } from "node:test";
import assert from "node:assert/strict";
import { queryMicPermission } from "../lib/mic";

test("queryMicPermission falls back to unknown outside Chrome", async () => {
  const state = await queryMicPermission();
  assert.equal(state, "unknown");
});
