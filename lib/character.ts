/** Deterministic Pact companions — Grok Bot style flat shapes + dark pill eyes. */

export type CharacterSize = "tiny" | "small" | "normal" | "hero" | "row";
export type CharacterState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "error"
  | "still"
  | "sleepy"
  | "working"
  | "attention"
  | "streaming"
  | "done";

export type EyeKind = "pill";

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

export type CompanionMood = "idle" | "happy" | "thinking" | "sleepy";
export type CompanionAppearance = {
  shape: number;
  color: string;
  mood?: CompanionMood;
};

export const BRAND_SEED = "pact.brand";

/** Grok Bot–adjacent saturated flat fills (no gradients). */
export const PALETTE = [
  "#8B5CF6", // purple
  "#F59E0B", // orange / gold
  "#8B5E3C", // brown
  "#EC4899", // pink
  "#14B8A6", // teal
  "#EF4444", // red
  "#3B82F6", // blue
  "#F5F5F5", // white
  "#EAB308", // gold
  "#A855F7", // violet
  "#FB923C", // soft orange
  "#0EA5E9", // sky
  "#22C55E", // mint
  "#6366F1", // indigo
  "#FB7185", // coral
] as const;

/**
 * Flat silhouettes in a 72×72 viewBox.
 * 0 circle, 1 soft triangle, 2 tilted square, 3 pill, 4 cloud,
 * 5 heart, 6 soft star, 7 drop, 8 bean, 9 ghost, 10 soft hexagon, 11 flower.
 */
export const SHAPES: readonly string[] = [
  "M36 8C51.464 8 64 20.536 64 36C64 51.464 51.464 64 36 64C20.536 64 8 51.464 8 36C8 20.536 20.536 8 36 8Z",
  "M36 12C42 12 56 30 58 44C60 58 50 64 36 64C22 64 12 58 14 44C16 30 30 12 36 12Z",
  "M24 16C34 8 50 10 56 20C62 30 58 46 50 54C42 62 24 60 16 50C8 40 10 24 24 16Z",
  "M36 8C48 8 56 16 56 28V44C56 56 48 64 36 64C24 64 16 56 16 44V28C16 16 24 8 36 8Z",
  "M22 40C16 34 18 24 28 22C30 14 42 12 48 18C56 14 66 22 62 32C68 36 66 48 56 50C58 60 46 66 36 60C28 66 16 60 18 50C10 48 8 36 16 32C16 32 18 36 22 40Z",
  "M36 58C18 46 10 36 10 26C10 16 18 10 28 12C32 13 36 18 36 22C36 18 40 13 44 12C54 10 62 16 62 26C62 36 54 46 36 58Z",
  "M36 8C38 24 48 28 64 30C48 34 40 42 36 64C32 42 24 34 8 30C24 28 34 24 36 8Z",
  "M36 8C50 22 60 32 60 44C60 56 50 64 36 64C22 64 12 56 12 44C12 32 22 22 36 8Z",
  "M28 16C40 10 54 16 58 28C62 40 54 54 42 58C30 62 16 52 16 40C16 28 18 22 28 16Z",
  "M22 30C22 16 28 8 36 8C44 8 50 16 50 30V50C50 56 46 54 44 50C42 46 38 52 36 50C34 48 30 54 28 50C26 46 22 56 22 50V30Z",
  "M36 10L54 20C58 24 60 28 60 34V46C60 52 56 56 50 58L36 64L22 58C16 56 12 52 12 46V34C12 28 14 24 18 20Z",
  "M36 30C36 18 28 12 36 6C44 12 36 18 36 30C48 22 58 16 64 24C56 32 46 32 36 30C48 38 56 48 48 56C38 48 36 38 36 30C36 42 28 54 18 56C12 46 22 36 36 30C24 32 14 24 8 16C16 10 26 20 36 30Z",
];

type Face = { tilt: number; cx: number; cy: number; gap: number; rotate: number; lookX: number; lookY: number };

/** Stable personality per shape: a lean, and where the eyes sit. */
export const FACES: readonly Face[] = [
  { tilt: 0, cx: 36, cy: 34, gap: 11, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: -6, cx: 36, cy: 40, gap: 10, rotate: -4, lookX: -1, lookY: 1 },
  { tilt: 10, cx: 34, cy: 36, gap: 10, rotate: 8, lookX: 1, lookY: 0 },
  { tilt: 0, cx: 36, cy: 32, gap: 9, rotate: 0, lookX: 0, lookY: -1 },
  { tilt: -4, cx: 38, cy: 36, gap: 12, rotate: -3, lookX: 1, lookY: 0 },
  { tilt: 0, cx: 36, cy: 32, gap: 10, rotate: 0, lookX: 0, lookY: 1 },
  { tilt: 4, cx: 36, cy: 34, gap: 8, rotate: 6, lookX: 0, lookY: -1 },
  { tilt: 0, cx: 36, cy: 40, gap: 10, rotate: 0, lookX: 0, lookY: 1 },
  { tilt: -8, cx: 34, cy: 36, gap: 9, rotate: -6, lookX: -1, lookY: 0 },
  { tilt: 0, cx: 36, cy: 32, gap: 11, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 3, cx: 36, cy: 36, gap: 10, rotate: 2, lookX: 1, lookY: 0 },
  { tilt: -3, cx: 36, cy: 34, gap: 8, rotate: -2, lookX: 0, lookY: -1 },
];

