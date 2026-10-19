import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function mocksAllowed() {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.PACT_AI === "mock" || process.env.FO_MODE === "mock";
}

export function aiMocked() {
  return process.env.VERCEL_ENV !== "production" && process.env.PACT_AI === "mock";
}

export function foMocked() {
  return process.env.VERCEL_ENV !== "production" && process.env.FO_MODE === "mock";
}

function devSecrets() {
  const file = join(root, ".local", "dev-secrets.json");
  let saved: Record<string, string> = {};
  try {
    saved = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    saved = {};
  }
  let changed = false;
  if (!saved.install) {
    saved.install = randomBytes(32).toString("base64url");
    changed = true;
  }
  if (!saved.foKey) {
    saved.foKey = randomBytes(32).toString("base64");
    changed = true;
  }
  if (changed) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, JSON.stringify(saved), { mode: 0o600 });
  }
  return saved;
}

export function installSecret() {
  const set = process.env.INSTALL_TOKEN_SECRET?.trim();
  if (set) return set;
  if (isProduction()) throw new Error("INSTALL_TOKEN_SECRET is required");
  return devSecrets().install!;
}

export function foKeyBytes() {
  const set = process.env.FO_TOKEN_ENC_KEY?.trim();
  const raw = set || (isProduction() ? "" : devSecrets().foKey!);
  if (!raw) throw new Error("FO_TOKEN_ENC_KEY is required");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32)
    throw new Error("FO_TOKEN_ENC_KEY must be 32 bytes, base64-encoded");
  return bytes;
}

export function publicBase(req?: Request) {
  const set = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (set) return set;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req?.headers.get("x-forwarded-host") || req?.headers.get("host");
  const proto = req?.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function storePath() {
  return join(root, ".local", "store.json");
}

export function devSecretsExist() {
  return existsSync(join(root, ".local", "dev-secrets.json"));
}
