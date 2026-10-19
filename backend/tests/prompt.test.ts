import assert from "node:assert/strict";
import test from "node:test";
import { jsonSystemPrompt, streamSystemPrompt } from "../lib/interpret-prompt";
import { mockProposal } from "../lib/mock";

test("short responses are one or two sentences with no lists", () => {
  const prompt = streamSystemPrompt([], null, "short");
  assert.match(prompt, /1-2 sentences/);
  assert.match(prompt, /no lists/);
  assert.doesNotMatch(prompt, /2-4 sentences/);
});

test("detailed responses allow about six sentences or short bullets", () => {
  const prompt = jsonSystemPrompt([], null, "detailed");
  assert.match(prompt, /6 sentences/);
  assert.match(prompt, /short bullets/);
});

test("the default prompt is a neutral 2-4 sentence reply", () => {
  const prompt = streamSystemPrompt([], null);
  assert.match(prompt, /neutral, conversational reply of about 2-4 sentences/);
  assert.match(prompt, /do not say you will ask Fo now/);
});

test("mock short and detailed replies differ, and a waiting card never says now", () => {
  const ask = "Find the museum opening hours";
  const short = mockProposal(ask, { responseStyle: "short", askBefore: "always" });
  const detailed = mockProposal(ask, { responseStyle: "detailed", askBefore: "always" });
  const fallback = mockProposal(ask, { askBefore: "always" });
  assert.match(short.reply, /Approve below when you’re ready/);
  assert.doesNotMatch(short.reply, /do that now|ask Fo to do that now/);
  assert.equal(short.reply.includes("\n"), false);
  assert.ok(short.reply.split(/[.!?]/).filter((part) => part.trim()).length <= 2);
  assert.match(detailed.reply, /Approve below when you’re ready/);
  assert.match(detailed.reply, /^- /m);
  assert.ok(detailed.reply.length > short.reply.length + 40);
  assert.match(fallback.reply, /until you approve/);
  assert.doesNotMatch(fallback.reply, /do that now/);
  const sent = mockProposal(ask, { responseStyle: "short", askBefore: "suggested" });
  assert.match(sent.reply, /I’ll ask Fo for that now/);
});
