import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesForBypass, userAskedToAct } from "../lib/intent";

test("a plan, a question, or a negation stays a suggestion", () => {
  assert.equal(userAskedToAct("Plan a short visit to this museum"), false);
  assert.equal(userAskedToAct("What should we do with this page?"), false);
  assert.equal(userAskedToAct("How do I get there?"), false);
  assert.equal(userAskedToAct("Should I book this?"), false);
  assert.equal(userAskedToAct("Don't send this yet"), false);
  assert.equal(userAskedToAct("Never book anything"), false);
  assert.equal(userAskedToAct("Can you book a table for 8?"), false);
  assert.equal(userAskedToAct("Who should I schedule with?"), false);
  assert.equal(userAskedToAct("Ask Fo to send me the museum's opening hours"), false);
  assert.equal(userAskedToAct("send this"), false);
  assert.equal(userAskedToAct("do this"), false);
  assert.equal(userAskedToAct("Please book a table"), false);
  assert.equal(userAskedToAct(""), false);
});

test("research and connect asks can skip a second approval", () => {
  assert.equal(userAskedToAct("Find the museum's opening hours"), true);
  assert.equal(userAskedToAct("Look up the museum's opening hours"), true);
  assert.equal(userAskedToAct("Check the hours"), true);
  assert.equal(userAskedToAct("set up my Gmail"), true);
  assert.equal(userAskedToAct("Connect my Gmail"), true);
  assert.equal(userAskedToAct("connect my calendar"), true);
  assert.equal(userAskedToAct("Connect my Google Calendar"), true);
  assert.equal(userAskedToAct("disconnect Fo"), true);
});

test("bypass requires the user's own words, and send never qualifies", () => {
  const latest = "Find the museum's opening hours";
  assert.equal(
    qualifiesForBypass({ latest, toolName: "ask_fo", message: latest }),
    true,
  );
  assert.equal(
    qualifiesForBypass({ latest, toolName: "ask_fo", message: "Find the hours and email them" }),
    false,
  );
  assert.equal(
    qualifiesForBypass({ latest, toolName: "ask_fo", message: latest, askBefore: "always" }),
    false,
  );
  assert.equal(
    qualifiesForBypass({ latest, toolName: "ask_fo", message: latest, consequential: true }),
    false,
  );
  assert.equal(
    qualifiesForBypass({
      latest: "Ask Fo to send me the museum's opening hours",
      toolName: "ask_fo",
      message: "Ask Fo to send me the museum's opening hours",
    }),
    false,
  );
});
