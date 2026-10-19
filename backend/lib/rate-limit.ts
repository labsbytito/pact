import { limit } from "./env";
import type { Store } from "./store";

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super("Pact needs a short break. Try again in a little while.");
    this.name = "RateLimitError";
  }
}

async function hit(store: Store, key: string, max: number, windowSec: number) {
  const now = Date.now();
  const raw = await store.get(key);
  const stamps = (raw ? (JSON.parse(raw) as number[]) : []).filter(
    (stamp) => now - stamp < windowSec * 1000,
  );
  if (stamps.length >= max) {
    const oldest = stamps[0] ?? now;
    const retryAfter = Math.max(1, Math.ceil((oldest + windowSec * 1000 - now) / 1000));
    throw new RateLimitError(retryAfter);
  }
  stamps.push(now);
  await store.set(key, JSON.stringify(stamps), windowSec);
}

export async function limitInterpret(store: Store, installId: string) {
  await hit(
    store,
    `rl:${installId}:i10`,
    limit("PACT_RL_INTERPRET_10M", 20),
    600,
  );
  await hit(
    store,
    `rl:${installId}:iday`,
    limit("PACT_RL_INTERPRET_DAY", 150),
    86400,
  );
}

export async function limitApproval(store: Store, installId: string) {
  await hit(
    store,
    `rl:${installId}:aday`,
    limit("PACT_RL_APPROVALS_DAY", 10),
    86400,
  );
}

export async function limitInstall(store: Store, ip: string) {
  await hit(store, `rl:ip:${ip}:hour`, limit("PACT_RL_INSTALLS_HOUR", 60), 3600);
}

export function limitSnapshot() {
  return {
    interpretPer10Min: limit("PACT_RL_INTERPRET_10M", 20),
    interpretPerDay: limit("PACT_RL_INTERPRET_DAY", 150),
    approvalsPerDay: limit("PACT_RL_APPROVALS_DAY", 10),
  };
}
