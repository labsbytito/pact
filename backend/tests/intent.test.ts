import assert from "node:assert/strict";
import test from "node:test";
import { userAskedToAct } from "../lib/intent";

test("a plan stays a suggestion", () => {
  assert.equal(userAskedToAct("Plan a short visit to this museum"), false);
  assert.equal(userAskedToAct("What should we do with this page?"), false);
  assert.equal(userAskedToAct("How do I get there?"), false);
  assert.equal(userAskedToAct("Should I book this?"), false);
  assert.equal(userAskedToAct(""), false);
});

test("an explicit ask runs without a second approval", () => {
  assert.equal(userAskedToAct("set up my Gmail"), true);
  assert.equal(userAskedToAct("Connect my Gmail"), true);
  assert.equal(userAskedToAct("connect my calendar"), true);
  assert.equal(userAskedToAct("Connect my Google Calendar"), true);
  assert.equal(userAskedToAct("send this"), true);
  assert.equal(userAskedToAct("do this"), true);
  assert.equal(userAskedToAct("Please book a table"), true);
});
