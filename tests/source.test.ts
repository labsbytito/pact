import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceSchema } from "../server/source";

test("request validation preserves the selected item, viewport and capture freshness", () => {
  const input = {
    title: "A long page",
    url: "https://example.com/page",
    description: "",
    text: "Visible on screen: CEDAR-482",
    selection: "CEDAR-482",
    capturedAt: "2026-10-18T19:00:00Z",
    captureMode: "picked",
    viewportText: "CEDAR-482",
    selectionContext: "The beginner workshop",
    selectionLabel: "article",
    pageTextPartial: true,
    transcript: [],
    transcriptStatus: "not-video",
    tabId: 99,
    windowId: 12,
  };
  const parsed = sourceSchema.parse(input);
  assert.equal(parsed.viewportText, input.viewportText);
  assert.equal(parsed.selectionContext, input.selectionContext);
  assert.equal(parsed.capturedAt, input.capturedAt);
  assert.equal(parsed.captureMode, "picked");
  assert.equal(parsed.pageTextPartial, true);
  assert.ok(!("tabId" in parsed));
  assert.ok(!("windowId" in parsed));
});
