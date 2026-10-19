import assert from "node:assert/strict";
import test from "node:test";
import { autoApprove, normalizeSettings } from "../lib/settings";

test("unset, pact, and character accents become teal", () => {
  assert.equal(normalizeSettings(null).accent, "teal");
  assert.equal(normalizeSettings({ onboarded: true, accent: "pact" }).accent, "teal");
  assert.equal(normalizeSettings({ onboarded: true, accent: "character" }).accent, "teal");
  assert.equal(normalizeSettings({ onboarded: true, accent: "blue" }).accent, "blue");
  assert.equal(normalizeSettings({ onboarded: true, accent: "violet" }).accent, "violet");
  assert.equal(normalizeSettings({ onboarded: true, accent: "black" }).accent, "black");
});

test("retired companion colours become amber and old shapes migrate once", () => {
  const migrated = normalizeSettings({
    onboarded: true,
    companion: { shape: 6, color: "#6366F1" },
  });
  assert.equal(migrated.companion?.color, "#F59E0B");
  assert.equal(migrated.companion?.shape, 0);
  assert.equal(migrated.companion?.v, 2);
  const kept = normalizeSettings({
    onboarded: true,
    companion: { shape: 7, color: "#3B82F6", v: 2 },
  });
  assert.equal(kept.companion?.shape, 7);
  assert.equal(kept.companion?.color, "#3B82F6");
});

test("behavior defaults and ask-before gating", () => {
  const settings = normalizeSettings({ onboarded: true });
  assert.equal(settings.responseStyle, "detailed");
  assert.equal(settings.askBefore, "suggested");
  assert.equal(settings.sendWithEnter, true);
  assert.equal(settings.textSize, "default");
  assert.equal(normalizeSettings({ onboarded: true, responseStyle: "short", askBefore: "always", sendWithEnter: false, textSize: "large" }).responseStyle, "short");
  assert.equal(autoApprove(true, "suggested", false), true);
  assert.equal(autoApprove(true, "always", false), false);
  assert.equal(autoApprove(true, "suggested", true), false);
  assert.equal(autoApprove(false, "suggested", false), false);
});
