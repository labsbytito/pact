import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretLive, ApiError, AbortInterpretError } from "../lib/api";
import { makePact } from "../lib/model";
import { consumeSseBuffer } from "../lib/stream-parse";

const originalFetch = globalThis.fetch;

test("submit flow falls back to /interpret when stream is unavailable", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/interpret/stream")) {
      return new Response(
        JSON.stringify({ error: "missing", fallback: true }),
        {
          status: 501,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (url.endsWith("/interpret")) {
      assert.equal(init?.method, "POST");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.pact.intention, "Hello Pact");
      return new Response(
        JSON.stringify({ reply: "Hi — I’m here.", title: "Hello" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;

  try {
    const deltas: string[] = [];
    const result = await interpretLive(makePact("Hello Pact"), [], {
      onDelta: (t) => deltas.push(t),
    });
    assert.equal(result.reply, "Hi — I’m here.");
    assert.equal(result.title, "Hello");
    assert.deepEqual(deltas, []);
    assert.ok(calls.some((u) => u.endsWith("/interpret/stream")));
    assert.ok(calls.some((u) => u.endsWith("/interpret")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submit flow falls back when stream route is 404 (old companion)", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/interpret/stream"))
      return new Response("Cannot POST /interpret/stream", { status: 404 });
    if (url.endsWith("/interpret"))
      return new Response(JSON.stringify({ reply: "Recovered via fallback." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    throw new Error(url);
  }) as typeof fetch;

  try {
    const result = await interpretLive(makePact("Recover"), []);
    assert.equal(result.reply, "Recovered via fallback.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submit flow streams SSE deltas then done", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.endsWith("/interpret/stream")) throw new Error(url);
    const sse =
      `data: ${JSON.stringify({ type: "delta", text: "Hel" })}\n\n` +
      `data: ${JSON.stringify({ type: "delta", text: "lo" })}\n\n` +
      `data: ${JSON.stringify({ type: "done", reply: "Hello", title: "T" })}\n\n`;
    return new Response(sse, {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }) as typeof fetch;

  try {
    const deltas: string[] = [];
    const result = await interpretLive(makePact("Stream me"), [], {
      onDelta: (t) => deltas.push(t),
    });
    assert.deepEqual(deltas, ["Hel", "lo"]);
    assert.equal(result.reply, "Hello");
    assert.equal(result.title, "T");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("submit flow surfaces AI offline with a specific ApiError", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/interpret/stream"))
      return new Response(
        JSON.stringify({
          error:
            "Your Pact is saved. AI isn’t connected yet. Add a permitted Claude API key to the local companion to get intelligent replies.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    throw new Error("should not fall back on 503");
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => interpretLive(makePact("Offline AI"), []),
      (e: unknown) =>
        e instanceof ApiError &&
        e.status === 503 &&
        /AI isn’t connected/i.test(e.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stream error events stay visible as an ApiError", async () => {
  globalThis.fetch = (async () => {
    const sse = `data: ${JSON.stringify({ type: "error", error: '"[object Object]" is not valid JSON' })}\n\n`;
    return new Response(sse, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => interpretLive(makePact("Broken reply"), []),
      (e: unknown) =>
        e instanceof ApiError &&
        e.status === 502 &&
        e.message === "Pact couldn't finish that reply.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stopped SSE becomes AbortInterpretError keeping partial text", async () => {
  globalThis.fetch = (async () => {
    const sse = `data: ${JSON.stringify({ type: "delta", text: "Part" })}\n\ndata: ${JSON.stringify({ type: "stopped", reply: "Part" })}\n\n`;
    return new Response(sse, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => interpretLive(makePact("Stop me"), []),
      (e: unknown) =>
        e instanceof AbortInterpretError && e.partial === "Part",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SSE buffer helper still parses multi-event chunks used by submit", () => {
  const { events } = consumeSseBuffer(
    `data: {"type":"delta","text":"a"}\n\ndata: {"type":"done","reply":"a"}\n\n`,
  );
  assert.equal(events.length, 2);
});
