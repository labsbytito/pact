import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleRequest } from "../lib/request-text";

test("the review keeps one safety line", () => {
  const both =
    "Research the official visiting information for this page. Do not contact anyone, book anything, or spend money. Do not book, contact, pay, or commit.";
  const shown = visibleRequest(both);
  assert.match(shown, /visiting information/);
  assert.match(shown, /Do not contact anyone, book anything, or spend money\./);
  assert.equal(shown.match(/Do not /g)?.length, 1);
  assert.equal(
    visibleRequest("Look up the hours. Do not book, contact, pay, or commit."),
    "Look up the hours. Do not book, contact, pay, or commit.",
  );
  assert.equal(visibleRequest("Look up the hours."), "Look up the hours.");
});