export const SHAPE_OPTIONS = [
  { shape: 0, name: "Circle" },
  { shape: 1, name: "Triangle" },
  { shape: 2, name: "Square" },
  { shape: 3, name: "Pill" },
  { shape: 4, name: "Cloud" },
  { shape: 5, name: "Heart" },
  { shape: 6, name: "Star" },
  { shape: 7, name: "Drop" },
  { shape: 8, name: "Bean" },
  { shape: 9, name: "Ghost" },
  { shape: 10, name: "Hexagon" },
  { shape: 11, name: "Flower" },
] as const;

/** Grok Bot palette swatches for the editor. */
export const COLOR_SWATCHES = [
  { name: "Purple", color: "#8B5CF6", dark: "#A78BFA" },
  { name: "Orange", color: "#F59E0B", dark: "#FBBF24" },
  { name: "Brown", color: "#8B5E3C", dark: "#A67C52" },
  { name: "Pink", color: "#EC4899", dark: "#F472B6" },
  { name: "Teal", color: "#14B8A6", dark: "#2DD4BF" },
  { name: "Red", color: "#EF4444", dark: "#F87171" },
  { name: "Blue", color: "#3B82F6", dark: "#60A5FA" },
  { name: "White", color: "#F5F5F5", dark: "#E5E5E5" },
  { name: "Gold", color: "#EAB308", dark: "#FACC15" },
  { name: "Mint", color: "#22C55E", dark: "#4ADE80" },
  { name: "Indigo", color: "#6366F1", dark: "#818CF8" },
  { name: "Coral", color: "#FB7185", dark: "#FDA4AF" },
] as const;

export const DEFAULT_COMPANION: CompanionAppearance = {
  shape: 0,
  color: COLOR_SWATCHES[0]!.color,
};

/** Dark vertical pill eyes — no white sclera. */
export const EYE_FILL = "#1A1A1A";

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

/** Pure: same seed → same character, forever. Always dark vertical pills. */
export function characterFor(seed?: string): Character {
  const key = seed && seed.trim() ? seed.trim() : BRAND_SEED;
  const h = hash(key);
  const shape = h % SHAPES.length;
  const color = pick(PALETTE, (h >>> 8) % PALETTE.length);
  const tilt = (mix(h, 2) % 17) - 8;
  // Eyes slightly off-center so the face “looks” somewhere
  const cx = 32 + (mix(h, 3) % 9);
  const cy = 30 + (mix(h, 4) % 7);
  const rotate = (mix(h, 5) % 17) - 8;
  const lookX = (mix(h, 6) % 5) - 2;
  const lookY = (mix(h, 7) % 5) - 2;
  const gap = 9 + (mix(h, 8) % 4);
  // Vertical pills: narrow width, taller height
  const width = 3.2 + (mix(h, 9) % 12) / 10;
  const height = 9.5 + (mix(h, 10) % 25) / 10;

  return {
    seed: key,
    shape,
    path: SHAPES[shape]!,
    color,
    tilt,
    eye: {
      kind: "pill",
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

export function brandCharacter(
  appearance: CompanionAppearance = DEFAULT_COMPANION,
  dark = false,
): Character {
  const base = characterFor(BRAND_SEED);
  const shape = SHAPE_OPTIONS.some((option) => option.shape === appearance.shape)
    ? appearance.shape
    : DEFAULT_COMPANION.shape;
  const face = FACES[shape] ?? FACES[0]!;
  return {
    ...base,
    shape,
    path: SHAPES[shape]!,
    color: companionColorForScheme(appearance.color, dark),
    tilt: face.tilt,
    eye: {
      kind: "pill",
      width: 4,
      height: 11,
      gap: face.gap,
      cx: face.cx,
      cy: face.cy,
      rotate: face.rotate,
      lookX: face.lookX,
      lookY: face.lookY,
    },
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
  const raw = value as { shape?: unknown; color?: unknown; mood?: unknown };
  const shape =
    typeof raw.shape === "number" &&
    SHAPE_OPTIONS.some((option) => option.shape === raw.shape)
      ? raw.shape
      : DEFAULT_COMPANION.shape;
  const color =
    typeof raw.color === "string" && isHexColor(raw.color)
      ? raw.color
      : DEFAULT_COMPANION.color;
  const moods = ["idle", "happy", "thinking", "sleepy"] as const;
  const mood = moods.find((item) => item === raw.mood);
  return { shape, color, ...(mood ? { mood } : {}) };
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
  return id;
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
