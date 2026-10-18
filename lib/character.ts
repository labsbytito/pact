/** Deterministic Pact companions from a seed. No deps, no I/O. */

export type CharacterSize = "tiny" | "small" | "normal" | "hero";
export type CharacterState =
  | "idle"
  | "thinking"
  | "working"
  | "happy"
  | "attention";

export type EyeKind = "pill" | "dot";

export type Character = {
  seed: string;
  shape: number;
  path: string;
  color: string;
  tilt: number;
  eye: {
    kind: EyeKind;
    width: number;
    height: number;
    gap: number;
    cx: number;
    cy: number;
    rotate: number;
    lookX: number;
    lookY: number;
  };
};

/** User-chosen brand companion. Drives --accent when applied. */
export type CompanionAppearance = {
  shape: number;
  color: string;
};

/** Brand default when no Pact id is passed. */
export const BRAND_SEED = "pact.brand";

/** Flat, bright fills — no gradients. Used by seed-derived Pact companions. */
export const PALETTE = [
  "#1c1c1e",
  "#2f6f6a",
  "#6b5b95",
  "#e07a3d",
  "#e8a317",
  "#d64b8a",
  "#3b7dd8",
  "#5c5f66",
  "#8b5e3c",
  "#c94c4c",
  "#2a9d8f",
  "#7c3aed",
] as const;

/**
 * Organic closed paths in a 72×72 viewBox.
 * Distinct silhouettes — not a folded coral tile.
 */
export const SHAPES: readonly string[] = [
  // 0 soft circle
  "M36 8C51 8 62 19 62 34C62 49 51 60 36 60C21 60 10 49 10 34C10 19 21 8 36 8Z",
  // 1 cloud / bumpy blob
  "M22 28C18 22 22 14 30 14C33 9 41 8 46 13C54 11 61 17 60 25C66 28 67 38 61 43C62 52 54 58 45 56C40 61 30 60 26 54C17 55 11 47 14 39C10 34 14 27 22 28Z",
  // 2 rounded gumdrop / soft triangle
  "M36 10C42 10 50 18 54 30C58 42 54 56 36 58C18 56 14 42 18 30C22 18 30 10 36 10Z",
  // 3 tilted soft pill
  "M24 16C32 10 48 12 54 22C60 32 56 48 46 54C36 60 20 56 14 46C8 36 16 22 24 16Z",
  // 4 teardrop
  "M36 8C48 18 58 28 58 40C58 52 48 60 36 60C24 60 14 52 14 40C14 28 24 18 36 8Z",
  // 5 wide flattened oval
  "M14 34C14 22 24 14 36 14C48 14 58 22 58 34C58 46 48 56 36 56C24 56 14 46 14 34Z",
  // 6 bean / kidney
  "M20 22C28 12 46 12 52 24C58 36 54 50 42 56C30 62 16 54 14 40C12 28 14 26 20 22Z",
  // 7 asymmetric squircle
  "M18 20C26 10 48 12 54 24C60 36 56 52 42 58C28 64 12 52 14 36C15 28 12 26 18 20Z",
  // 8 soft diamond / kite
  "M36 8C44 18 58 28 58 38C58 50 48 60 36 60C24 60 14 50 14 38C14 28 28 18 36 8Z",
  // 9 peanut / soft hourglass
  "M28 14C38 10 50 16 52 26C54 34 48 38 46 42C50 48 48 58 36 60C24 58 20 48 26 42C24 38 18 34 20 26C22 16 24 15 28 14Z",
];

/** Shapes offered in the companion editor (Watch face pattern). */
export const SHAPE_OPTIONS = [
  { shape: 0, name: "Circle" },
  { shape: 1, name: "Blob" },
  { shape: 2, name: "Gumdrop" },
  { shape: 3, name: "Pill" },
  { shape: 4, name: "Teardrop" },
  { shape: 7, name: "Squircle" },
] as const;

/**
 * Apple system hues for the companion accent picker.
 * `color` is the stored light value; `dark` is used under prefers-color-scheme: dark.
 */
export const COLOR_SWATCHES = [
  { name: "Graphite", color: "#8E8E93", dark: "#98989D" },
  { name: "Blue", color: "#007AFF", dark: "#0A84FF" },
  { name: "Teal", color: "#30B0C7", dark: "#40C8E0" },
  { name: "Green", color: "#34C759", dark: "#30D158" },
  { name: "Yellow", color: "#FFCC00", dark: "#FFD60A" },
  { name: "Orange", color: "#FF9500", dark: "#FF9F0A" },
  { name: "Red", color: "#FF3B30", dark: "#FF453A" },
  { name: "Pink", color: "#FF2D55", dark: "#FF375F" },
  { name: "Purple", color: "#AF52DE", dark: "#BF5AF2" },
] as const;

