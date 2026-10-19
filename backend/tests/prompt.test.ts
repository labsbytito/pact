import assert from "node:assert/strict";
import test from "node:test";
import { streamSystemPrompt } from "../lib/interpret-prompt";

test("short responses tell the model to stay within about three sentences", () => {
  const prompt = streamSystemPrompt([], null, "short");
  assert.match(prompt, /at most about 3 sentences/);
});
