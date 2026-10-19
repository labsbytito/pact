import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/health/route";
import { AiError, reserveBudget } from "../lib/ai";
import {
  BUDGET_PAUSE,
  RESERVE_USD,
  USAGE_TTL_SECONDS,
  budgetPaused,
  costFromUsage,
  refundBudget,
  settleBudget,
  usageKey,
} from "../lib/ai-budget";
import { issueInstallToken } from "../lib/auth";
import { memoryStore, useStore, type Store } from "../lib/store";

test("the usage key is the UTC day and token cost follows Sonnet rates", () => {
  assert.equal(usageKey(new Date("2026-10-19T23:30:00Z")), "ai:usage:2026-10-19");
  assert.equal(usageKey(new Date("2026-10-20T00:30:00Z")), "ai:usage:2026-10-20");
  assert.equal(costFromUsage({ input_tokens: 1000, output_tokens: 1000 }), 0.018);
  assert.equal(costFromUsage({ cache_read_input_tokens: 1_000_000 }), 0.3);
  assert.equal(costFromUsage(null), null);
  assert.equal(RESERVE_USD, 0.02);
});

test("a daily cap reserves an estimate, settles the real cost, and refunds a failure", async () => {
  const inner = memoryStore();
  const ttls: Array<number | undefined> = [];
  const store: Store = {
    get: (key) => inner.get(key),
    async set(key, value, ttl) {
      ttls.push(ttl);
      await inner.set(key, value, ttl);
    },
    del: (key) => inner.del(key),
  };
  const globals = globalThis as typeof globalThis & { __pactStore?: Store };
  const prior = globals.__pactStore;
  const saved = {
    cap: process.env.PACT_AI_DAILY_CAP,
    ai: process.env.PACT_AI,
    fo: process.env.FO_MODE,
    secret: process.env.INSTALL_TOKEN_SECRET,
  };
  useStore(store);
  process.env.PACT_AI_DAILY_CAP = "0.03";
  try {
    await store.set("ai:usage:1999-01-01", JSON.stringify({ spent: 100, reserved: 0 }));
    assert.equal(await reserveBudget(), 0.02);
    assert.equal(ttls.at(-1), USAGE_TTL_SECONDS);
    const openLedger = JSON.parse((await store.get(usageKey()))!);
    assert.equal(openLedger.reserved, 0.02);
    assert.equal(openLedger.spent, 0);
    await assert.rejects(
      reserveBudget(),
      (error: unknown) => {
        assert.ok(error instanceof AiError);
        assert.equal((error as AiError).message, BUDGET_PAUSE);
        assert.equal((error as AiError).status, 402);
        assert.doesNotMatch((error as AiError).message, /local prototype/);
        return true;
      },
    );
    await refundBudget(RESERVE_USD);
    assert.equal(JSON.parse((await store.get(usageKey()))!).reserved, 0);
    await reserveBudget();
    await settleBudget(RESERVE_USD, costFromUsage({ input_tokens: 500, output_tokens: 200 })!);
    const settled = JSON.parse((await store.get(usageKey()))!);
    assert.equal(settled.reserved, 0);
    assert.equal(settled.spent, 0.0045);
    assert.equal(await budgetPaused(), false);

    process.env.PACT_AI = "mock";
    process.env.FO_MODE = "mock";
    process.env.INSTALL_TOKEN_SECRET = "test-secret-test-secret-test-secret";
    const { token } = issueInstallToken(process.env.INSTALL_TOKEN_SECRET);
    const headers = { authorization: `Bearer ${token}` };
    const running = await GET(new Request("http://localhost/api/health", { headers }));
    const runningBody = await running.json();
    assert.equal(runningBody.ok, true);
    assert.equal(runningBody.budget, "ok");

    delete process.env.PACT_AI_DAILY_CAP;
    await store.set(usageKey(), JSON.stringify({ spent: 5, reserved: 0 }), USAGE_TTL_SECONDS);
    const paused = await GET(new Request("http://localhost/api/health", { headers }));
    const pausedBody = await paused.json();
    assert.equal(paused.status, 200);
    assert.equal(pausedBody.ok, false);
    assert.equal(pausedBody.budget, "paused");
    await assert.rejects(reserveBudget(), /short breather/);
  } finally {
    if (saved.cap === undefined) delete process.env.PACT_AI_DAILY_CAP;
    else process.env.PACT_AI_DAILY_CAP = saved.cap;
    if (saved.ai === undefined) delete process.env.PACT_AI;
    else process.env.PACT_AI = saved.ai;
    if (saved.fo === undefined) delete process.env.FO_MODE;
    else process.env.FO_MODE = saved.fo;
    if (saved.secret === undefined) delete process.env.INSTALL_TOKEN_SECRET;
    else process.env.INSTALL_TOKEN_SECRET = saved.secret;
    if (prior) useStore(prior);
    else delete globals.__pactStore;
  }
});