export const DEFAULT_COMPANION: CompanionAppearance = {
  shape: 0,
  color: COLOR_SWATCHES[0]!.color,
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]!;
}

function mix(h: number, salt: number): number {
  return (Math.imul(h ^ salt, 0x9e3779b9) >>> 0) % 1000;
}

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** Pure: same seed → same character, forever. */
export function characterFor(seed?: string): Character {
  const key = seed && seed.trim() ? seed.trim() : BRAND_SEED;
  const h = hash(key);
  const shape = h % SHAPES.length;
  const color = pick(PALETTE, (h >>> 8) % PALETTE.length);
  const kind: EyeKind = mix(h, 1) < 220 ? "dot" : "pill";
  const tilt = (mix(h, 2) % 21) - 10;
  const cx = 30 + (mix(h, 3) % 13);
  const cy = 28 + (mix(h, 4) % 11);
  const rotate = (mix(h, 5) % 25) - 12;
  const lookX = (mix(h, 6) % 7) - 3;
  const lookY = (mix(h, 7) % 7) - 3;
  const gap = kind === "dot" ? 8 + (mix(h, 8) % 5) : 9 + (mix(h, 8) % 6);
  const width =
    kind === "dot" ? 4.2 + (mix(h, 9) % 20) / 10 : 4 + (mix(h, 9) % 16) / 10;
  const height = kind === "dot" ? width : 9 + (mix(h, 10) % 40) / 10;

  return {
    seed: key,
    shape,
    path: SHAPES[shape]!,
    color,
    tilt,
    eye: {
      kind,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      gap,
      cx,
      cy,
      rotate,
      lookX,
      lookY,
    },
  };
}

/** Brand companion with optional user overrides for shape and color. */
export function brandCharacter(
  appearance: CompanionAppearance = DEFAULT_COMPANION,
  dark = false,
): Character {
  const base = characterFor(BRAND_SEED);
  const shape = SHAPE_OPTIONS.some((option) => option.shape === appearance.shape)
    ? appearance.shape
    : DEFAULT_COMPANION.shape;
  return {
    ...base,
    shape,
    path: SHAPES[shape]!,
    color: companionColorForScheme(appearance.color, dark),
    tilt: 0,
  };
}

export function companionColorForScheme(color: string, dark = false): string {
  const swatch = COLOR_SWATCHES.find(
    (item) => item.color === color || item.dark === color,
  );
  if (swatch) return dark ? swatch.dark : swatch.color;
  return isHexColor(color) ? color : DEFAULT_COMPANION.color;
}

export function companionSwatchName(color: string): string {
  const swatch = COLOR_SWATCHES.find(
    (item) => item.color === color || item.dark === color,
  );
  return swatch?.name ?? "Custom";
}

export function normalizeCompanion(value: unknown): CompanionAppearance {
  if (!value || typeof value !== "object") return { ...DEFAULT_COMPANION };
  const raw = value as { shape?: unknown; color?: unknown };
  const shape =
    typeof raw.shape === "number" &&
    SHAPE_OPTIONS.some((option) => option.shape === raw.shape)
      ? raw.shape
      : DEFAULT_COMPANION.shape;
  const color =
    typeof raw.color === "string" && isHexColor(raw.color)
      ? raw.color
      : DEFAULT_COMPANION.color;
  return { shape, color };
}

export function newCharacterSeed(id: string, occupied: readonly string[]) {
  const appearance = (seed: string) => {
    const c = characterFor(seed);
    return `${c.shape}:${c.color}`;
  };
  const used = new Set(occupied.map(appearance));
  for (let variant = 0; variant < 1000; variant++) {
    const seed = variant ? `${id}:${variant}` : id;
    if (!used.has(appearance(seed))) return seed;
  }
  return id; // Large libraries still retain independently varied eyes and pose.
}

export function withCharacterSeeds<
  T extends { id: string; characterSeed?: string },
>(items: readonly T[]): (T & { characterSeed: string })[] {
  const occupied: string[] = items.flatMap((item) =>
    item.characterSeed ? [item.characterSeed] : [],
  );
  return items.map((item) => {
    if (item.characterSeed)
      return { ...item, characterSeed: item.characterSeed };
    const characterSeed = newCharacterSeed(item.id, occupied);
    occupied.push(characterSeed);
    return { ...item, characterSeed };
  });
}
