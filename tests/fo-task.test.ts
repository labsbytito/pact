import { test } from "node:test";
import assert from "node:assert/strict";
import { settleFo } from "../backend/lib/fo-task";
test("working Fo requests are polled to their real response without exposing handles", async () => {
  const calls: any[] = [];
  const progress: string[] = [];
  const result = await settleFo(
    async (name, args) => {
      calls.push({ name, args });
      return calls.length === 1
        ? {
            structuredContent: {
              status: "working",
              conversationId: "private-handle",
              progress: "Researching studios",
            },
          }
        : {
            structuredContent: {
              status: "complete",
              conversationId: "private-handle",
              response: "Here are public studio links.",
            },
          };
    },
    "ask_fo",
    { message: "Research only" },
    {
      onProgress: async (p) => {
        progress.push(p);
      },
    },
  );
  assert.equal(calls[1].name, "get_fo_reply");
  assert.equal(calls[1].args.conversationId, "private-handle");
  assert.deepEqual(progress, ["Researching studios"]);
  assert.equal(result.content[0]?.text, "Here are public studio links.");
  assert.ok(!JSON.stringify(result).includes("private-handle"));
});
test("Fo failures stay failures", async () => {
  const result = await settleFo(
    async () => ({
      structuredContent: { status: "failed", response: "No supported result." },
    }),
    "ask_fo",
    {},
  );
  assert.equal(result.isError, true);
});
test("unsettled Fo task never becomes a claimed completion", async () => {
  await assert.rejects(
    () =>
      settleFo(
        async () => ({
          structuredContent: { status: "working", conversationId: "hidden" },
        }),
        "ask_fo",
        {},
        { maxPolls: 1 },
      ),
    /still working/,
  );
});
