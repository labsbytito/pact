/** Deterministic Pact companions — twelve flat Grok-style silhouettes. */

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
  /** 2 marks a shape id from the current set. Missing means the previous set. */
  v?: 2;
};

export const BRAND_SEED = "pact.brand";

/** Saturated flat fills. Purple and indigo are not in the set. */
export const PALETTE = [
  "#F59E0B",
  "#8B5E3C",
  "#EC4899",
  "#14B8A6",
  "#EF4444",
  "#3B82F6",
  "#F5F5F5",
  "#EAB308",
  "#FB923C",
  "#0EA5E9",
  "#22C55E",
  "#FB7185",
] as const;

/**
 * One solid silhouette each, viewBox 0 0 100 100.
 * 0 circle, 1 rounded square, 2 rounded square (tilted −12°),
 * 3 horizontal pill, 4 vertical capsule, 5 soft triangle,
 * 6 cloud, 7 squircle (tilted +10°), 8 bean, 9 egg,
 * 10 rounded diamond, 11 soft pentagon.
 */
export const SHAPES: readonly string[] = [
  "M50 12a38 38 0 1 0 0 76a38 38 0 1 0 0-76Z",
  "M42 14h16a28 28 0 0 1 28 28v16a28 28 0 0 1-28 28H42a28 28 0 0 1-28-28V42a28 28 0 0 1 28-28Z",
  "M42 14h16a28 28 0 0 1 28 28v16a28 28 0 0 1-28 28H42a28 28 0 0 1-28-28V42a28 28 0 0 1 28-28Z",
  "M32 28h36a22 22 0 0 1 0 44H32a22 22 0 0 1 0-44Z",
  "M28 32v36a22 22 0 0 0 44 0V32a22 22 0 0 0-44 0Z",
  "M50 16C64 18 74 32 76 46C78 64 66 82 50 84C34 82 22 64 24 46C26 32 36 18 50 16Z",
  "M28 62C16 60 14 48 24 44C18 34 32 24 44 32C50 18 68 20 72 34C84 26 96 38 90 50C100 60 88 72 74 68C62 78 38 76 28 62Z",
  "M50 14C68 14 86 32 86 50C86 68 68 86 50 86C32 86 14 68 14 50C14 32 32 14 50 14Z",
  "M36 22C54 14 76 24 78 42C80 62 64 80 46 82C30 84 16 70 20 54C22 44 34 42 42 50C48 56 44 66 34 60C24 54 22 40 28 32C30 26 32 24 36 22Z",
  "M50 12C68 12 80 32 80 52C80 74 66 88 50 88C34 88 20 74 20 52C20 32 32 12 50 12Z",
  "M50 14C58 14 66 22 74 34C84 48 84 52 74 66C66 78 58 86 50 86C42 86 34 78 26 66C16 52 16 48 26 34C34 22 42 14 50 14Z",
  "M50 14C62 14 74 22 80 34C88 48 86 62 76 74C66 84 54 88 50 88C46 88 34 84 24 74C14 62 12 48 20 34C26 22 38 14 50 14Z",
];

type Face = { tilt: number; cx: number; cy: number; gap: number; rotate: number; lookX: number; lookY: number };

/** Eyes sit just above centre. Lean follows the shape. */
export const FACES: readonly Face[] = [
  { tilt: 0, cx: 50, cy: 44, gap: 14, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 0, cx: 50, cy: 44, gap: 14, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: -12, cx: 46, cy: 44, gap: 14, rotate: -8, lookX: -1, lookY: 0 },
  { tilt: 0, cx: 50, cy: 48, gap: 16, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 0, cx: 50, cy: 42, gap: 12, rotate: 0, lookX: 0, lookY: -1 },
  { tilt: -4, cx: 48, cy: 50, gap: 13, rotate: -4, lookX: -1, lookY: 1 },
  { tilt: -3, cx: 52, cy: 46, gap: 14, rotate: -3, lookX: 1, lookY: 0 },
  { tilt: 10, cx: 54, cy: 44, gap: 14, rotate: 8, lookX: 1, lookY: 0 },
  { tilt: -8, cx: 46, cy: 48, gap: 12, rotate: -6, lookX: -1, lookY: 0 },
  { tilt: 0, cx: 50, cy: 46, gap: 14, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 0, cx: 50, cy: 48, gap: 12, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 2, cx: 50, cy: 46, gap: 14, rotate: 2, lookX: 0, lookY: 0 },
];

