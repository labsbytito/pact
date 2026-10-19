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
 * 0 circle, 1 dome, 2 chunky square (tilted −12°),
 * 3 wide pill, 4 tall capsule, 5 soft triangle,
 * 6 three-bump cloud, 7 shield (tilted −12°), 8 bean,
 * 9 flat-base blob, 10 rounded diamond, 11 chunky square.
 */
export const SHAPES: readonly string[] = [
  "M50 12a38 38 0 1 0 0 76a38 38 0 1 0 0-76Z",
  "M18 78H82V50C82 28 68 16 50 16C32 16 18 28 18 50Z",
  "M32 16H70Q86 16 84 32L78 68Q76 86 60 86H36Q20 86 22 68L20 32Q18 16 32 16Z",
  "M16 34H84A16 16 0 0 1 84 66H16A16 16 0 0 1 16 34Z",
  "M34 16H66A16 16 0 0 1 66 84H34A16 16 0 0 1 34 16Z",
  "M63.7 26L81.3 58.2Q90 74 72.2 76.7L29.8 83Q10 86 20.6 69L47.6 25.6Q56 12 63.7 26Z",
  "M22 64C10 64 10 50 22 48C18 36 30 28 40 36C46 22 62 22 68 36C80 30 94 42 88 54C98 66 86 76 72 70C60 80 36 78 22 64Z",
  "M22 26H78Q82 26 80 34Q74 58 58 78Q50 88 42 78Q26 58 20 34Q18 26 22 26Z",
  "M38 20C56 14 76 24 80 42C84 62 68 80 48 82C32 84 18 72 22 56C26 42 40 44 46 52C52 60 46 70 34 64C22 58 20 42 28 32C32 26 34 22 38 20Z",
  "M20 74H80C84 74 86 66 82 56C76 42 66 30 52 26C36 22 22 34 18 50C14 64 14 74 20 74Z",
  "M50 12C62 26 80 40 84 50C80 62 62 80 50 88C38 80 20 62 16 50C20 40 38 26 50 12Z",
  "M28 18H72Q84 18 84 30V70Q84 84 72 84H28Q16 84 16 70V30Q16 18 28 18Z",
];

type Face = { tilt: number; cx: number; cy: number; gap: number; rotate: number; lookX: number; lookY: number };

/** Eyes sit just above centre. Lean follows the shape. */
export const FACES: readonly Face[] = [
  { tilt: 0, cx: 50, cy: 46, gap: 16, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 0, cx: 50, cy: 48, gap: 16, rotate: 0, lookX: 0, lookY: 1 },
  { tilt: -12, cx: 44, cy: 46, gap: 14, rotate: -8, lookX: -1, lookY: 0 },
  { tilt: 0, cx: 50, cy: 50, gap: 18, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 0, cx: 50, cy: 40, gap: 12, rotate: 0, lookX: 0, lookY: -1 },
  { tilt: -6, cx: 46, cy: 56, gap: 13, rotate: -4, lookX: -1, lookY: 1 },
  { tilt: 2, cx: 54, cy: 50, gap: 14, rotate: 2, lookX: 1, lookY: 0 },
  { tilt: -12, cx: 46, cy: 48, gap: 13, rotate: -8, lookX: -1, lookY: 0 },
  { tilt: -8, cx: 44, cy: 48, gap: 12, rotate: -6, lookX: -1, lookY: 0 },
  { tilt: 4, cx: 52, cy: 50, gap: 14, rotate: 3, lookX: 1, lookY: 1 },
  { tilt: 0, cx: 50, cy: 48, gap: 12, rotate: 0, lookX: 0, lookY: 0 },
  { tilt: 0, cx: 50, cy: 46, gap: 15, rotate: 0, lookX: 0, lookY: 0 },
];

/** Previous shape ids: circle, triangle, square, pill, cloud, heart, star, drop, bean, ghost, hexagon, flower. */
const LEGACY_SHAPE = [0, 5, 2, 4, 6, 0, 0, 0, 8, 0, 0, 0];

const RETIRED_COLORS = new Set(["#8B5CF6", "#A78BFA", "#A855F7", "#6366F1", "#818CF8"]);

export const SHAPE_OPTIONS = [
  { shape: 0, name: "Circle" },
  { shape: 1, name: "Dome" },
  { shape: 2, name: "Tilted square" },
  { shape: 3, name: "Pill" },
  { shape: 4, name: "Capsule" },
  { shape: 5, name: "Triangle" },
  { shape: 6, name: "Cloud" },
  { shape: 7, name: "Shield" },
  { shape: 8, name: "Bean" },
  { shape: 9, name: "Blob" },
  { shape: 10, name: "Diamond" },
  { shape: 11, name: "Square" },
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
      width: 8.4,
      height: 21,
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
