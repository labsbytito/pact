import assert from "node:assert/strict";
import test from "node:test";
import { summarize, toolInfo } from "../components/pact/toolInfo";

test("known tools get plain names and unknown tools fall back honestly", () => {
  assert.equal(toolInfo("ask_fo").name, "Ask Fo");
  assert.equal(toolInfo("send_thing", "Does a thing").can, "Does a thing");
  assert.equal(toolInfo("send_thing").name, "Send thing");
  assert.ok(summarize("a ".repeat(100)).length <= 90);
});
