import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consequentialToolsEnabled,
  decideTool,
  toolSendBlock,
} from "../backend/lib/fo-policy";

test("ask_fo and read-only tools are allowed; calls and unknown tools are not", () => {
  for (const name of [
    "ask_fo",
    "get_fo_reply",
    "get_fo_conversation",
    "list_fo_conversations",
  ]) {
    assert.equal(decideTool(name, false), "allow");
    assert.equal(toolSendBlock(name, false, false), undefined);
    assert.equal(toolSendBlock(name, undefined, true), undefined);
  }
  for (const name of ["start_fo_call", "send_email", "book_table", "get_", "GET_FO"]) {
    assert.equal(decideTool(name, false), "deny");
    assert.match(toolSendBlock(name, true, false)!, /not sent/);
    assert.equal(decideTool(name, true), "confirm");
    assert.match(toolSendBlock(name, false, true)!, /separate confirmation/);
    assert.match(toolSendBlock(name, undefined, true)!, /not sent/);
    assert.equal(toolSendBlock(name, true, true), undefined);
  }
});

test("consequential tools stay off unless the setting is exactly 1", () => {
  assert.equal(consequentialToolsEnabled({}), false);
  assert.equal(consequentialToolsEnabled({ PACT_FO_CONSEQUENTIAL: "true" }), false);
  assert.equal(consequentialToolsEnabled({ PACT_FO_CONSEQUENTIAL: "yes" }), false);
  assert.equal(consequentialToolsEnabled({ PACT_FO_CONSEQUENTIAL: "1" }), true);
});
