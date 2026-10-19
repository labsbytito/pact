import assert from "node:assert/strict";
import test from "node:test";
import { redisStore } from "../lib/store";

test("redis get returns a JSON string unchanged", async () => {
  const previous = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    kvUrl: process.env.KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN,
  };
  const original = globalThis.fetch;
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ result: '{"version":1}' }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    const value = await redisStore().get("journal:test");
    assert.equal(value, '{"version":1}');
  } finally {
    globalThis.fetch = original;
    if (previous.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previous.url;
    if (previous.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previous.token;
    if (previous.kvUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = previous.kvUrl;
    if (previous.kvToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = previous.kvToken;
  }
});
