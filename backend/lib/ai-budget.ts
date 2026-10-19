import { openStore } from "./store";

export class BudgetExhausted extends Error {}

/** About one Sonnet reply at max_tokens 1800. Output is $15 / million tokens. */
export const RESERVE_USD = 0.02;
export const USAGE_TTL_SECONDS = 2 * 24 * 60 * 60;
const INPUT_PER_MILLION = 3;
const OUTPUT_PER_MILLION = 15;
const CACHE_WRITE_PER_MILLION = 3.75;
const CACHE_READ_PER_MILLION = 0.3;

export const BUDGET_PAUSE =
  "Pact is taking a short breather. Too many people are chatting right now. Try again in a little while. Your Pact is saved.";

type Ledger = { spent: number; reserved: number };

export type TokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

let queue: Promise<unknown> = Promise.resolve();
let mirror: Ledger = { spent: 0, reserved: 0 };

function money(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function usageKey(now = new Date()) {
  return `ai:usage:${now.toISOString().slice(0, 10)}`;
}

export function dailyCap() {
  const raw = Number(process.env.PACT_AI_DAILY_CAP ?? 5);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const task = queue.then(run, run);
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

async function readLedger(): Promise<Ledger> {
  const raw = await openStore().get(usageKey());
  if (!raw) return { spent: 0, reserved: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<Ledger>;
    return {
      spent: Number(parsed.spent) || 0,
      reserved: Number(parsed.reserved) || 0,
    };
  } catch {
    return { spent: 0, reserved: 0 };
  }
}

async function writeLedger(ledger: Ledger) {
  mirror = { spent: money(ledger.spent), reserved: money(ledger.reserved) };
  await openStore().set(
    usageKey(),
    JSON.stringify({ spent: mirror.spent, reserved: mirror.reserved, cap: dailyCap() }),
    USAGE_TTL_SECONDS,
  );
}

export function costFromUsage(usage: TokenUsage | null | undefined): number | null {
  if (!usage) return null;
  const known =
    usage.input_tokens != null ||
    usage.output_tokens != null ||
    usage.cache_creation_input_tokens != null ||
    usage.cache_read_input_tokens != null;
  if (!known) return null;
  const input = Number(usage.input_tokens) || 0;
  const output = Number(usage.output_tokens) || 0;
  const cacheWrite = Number(usage.cache_creation_input_tokens) || 0;
  const cacheRead = Number(usage.cache_read_input_tokens) || 0;
  return money(
    (input * INPUT_PER_MILLION +
      cacheWrite * CACHE_WRITE_PER_MILLION +
      cacheRead * CACHE_READ_PER_MILLION +
      output * OUTPUT_PER_MILLION) /
      1_000_000,
  );
}

export function budgetSnapshot() {
  const cap = dailyCap();
  const committed = mirror.spent + mirror.reserved;
  return {
    spentUsd: money(mirror.spent),
    capUsd: cap,
    remainingUsd: money(Math.max(0, cap - committed)),
    perRequestUsd: RESERVE_USD,
    exhausted: committed + RESERVE_USD > cap,
  };
}

export async function budgetPaused() {
  const ledger = await enqueue(readLedger);
  mirror = ledger;
  return ledger.spent + ledger.reserved + RESERVE_USD > dailyCap();
}

export async function reserveBudget() {
  return enqueue(async () => {
    const cap = dailyCap();
    const ledger = await readLedger();
    if (ledger.spent + ledger.reserved + RESERVE_USD > cap) {
      mirror = ledger;
      throw new BudgetExhausted(BUDGET_PAUSE);
    }
    const next = { spent: ledger.spent, reserved: money(ledger.reserved + RESERVE_USD) };
    await writeLedger(next);
    return RESERVE_USD;
  });
}

export async function settleBudget(reserved: number, actual: number) {
  return enqueue(async () => {
    const ledger = await readLedger();
    await writeLedger({
      spent: money(ledger.spent + Math.max(0, actual)),
      reserved: money(Math.max(0, ledger.reserved - reserved)),
    });
  });
}

export async function refundBudget(reserved: number) {
  return enqueue(async () => {
    const ledger = await readLedger();
    await writeLedger({
      spent: ledger.spent,
      reserved: money(Math.max(0, ledger.reserved - reserved)),
    });
  });
}
