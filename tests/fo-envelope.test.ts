import { test } from "node:test";
import assert from "node:assert/strict";
import { settleFo } from "../backend/lib/fo-task";
import { NotSubmittedError } from "../backend/lib/actions";

const text = (t: string, isError = false) => ({
  content: [{ type: "text", text: t }],
  ...(isError ? { isError } : {}),
});
const settle = (reply: any, o = {}) =>
  settleFo(async () => reply, "ask_fo", { message: "x" }, o);

test("reply envelopes: structured, wrapped, JSON text, string-encoded and plain text all decode", async () => {
  const shapes: any[] = [
    { structuredContent: { status: "complete", response: "A" } },
    { structuredContent: { result: { status: "complete", response: "A" } } },
    { structuredContent: { structuredContent: { data: { response: "A" } } } },
    text(JSON.stringify({ status: "complete", response: "A" })),
    text(JSON.stringify({ result: { response: "A" } })),
    text(JSON.stringify({ structuredContent: JSON.stringify({ reply: "A" }) })),
    // Unusable structuredContent falls back to the text block.
    { structuredContent: { unrelated: 1 }, ...text('{"response":"A"}') },
    text("A"),
  ];
  for (const shape of shapes) {
    const r = await settle(shape);
    assert.equal(r.content[0]?.text, "A", JSON.stringify(shape));
    assert.equal(r.structuredContent.status, "complete");
    assert.equal(r.isError, false);
  }
});

test("empty, malformed or unreadable replies are never reported as completion", async () => {
  for (const reply of [
    {},
    { content: [] },
    text(""),
    text("   "),
    text("{not json"),
    text("[1,2]"),
    { structuredContent: { status: "complete", response: "  " } },
    { structuredContent: { status: "complete", conversationId: "h" } },
    null,
  ])
    await assert.rejects(
      () => settle(reply),
      /no readable reply/,
      JSON.stringify(reply),
    );
  await assert.rejects(
    () => settle({ structuredContent: { status: "mystery", response: "ok" } }),
    /does not recognize/,
  );
});

test("failures keep their text and isError without a status", async () => {
  const a = await settle(text("Fo could not reach the studio.", true));
  assert.equal(a.isError, true);
  assert.equal(a.structuredContent.status, "failed");
  assert.match(a.content[0]!.text, /studio/);
  const b = await settle({
    isError: true,
    structuredContent: { error: { message: "nope" } },
  });
  assert.equal(b.content[0]?.text, "nope");
  const c = await settle({ structuredContent: { status: "FAILED" } });
  assert.equal(c.isError, true);
  assert.ok(c.content[0]!.text.length > 0);
});

test("budget exhaustion is flagged only on failures", async () => {
  const failed = await settle({
    structuredContent: {
      status: "failed",
      response: "You have run out of credits for this month.",
    },
  });
  assert.equal((failed.structuredContent as any).reason, "budget");
  const fine = await settle({
    structuredContent: {
      status: "complete",
      response: "Credit card perks are listed here; the budget was reached.",
    },
  });
  assert.equal((fine.structuredContent as any).reason, undefined);
});

test("a follow-up question from Fo is its own status, not completion or failure", async () => {
  for (const s of ["needs_input", "awaiting-user", "Input Required"]) {
    const r = await settle({
      structuredContent: { status: s, response: "Which date works?" },
    });
    assert.equal(r.structuredContent.status, "needs_answer");
    assert.equal(r.isError, false);
    assert.equal(r.content[0]?.text, "Which date works?");
  }
});

test("working states: aliases poll, handle carries forward, progress callback errors are harmless", async () => {
  const seen: unknown[] = [];
  const replies: any[] = [
    {
      structuredContent: {
        status: "in_progress",
        conversation_id: "h1",
        progress: "Step 1",
      },
    },
    { structuredContent: { status: "Running" } },
    { structuredContent: { status: "completed", response: "Done" } },
  ];
  const progress: string[] = [];
  const r = await settleFo(
    async (_n, a) => {
      seen.push(a.conversationId);
      return replies.shift();
    },
    "ask_fo",
    {},
    {
      onProgress: async (p) => {
        progress.push(p);
        throw new Error("disk full");
      },
    },
  );
  assert.deepEqual(seen, [undefined, "h1", "h1"]);
  assert.deepEqual(progress, ["Step 1", "Fo is working on your request."]);
  assert.equal(r.content[0]?.text, "Done");
});

test("a follow-up polls with the handle it was sent even if replies omit it", async () => {
  const ids: unknown[] = [];
  const replies: any[] = [
    { structuredContent: { status: "working" } },
    { structuredContent: { status: "complete", response: "ok" } },
  ];
  await settleFo(
    async (_n, a) => {
      ids.push(a.conversationId);
      return replies.shift();
    },
    "ask_fo",
    { conversationId: "mine" },
  );
  assert.deepEqual(ids, ["mine", "mine"]);
});

test("uncertain states: no handle, polling transport error, max polls", async () => {
  await assert.rejects(
    () => settle({ structuredContent: { status: "working" } }),
    /without a conversation handle/,
  );
  let n = 0;
  const e = await settleFo(
    async () => {
      if (n++ === 0)
        return {
          structuredContent: { status: "working", conversationId: "h" },
        };
      throw new NotSubmittedError("Fo isn't connected. Not sent.");
    },
    "ask_fo",
    {},
  ).catch((x) => x);
  // After acceptance a disconnect is uncertain, so it must not be a typed "not sent" error.
  assert.ok(!(e instanceof NotSubmittedError));
  assert.match(e.message, /Check Fo activity/);
  let polls = 0;
  await assert.rejects(
    () =>
      settleFo(
        async () => {
          polls++;
          return {
            structuredContent: { status: "working", conversationId: "h" },
          };
        },
        "ask_fo",
        {},
        { maxPolls: 3 },
      ),
    /still working/,
  );
  assert.equal(polls, 4);
});

test("an error on the first call stays definite when nothing was sent", async () => {
  await assert.rejects(
    () =>
      settleFo(
        async () => {
          throw new NotSubmittedError("not sent");
        },
        "ask_fo",
        {},
      ),
    (e) => e instanceof NotSubmittedError,
  );
});
