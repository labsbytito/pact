import test from "node:test";
import assert from "node:assert/strict";
import { prepareAttachment } from "../lib/attachments";
import { interpretationContext } from "../lib/context";
import { makePact } from "../lib/model";
import { interpretInput, payload } from "../backend/lib/interpret";
import { buildMessageContent } from "../backend/lib/ai";
import { ActionStore } from "../backend/lib/actions";

test("distinctive file content reaches Claude's actual text request through client + validation + prompt", async () => {
  const secret = "The sapphire otter launch code is KIRAGU-7319.";
  const attachment = await prepareAttachment(new File([secret], "brief.txt", { type: "text/plain" }));
  const wire = interpretationContext(makePact("What is the launch code?"), [attachment]);
  const validated = interpretInput.parse(wire);
  const model = payload(validated.pact, await ActionStore.load("store://test", { read: async () => null, write: async () => {} }), []);
  assert.equal(JSON.parse(model.content).attachments[0].text, secret);
  assert.match(String(buildMessageContent(model.content, model.images)), /KIRAGU-7319/);
});

test("large image payload remains byte-for-byte intact instead of being truncated by conversation budget", async () => {
  const data = Buffer.alloc(280000, 31).toString("base64");
  const wire = interpretationContext(makePact("Inspect this image"), [{ id: "image", name: "photo.png", kind: "image", mime: "image/png", size: 280000, data }]);
  assert.equal(wire.pact.attachments[0]?.data, data);
  assert.ok(JSON.stringify(wire).length > 240000);
  const validated = interpretInput.parse(wire);
  const model = payload(validated.pact, await ActionStore.load("store://test", { read: async () => null, write: async () => {} }), []);
  const blocks = buildMessageContent(model.content, model.images);
  assert.ok(Array.isArray(blocks));
  assert.equal(blocks[0]?.type, "image");
  assert.equal((blocks[0] as any).source.data, data);
});

test("PDFs use a native document block, and invalid or oversized files fail before submission", async () => {
  const pdf = await prepareAttachment(new File(["%PDF-1.4\n% distinctive chart\n%%EOF"], "chart.pdf", { type: "application/pdf" }));
  const input = interpretInput.parse(interpretationContext(makePact("Read PDF"), [pdf]));
  const packed = payload(input.pact, await ActionStore.load("store://test", { read: async () => null, write: async () => {} }), []);
  const blocks = buildMessageContent(packed.content, packed.images);
  assert.ok(Array.isArray(blocks));
  assert.equal(blocks[0]?.type, "document");
  assert.equal((blocks[0] as any).source.media_type, "application/pdf");
  assert.equal(Buffer.from((blocks[0] as any).source.data, "base64").toString().includes("distinctive chart"), true);
  await assert.rejects(() => prepareAttachment(new File(["not a PDF"], "bad.pdf")), /valid PDF/);
  await assert.rejects(() => prepareAttachment(new File(["😀".repeat(7000)], "large.txt")), /24KB/);
  await assert.rejects(() => prepareAttachment(new File(["binary"], "report.docx")), /Export Word/);
});

test("malformed binary and mismatched attachment types fail validation", () => {
  const body = (attachment: unknown) => ({ pact: { intention: "Read", messages: [], attachments: [attachment] } });
  assert.equal(interpretInput.safeParse(body({ name: "x.png", mime: "image/png", kind: "image", data: "broken base64" })).success, false);
  assert.equal(interpretInput.safeParse(body({ name: "x.txt", mime: "text/plain", kind: "text" })).success, false);
  assert.equal(interpretInput.safeParse(body({ name: "x.pdf", mime: "image/png", kind: "document", data: btoa("%PDF-") })).success, false);
});

test("saved files survive reopening and enter later context, removed files do not", async () => {
  const file = await prepareAttachment(new File(["OTTER-8317"], "saved.txt"));
  const pact = makePact("Read this");
  pact.messages[0]!.attachments = [file];
  const reopened = JSON.parse(JSON.stringify(pact));
  assert.equal(interpretationContext(reopened).pact.attachments[0]?.text, "OTTER-8317");
  reopened.messages[0].attachments = [];
  assert.deepEqual(interpretationContext(reopened).pact.attachments, []);
});
