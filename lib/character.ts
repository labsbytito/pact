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

export type CompanionAppearance = {
  shape: number;
  color: string;
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
] as const;

/**
 * Flat silhouettes in a 72×72 viewBox — Grok Bot family.
 * 0 circle, 1 squircle, 2 rounded triangle, 3 teardrop, 4 cloud/scallop,
 * 5 four-lobe clover, 6 hexagon, 7 rounded square, 8 tilted pebble.
 */
export const SHAPES: readonly string[] = [
  // 0 circle
  "M36 8C51.464 8 64 20.536 64 36C64 51.464 51.464 64 36 64C20.536 64 8 51.464 8 36C8 20.536 20.536 8 36 8Z",
  // 1 squircle
  "M18 18C18 12 24 8 36 8C48 8 54 12 54 18C54 24 58 30 58 36C58 42 54 48 54 54C54 60 48 64 36 64C24 64 18 60 18 54C18 48 14 42 14 36C14 30 18 24 18 18Z",
  // 2 rounded triangle / gumdrop
  "M36 10C44 10 54 22 56 36C58 50 50 62 36 62C22 62 14 50 16 36C18 22 28 10 36 10Z",
  // 3 teardrop
  "M36 8C48 20 58 30 58 42C58 54 48 62 36 62C24 62 14 54 14 42C14 30 24 20 36 8Z",
  // 4 cloud / scallop — chunky Grok Bot teal-cloud silhouette
  "M18 38C14 30 18 20 28 18C30 10 42 8 50 14C58 12 66 20 64 30C70 34 70 46 62 50C64 60 54 66 44 62C38 68 26 66 22 58C12 58 8 46 14 38C14 38 16 38 18 38Z",
  // 5 four-lobe clover — fat round petals like Grok Bot’s red clover
  "M36 12C44 12 50 18 50 26C58 22 68 28 68 38C68 46 60 52 52 50C60 54 66 62 60 68C54 74 44 70 40 62C40 70 32 74 26 70C18 66 18 56 24 50C16 52 8 46 8 38C8 28 18 22 26 26C26 18 28 12 36 12Z",
  // 6 hexagon (soft)
  "M36 8L56 20V44L36 56L16 44V20L36 8Z",
  // 7 rounded square
  "M14 20C14 12 20 8 28 8H44C52 8 58 12 58 20V44C58 52 52 58 44 58H28C20 58 14 52 14 44V20Z",
  // 8 tilted pebble / soft pill
  "M22 18C32 10 50 12 56 24C62 36 54 54 40 58C26 62 12 50 14 36C15 28 16 22 22 18Z",
];

export const SHAPE_OPTIONS = [
  { shape: 0, name: "Circle" },
  { shape: 1, name: "Squircle" },
  { shape: 2, name: "Triangle" },
  { shape: 3, name: "Teardrop" },
  { shape: 4, name: "Cloud" },
  { shape: 5, name: "Clover" },
  { shape: 6, name: "Hexagon" },
  { shape: 7, name: "Square" },
  { shape: 8, name: "Pebble" },
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
