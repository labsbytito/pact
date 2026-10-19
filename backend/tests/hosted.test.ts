import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { issueInstallToken, readInstallId } from "../lib/auth";
import { decryptString, encryptString } from "../lib/crypto";
import { limitInstall } from "../lib/rate-limit";
import { fileStore, memoryStore, redisRestFrom, useStore } from "../lib/store";
import { Threads } from "../lib/fo-task";

test("install token round trip rejects a bad mac", () => {
  const secret = "test-secret-test-secret-test-secret";
  const issued = issueInstallToken(secret);
  assert.equal(readInstallId(issued.token, secret), issued.id);
  assert.equal(readInstallId(`${issued.id}.not-the-mac`, secret), null);
  assert.equal(readInstallId("nope", secret), null);
});

test("AES-GCM round trip and a tampered payload fails", () => {
  const key = randomBytes(32);
  const sealed = encryptString("fo-token", key);
  assert.equal(decryptString(sealed, key), "fo-token");
  const broken = `${sealed.slice(0, -2)}aa`;
  assert.throws(() => decryptString(broken, key));
});

test("rate limit allows five installs an hour then refuses", async () => {
  const store = memoryStore();
  for (let i = 0; i < 5; i++) await limitInstall(store, "203.0.113.4");
  await assert.rejects(() => limitInstall(store, "203.0.113.4"));
});

test("memory and file stores round trip and expire", async () => {
  const memory = memoryStore();
  await memory.set("a", "1");
  assert.equal(await memory.get("a"), "1");
  await memory.del("a");
  assert.equal(await memory.get("a"), null);
  const dir = await mkdtemp(join(tmpdir(), "pact-store-"));
  try {
    const file = fileStore(join(dir, "store.json"));
    await file.set("b", "2", 60);
    assert.equal(await file.get("b"), "2");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("redis rest env accepts a complete Upstash pair or a complete KV pair", () => {
  assert.deepEqual(
    redisRestFrom({ UPSTASH_REDIS_REST_URL: "https://upstash.example", UPSTASH_REDIS_REST_TOKEN: "upstash-token" }),
    { url: "https://upstash.example", token: "upstash-token" },
  );
  assert.deepEqual(
    redisRestFrom({ KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "kv-token" }),
    { url: "https://kv.example", token: "kv-token" },
  );
  assert.equal(redisRestFrom({ UPSTASH_REDIS_REST_URL: "https://upstash.example" }), null);
  assert.deepEqual(
    redisRestFrom({
      UPSTASH_REDIS_REST_URL: "https://upstash.example",
      UPSTASH_REDIS_REST_TOKEN: "upstash-token",
      KV_REST_API_URL: "https://kv.example",
      KV_REST_API_TOKEN: "kv-token",
    }),
    { url: "https://upstash.example", token: "upstash-token" },
  );
});

test("thread handles persist through the store", async () => {
  const store = memoryStore();
  const first = await Threads.openStore(store, "threads:one");
  await first.remember("pact", "conversation", first.epoch);
  const second = await Threads.openStore(store, "threads:one");
  assert.equal(second.get("pact"), "conversation");
});

test("a mock approve is polled once per read", async () => {
  process.env.FO_MODE = "mock";
  process.env.PACT_AI = "mock";
  process.env.INSTALL_TOKEN_SECRET = "test-secret-test-secret-test-secret";
  process.env.FO_TOKEN_ENC_KEY = randomBytes(32).toString("base64");
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  useStore(memoryStore());
  const { sessionFor, approveHeld, pollRun } = await import("../lib/runtime");
  const session = await sessionFor(randomUUID());
  const plan = await session.actions.propose({
    title: "Visit",
    instruction: "Look up the hours",
    toolName: "ask_fo",
    arguments: { message: "hours please" },
    pactId: randomUUID(),
    contextHash: "a".repeat(64),
  });
  const run = await approveHeld(session, {
    planId: plan.planId,
    pactId: plan.pactId,
    contextHash: plan.contextHash,
    requestId: "request-12345678",
  });
  assert.equal(run.status, "running");
  const again = await sessionFor(session.id);
  const first = await pollRun(again, again.actions.getRun(run.runId)!);
  assert.equal(first.status, "running");
  await again.actions.patchRun(run.runId, first);
  const later = await sessionFor(session.id);
  const second = await pollRun(later, later.actions.getRun(run.runId)!);
  assert.equal(second.status, "returned");
  assert.match(second.result ?? "", /demo result/);
});
