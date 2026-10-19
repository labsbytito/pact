import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PACT_STREAM_DELIM,
  splitStreamReply,
  streamReplyDelta,
  consumeSseBuffer,
} from "../lib/stream-parse";

test("splitStreamReply separates prose from trailing meta JSON", () => {
  const raw = `Hello there.\n\n${PACT_STREAM_DELIM}\n{"title":"Hi","action":{"title":"A","instruction":"do","toolName":"ask_fo","arguments":{"message":"x"}}}`;
  const { reply, meta } = splitStreamReply(raw);
  assert.equal(reply, "Hello there.");
  assert.equal((meta as { title: string }).title, "Hi");
});

test("splitStreamReply keeps full text when delimiter is absent", () => {
  assert.deepEqual(splitStreamReply("Just a reply"), {
    reply: "Just a reply",
  });
});

test("streamReplyDelta holds back a possible delimiter prefix", () => {
  let len = 0;
  let out = "";
  const step = (buffer: string) => {
    const { emit, replyLength } = streamReplyDelta(len, buffer);
    out += emit;
    len = replyLength;
  };
  // Short buffers stay held until they cannot be a delimiter prefix.
  step("Hi --");
  assert.equal(out, "");
  step("Hi there, friend. More text here.");
  assert.ok(out.startsWith("Hi there"));
  assert.ok(out.length < "Hi there, friend. More text here.".length);
  step(`Hi there, friend. More text here.\n${PACT_STREAM_DELIM}\n{"title":"T"}`);
  assert.equal(out, "Hi there, friend. More text here.\n");
  assert.equal(len, "Hi there, friend. More text here.\n".length);
});

test("consumeSseBuffer parses complete SSE frames and keeps remainder", () => {
  const { events, rest } = consumeSseBuffer(
    'data: {"type":"delta","text":"a"}\n\ndata: {"type":"delta","text":"b"}\n\ndata: {"type":"don',
  );
  assert.equal(events.length, 2);
  assert.equal((events[0] as { text: string }).text, "a");
  assert.equal(rest.startsWith("data:"), true);
});

test("abort-style stopped payload is JSON-parseable", () => {
  const frame = `data: ${JSON.stringify({ type: "stopped", reply: "partial" })}\n\n`;
  const { events } = consumeSseBuffer(frame);
  assert.deepEqual(events[0], { type: "stopped", reply: "partial" });
});
