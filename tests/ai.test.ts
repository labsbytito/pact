import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AiError,
  aiStatus,
  classifyAiFailure,
  parseModelReply,
  readCliResult,
} from "../backend/lib/ai";

test("aiStatus exposes provider, model and budget but never keys", () => {
  const saved = { ...process.env };
  try {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-secret";
    delete process.env.PACT_AI;
    delete process.env.ANTHROPIC_MODEL;
    let s = aiStatus();
    assert.equal(s.provider, "anthropic-api");
    assert.equal(s.model, "claude-sonnet-5-5");
    assert.ok(s.budget.capUsd >= 0 && s.budget.spentUsd >= 0);
    assert.ok(!JSON.stringify(s).includes("secret"));
    process.env.ANTHROPIC_MODEL = "custom-model";
    assert.equal(aiStatus().model, "custom-model");
    process.env.PACT_AI = "claude-code";
    s = aiStatus();
    assert.equal(s.provider, "claude-code");
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PACT_AI;
    assert.equal(aiStatus().provider, "none");
    assert.equal(aiStatus().model, null);
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("provider failures become specific actionable messages with sensible status", () => {
  const cases: [string, number | undefined, RegExp, number][] = [
    ["Your credit balance is too low", 400, /no available credit/, 402],
    ["invalid x-api-key authentication_error", 401, /signed in/, 503],
    ["Invalid API key · Please run /login", undefined, /signed in/, 503],
    ["rate_limit_error", 429, /usage limit/, 429],
    ["Claude AI usage limit reached", undefined, /usage limit/, 429],
    ["model: claude-x not_found_error", 404, /model isn’t available/, 503],
    ["overloaded_error", 529, /overloaded/, 503],
    ["something odd", 400, /didn't get a reply/, 502],
  ];
  for (const [text, status, pattern, code] of cases) {
    const e = classifyAiFailure(text, status);
    assert.ok(e instanceof AiError);
    assert.match(e.message, pattern, text);
    assert.equal(e.status, code, text);
    assert.ok(!e.message.includes(text) || text.length < 3);
  }
});

test("CLI results: success, budget, error, timeout and garbage are distinguished", () => {
  const ok = JSON.stringify({ subtype: "success", result: "hi" });
  assert.equal(readCliResult(ok, "", false), "hi");
  assert.throws(
    () => readCliResult(JSON.stringify({ subtype: "error_max_budget_usd" }), "", false),
    /shorter message/,
  );
  assert.throws(
    () =>
      readCliResult(
        JSON.stringify({ is_error: true, subtype: "success", result: "Invalid API key · Please run /login" }),
        "",
        false,
      ),
    /signed in/,
  );
  assert.throws(() => readCliResult(ok, "", true), /too long/);
  assert.throws(() => readCliResult("", "Not logged in", false), /signed in/);
  assert.throws(() => readCliResult("not json", "", false), AiError);
});

test("model replies: fenced, wrapped in prose, plain text and unusable", () => {
  assert.deepEqual(parseModelReply('```json\n{"reply":"a"}\n```'), { reply: "a" });
  assert.deepEqual(parseModelReply('Sure!\n{"reply":"a"} done'), { reply: "a" });
  assert.deepEqual(parseModelReply("Just chatting."), { reply: "Just chatting." });
  assert.throws(() => parseModelReply(""), AiError);
  assert.throws(() => parseModelReply('{"reply": "cut off'), AiError);
  assert.throws(() => parseModelReply("[1]"), AiError);
});