/** Previous shape ids: circle, triangle, square, pill, cloud, heart, star, drop, bean, ghost, hexagon, flower. */
const LEGACY_SHAPE = [0, 5, 2, 4, 6, 0, 0, 0, 8, 0, 0, 0];

const RETIRED_COLORS = new Set(["#8B5CF6", "#A78BFA", "#A855F7", "#6366F1", "#818CF8"]);

export const SHAPE_OPTIONS = [
  { shape: 0, name: "Circle" },
  { shape: 1, name: "Square" },
  { shape: 2, name: "Tilted square" },
  { shape: 3, name: "Pill" },
  { shape: 4, name: "Capsule" },
  { shape: 5, name: "Triangle" },
  { shape: 6, name: "Cloud" },
  { shape: 7, name: "Squircle" },
  { shape: 8, name: "Bean" },
  { shape: 9, name: "Egg" },
  { shape: 10, name: "Diamond" },
  { shape: 11, name: "Pentagon" },
] as const;

export const COLOR_SWATCHES = [
  { name: "Amber", color: "#F59E0B", dark: "#FBBF24" },
  { name: "Brown", color: "#8B5E3C", dark: "#A67C52" },
  { name: "Pink", color: "#EC4899", dark: "#F472B6" },
  { name: "Teal", color: "#14B8A6", dark: "#2DD4BF" },
  { name: "Red", color: "#EF4444", dark: "#F87171" },
  { name: "Blue", color: "#3B82F6", dark: "#60A5FA" },
  { name: "White", color: "#F5F5F5", dark: "#E5E5E5" },
  { name: "Gold", color: "#EAB308", dark: "#FACC15" },
  { name: "Mint", color: "#22C55E", dark: "#4ADE80" },
  { name: "Coral", color: "#FB7185", dark: "#FDA4AF" },
] as const;

export const DEFAULT_COMPANION: CompanionAppearance = {
  shape: 0,
  color: "#F59E0B",
};

export const EYE_FILL = "#111111";

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

export function characterFor(seed?: string): Character {
  const key = seed && seed.trim() ? seed.trim() : BRAND_SEED;
  const h = hash(key);
  const shape = h % SHAPES.length;
  const color = pick(PALETTE, (h >>> 8) % PALETTE.length);
  const tilt = (mix(h, 2) % 17) - 8;
  const cx = 36 + (mix(h, 3) % 24);
  const cy = 34 + (mix(h, 4) % 16);
  const rotate = (mix(h, 5) % 17) - 8;
  const lookX = (mix(h, 6) % 5) - 2;
  const lookY = (mix(h, 7) % 5) - 2;
  const gap = 12 + (mix(h, 8) % 4);
  const width = 6.2 + (mix(h, 9) % 10) / 10;
  const height = 15 + (mix(h, 10) % 30) / 10;

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
      width: 7,
      height: 18,
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
  const migrated = migrateColor(color);
  const swatch = COLOR_SWATCHES.find(
    (item) => item.color === migrated || item.dark === migrated,
  );
  if (swatch) return dark ? swatch.dark : swatch.color;
  return isHexColor(migrated) ? migrated : DEFAULT_COMPANION.color;
}

export function companionSwatchName(color: string): string {
  const migrated = migrateColor(color);
  const swatch = COLOR_SWATCHES.find(
    (item) => item.color === migrated || item.dark === migrated,
  );
  return swatch?.name ?? "Custom";
}

function migrateColor(color: string): string {
  return RETIRED_COLORS.has(color.toUpperCase()) ? DEFAULT_COMPANION.color : color;
}

export function normalizeCompanion(value: unknown): CompanionAppearance {
  if (!value || typeof value !== "object") return { ...DEFAULT_COMPANION };
  const raw = value as { shape?: unknown; color?: unknown; mood?: unknown; v?: unknown };
  let shape = DEFAULT_COMPANION.shape;
  if (typeof raw.shape === "number" && Number.isInteger(raw.shape)) {
    if (raw.v === 2 && SHAPE_OPTIONS.some((option) => option.shape === raw.shape)) shape = raw.shape;
    else if (raw.shape >= 0 && raw.shape < LEGACY_SHAPE.length) shape = LEGACY_SHAPE[raw.shape]!;
  }
  const color =
    typeof raw.color === "string" && isHexColor(raw.color)
      ? migrateColor(raw.color)
      : DEFAULT_COMPANION.color;
  const moods = ["idle", "happy", "thinking", "sleepy"] as const;
  const mood = moods.find((item) => item === raw.mood);
  return { shape, color, v: 2, ...(mood ? { mood } : {}) };
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
