import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_SEED,
  COLOR_SWATCHES,
  DEFAULT_COMPANION,
  PALETTE,
  SHAPE_OPTIONS,
  SHAPES,
  brandCharacter,
  characterFor,
  companionColorForScheme,
  companionSwatchName,
  normalizeCompanion,
  withCharacterSeeds,
} from "../lib/character";

test("new Pacts avoid repeated silhouettes and colors, and persisted identities survive reload", () => {
  const first = withCharacterSeeds(
    Array.from({ length: 24 }, (_, i) => ({ id: `pact-${i}` })),
  );
  const appearances = first.map((p) => {
    const c = characterFor(p.characterSeed);
    return `${c.shape}:${c.color}`;
  });
  assert.equal(new Set(appearances).size, 24);
  const reloaded = withCharacterSeeds(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(reloaded, first);
  const expanded = withCharacterSeeds([{ id: "new-pact" }, ...first]);
  assert.deepEqual(expanded.slice(1), first);
});

test("characterFor is deterministic for the same seed", () => {
  const a = characterFor("550e8400-e29b-41d4-a716-446655440000");
  const b = characterFor("550e8400-e29b-41d4-a716-446655440000");
  assert.deepEqual(a, b);
});

test("empty seed uses brand default", () => {
  const a = characterFor();
  const b = characterFor("");
  const c = characterFor("   ");
  assert.equal(a.seed, BRAND_SEED);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test("different seeds usually diverge in shape or color", () => {
  const samples = [
    "pact-1",
    "pact-2",
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "11111111-2222-3333-4444-555555555555",
    "deadbeef-dead-beef-dead-beefdeadbeef",
    "00000000-0000-0000-0000-000000000001",
    "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "travel-japan",
    "learn-pottery",
    "call-mom",
  ].map((s) => characterFor(s));
  const keys = new Set(samples.map((c) => `${c.shape}:${c.color}`));
  assert.ok(keys.size >= 6, `expected variety, got ${keys.size}`);
});

test("shapes and palette meet the floor", () => {
  assert.ok(SHAPES.length >= 8);
  assert.ok(PALETTE.length >= 8);
  for (const path of SHAPES) {
    assert.match(path, /^M/);
    assert.match(path, /Z$/i);
  }
});

test("eye geometry stays inside the viewBox", () => {
  for (const seed of ["a", "b", "c", BRAND_SEED, "uuid-ish-1234"]) {
    const { eye } = characterFor(seed);
    assert.ok(eye.width > 0 && eye.height > 0);
    assert.ok(eye.cx > 8 && eye.cx < 64);
    assert.ok(eye.cy > 8 && eye.cy < 64);
    assert.equal(eye.kind, "pill");
    assert.ok(eye.height > eye.width, "vertical pills");
  }
});

test("all shapes are reachable across many seeds", () => {
  const seen = new Set<number>();
  for (let i = 0; i < 400; i++) {
    seen.add(characterFor(`seed-${i}`).shape);
  }
  assert.equal(seen.size, SHAPES.length);
});

test("brandCharacter applies shape and color overrides", () => {
  const appearance = { shape: 7, color: "#3B82F6" };
  const light = brandCharacter(appearance, false);
  const dark = brandCharacter(appearance, true);
  assert.equal(light.shape, 7);
  assert.equal(light.path, SHAPES[7]);
  assert.equal(light.color, "#3B82F6");
  assert.equal(dark.color, "#60A5FA");
  assert.equal(light.seed, BRAND_SEED);
});

test("normalizeCompanion rejects invalid shape and color", () => {
  assert.deepEqual(normalizeCompanion(null), DEFAULT_COMPANION);
  assert.deepEqual(normalizeCompanion({ shape: 99, color: "red" }), {
    shape: DEFAULT_COMPANION.shape,
    color: DEFAULT_COMPANION.color,
  });
  assert.deepEqual(normalizeCompanion({ shape: 4, color: "#EF4444" }), {
    shape: 4,
    color: "#EF4444",
  });
});

test("companion swatches expose names and dark variants", () => {
  assert.ok(SHAPE_OPTIONS.length >= 8);
  assert.ok(COLOR_SWATCHES.length >= 8);
  assert.equal(companionSwatchName("#3B82F6"), "Blue");
  assert.equal(companionColorForScheme("#3B82F6", true), "#60A5FA");
  assert.equal(companionColorForScheme("#ABCDEF", false), "#ABCDEF");
});
