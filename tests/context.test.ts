import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpretationContext,
  mergeReply,
  supersedeProposal,
} from "../lib/context";
import {
  makePact,
  approve,
  safeUrl,
  type Source,
  type Action,
} from "../lib/model";
const proposed: Action = {
  id: "a",
  title: "Research classes",
  instruction: "Find classes",
  status: "proposed",
  planId: "plan",
};
test("a running action and its result cannot be replaced by a new AI proposal", () => {
  const pact = {
    ...makePact("Learn pottery"),
    action: { ...proposed, status: "running" as const, runId: "run" },
  };
  const next = mergeReply(
    pact,
    {
      reply: "Let’s discuss it.",
      action: {
        title: "Another step",
        instruction: "new",
        planId: "p2",
        toolName: "x",
        arguments: {},
      },
    },
    "m",
    "now",
  );
  assert.deepEqual(next.action, pact.action);
  assert.equal(next.messages.at(-1)?.text, "Let’s discuss it.");
});
test("terminal action history survives a later proposal", () => {
  const pact = {
    ...makePact("Learn pottery"),
    action: {
      ...proposed,
      status: "returned" as const,
      result: "actual Fo response",
    },
  };
  const next = mergeReply(
    pact,
    {
      reply: "Next.",
      action: {
        title: "Another step",
        instruction: "new",
        planId: "p2",
        toolName: "x",
        arguments: {},
      },
    },
    "m",
    "now",
  );
  assert.equal(next.actions?.[0]?.result, "actual Fo response");
  assert.equal(next.action?.planId, "p2");
});
test("a correction withdraws an unsubmitted proposal", () => {
  const next = supersedeProposal({ ...makePact("Pottery"), action: proposed });
  assert.equal(next.action, undefined);
  assert.equal(next.actions?.[0]?.status, "superseded");
});
test("long conversations and transcripts preserve the current moment within bounded payload", () => {
  const source: Source = {
    title: "Video",
    url: "https://youtube.com/watch?v=test",
    text: "x".repeat(50000),
    description: "",
    selection: "",
    capturedAt: "now",
    videoTime: 16000,
    transcriptStatus: "available",
    transcript: Array.from({ length: 10000 }, (_, i) => ({
      start: i * 2,
      text: `Line ${i} ` + "a".repeat(100),
    })),
  };
  const p = makePact("What is this place?", source);
  p.messages = Array.from({ length: 250 }, (_, i) => ({
    id: String(i),
    role: "user",
    text: "a".repeat(8000),
    at: "now",
  }));
  const context = interpretationContext(p);
  assert.equal(context.pact.messages.length, 24);
  assert.ok(context.pact.source!.transcript.some((l) => l.start === 16000));
  assert.equal(context.pact.source!.transcriptPartial, true);
  assert.ok(Buffer.byteLength(JSON.stringify(context)) < 300000);
  assert.equal(p.messages.length, 250);
});
test("source links never execute page supplied script", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("https://example.org/"), "https://example.org/");
});
test("reapproval cannot submit a running or uncertain action", () => {
  for (const status of ["running", "unknown", "returned"] as const)
    assert.throws(() => approve({ ...proposed, status }));
});
test("UTF-8 budget includes multibyte video and conversation text", () => {
  const p = makePact("旅".repeat(8000), {
    title: "旅",
    url: "https://example.org",
    text: "旅".repeat(50000),
    description: "旅".repeat(10000),
    selection: "旅".repeat(10000),
    capturedAt: "now",
    videoTime: 18000,
    transcriptStatus: "available",
    transcript: Array.from({ length: 10000 }, (_, i) => ({
      start: i * 2,
      text: "旅".repeat(100),
    })),
  });
  p.messages = Array.from({ length: 150 }, (_, i) => ({
    id: String(i),
    role: "user",
    text: "旅".repeat(8000),
    at: "now",
  }));
  assert.ok(
    Buffer.byteLength(JSON.stringify(interpretationContext(p))) <= 240000,
  );
});

test("visible selection and its capture limits survive interpretation budgeting", () => {
  const source: Source = {
    title: "Scrolled post",
    url: "https://example.org/thread",
    description: "",
    text: "Selected item: This exact item\nVisible on screen: Current section",
    selection: "This exact item",
    viewportText: "Current section",
    selectionContext: "The containing post",
    captureMode: "picked",
    capturedAt: new Date().toISOString(),
    transcript: [],
    transcriptStatus: "not-video",
    transcriptPartial: true,
  };
  const result = interpretationContext(makePact("Explain this", source)).pact
    .source!;
  assert.equal(result.selection, "This exact item");
  assert.equal(result.viewportText, "Current section");
  assert.equal(result.captureMode, "picked");
  assert.equal(result.transcriptPartial, true);
});
test("escaped and multibyte selection metadata cannot exceed the request budget", () => {
  const text = "\u0000旅".repeat(20000);
  const source: Source = {
    title: text,
    url: "https://example.org/" + text,
    description: text,
    text,
    selection: text,
    viewportText: text,
    selectionContext: text,
    selectionLabel: text,
    capturedAt: "now",
    transcript: [],
    transcriptStatus: "not-video",
  };
  const p = makePact(text, source);
  p.messages = [{ id: "m", role: "user", text, at: "now" }];
  assert.ok(
    Buffer.byteLength(JSON.stringify(interpretationContext(p))) <= 240000,
  );
});
