import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createFoRunner, Threads } from "../backend/lib/fo-task";
import { ActionStore, NotSubmittedError } from "../backend/lib/actions";

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const dir = await mkdtemp(join(tmpdir(), "pact-fo-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const url = pathToFileURL(dir + "/");
  return { dir, url, threads: await Threads.open(url) };
}
// Fake Fo: ask_fo with newConversation mints a handle; otherwise it reuses the one sent.
function fakeFo() {
  const calls: { name: string; args: any }[] = [];
  let minted = 0;
  const call = async (name: string, args: Record<string, any>) => {
    calls.push({ name, args: { ...args } });
    const id = args.conversationId ?? `handle-${++minted}`;
    return {
      structuredContent: {
        status: "complete",
        conversationId: id,
        response: `reply to ${args.message}`,
      },
    };
  };
  return { call, calls };
}

test("follow-up continues the same Fo conversation, strangers stay separate", async (t) => {
  const { threads } = await fixture(t);
  const fo = fakeFo();
  const run = createFoRunner({ call: fo.call, threads });
  await run("ask_fo", { message: "one" }, "pact-a");
  await run("ask_fo", { message: "two" }, "pact-a");
  await run("ask_fo", { message: "other" }, "pact-b");
  assert.equal(fo.calls[0]!.args.newConversation, true);
  assert.equal(fo.calls[0]!.args.conversationId, undefined);
  assert.equal(fo.calls[1]!.args.conversationId, "handle-1");
  assert.equal(fo.calls[1]!.args.newConversation, undefined);
  assert.equal(fo.calls[2]!.args.newConversation, true);
  assert.equal(threads.get("pact-b"), "handle-2");
  assert.equal(threads.get("pact-a"), "handle-1");
});

test("concurrent asks serialize so the second sees the first handle; no duplicate sends", async (t) => {
  const { threads } = await fixture(t);
  const fo = fakeFo();
  const run = createFoRunner({ call: fo.call, threads });
  await Promise.all([
    run("ask_fo", { message: "a" }, "p"),
    run("ask_fo", { message: "b" }, "p"),
  ]);
  assert.equal(fo.calls.length, 2);
  assert.equal(fo.calls[1]!.args.conversationId, "handle-1");
});

test("model-supplied conversation ids and extra arguments cannot hijack another thread", async (t) => {
  const { threads } = await fixture(t);
  const fo = fakeFo();
  const run = createFoRunner({ call: fo.call, threads });
  await run(
    "ask_fo",
    { message: "hi", conversationId: "victim", newConversation: false, note: "keep" },
    "p",
  );
  assert.equal(fo.calls[0]!.args.conversationId, undefined);
  assert.equal(fo.calls[0]!.args.newConversation, true);
  assert.equal(fo.calls[0]!.args.note, "keep");
  assert.equal(fo.calls[0]!.args.message, "hi");
  // Non-ask tools and Pact-less calls are passed through exactly.
  await run("list_fo_conversations", { limit: 3 }, "p");
  assert.deepEqual(fo.calls[1]!.args, { limit: 3 });
});

test("reconnect isolation: forgetting drops handles, persists, and ignores late saves", async (t) => {
  const { threads, url, dir } = await fixture(t);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const slow = createFoRunner({
    call: async () => {
      await gate;
      return {
        structuredContent: {
          status: "complete",
          conversationId: "old-account-handle",
          response: "ok",
        },
      };
    },
    threads,
  });
  const inflight = slow("ask_fo", { message: "x" }, "p");
  await new Promise((r) => setTimeout(r, 5));
  await threads.forgetAll();
  release();
  await inflight;
  assert.equal(threads.get("p"), undefined);
  assert.equal(await readFile(join(dir, "fo-threads.json"), "utf8"), "{}");
  const fo = fakeFo();
  const run = createFoRunner({ call: fo.call, threads });
  await run("ask_fo", { message: "y" }, "p");
  assert.equal(fo.calls[0]!.args.newConversation, true);
  // Handles survive a process restart, with private permissions.
  const reopened = await Threads.open(url);
  assert.equal(reopened.get("p"), "handle-1");
  assert.equal((await stat(join(dir, "fo-threads.json"))).mode & 0o077, 0);
  assert.equal(reopened.get("__proto__"), undefined);
});

test("missing handle in a reply never invents one; next ask starts fresh", async (t) => {
  const { threads } = await fixture(t);
  const sent: any[] = [];
  const run = createFoRunner({
    call: async (_n, a) => {
      sent.push(a);
      return { structuredContent: { status: "complete", response: "ok" } };
    },
    threads,
  });
  await run("ask_fo", { message: "1" }, "p");
  await run("ask_fo", { message: "2" }, "p");
  assert.ok(sent.every((a) => a.newConversation === true));
});

test("a failed ask does not poison the queue and a stale-conversation failure drops the handle", async (t) => {
  const { threads } = await fixture(t);
  await threads.remember("p", "stale", threads.epoch);
  let n = 0;
  const run = createFoRunner({
    call: async () => {
      if (n++ === 0)
        return {
          isError: true,
          content: [{ type: "text", text: "Conversation not found." }],
        };
      throw new Error("socket closed");
    },
    threads,
  });
  const first = await run("ask_fo", { message: "1" }, "p");
  assert.equal(first.isError, true);
  assert.equal(threads.get("p"), undefined);
  await assert.rejects(() => run("ask_fo", { message: "2" }, "p"), /socket/);
  await assert.rejects(() => run("ask_fo", { message: "3" }, "p"), /socket/);
});

test("run lifecycle: question, budget failure, disconnect and uncertainty are distinct run states", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "pact-flow-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = await ActionStore.load(join(dir, "actions.json"));
  const base = {
    title: "Ask",
    instruction: "Ask Fo",
    toolName: "ask_fo",
    arguments: { message: "Book a table" },
    pactId: "p",
    contextHash: "a".repeat(64),
  };
  async function go(execute: () => Promise<any>) {
    const plan = await store.propose(base);
    const run = await store.approve(plan.planId, { validate() {}, execute });
    for (let i = 0; i < 200; i++) {
      const now = store.getRun(run.runId)!;
      if (now.status !== "running") return now;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error("did not finish");
  }
  const ask = await go(async () => ({
    content: [{ type: "text", text: "Which night?" }],
    structuredContent: { status: "needs_answer" },
  }));
  assert.equal(ask.status, "needs_answer");
  assert.equal(ask.result, "Which night?");
  assert.equal(store.awaitingAnswer("p"), "Which night?");
  assert.equal(store.awaitingAnswer("other"), undefined);

  const broke = await go(async () => ({
    isError: true,
    content: [{ type: "text", text: "Out of credits." }],
    structuredContent: { status: "failed", reason: "budget" },
  }));
  assert.equal(broke.status, "failed");
  assert.match(broke.error!, /credits or budget/);
  assert.equal(store.awaitingAnswer("p"), undefined);

  const gone = await go(async () => {
    throw new NotSubmittedError("Fo isn't connected. This request was not sent.");
  });
  assert.equal(gone.status, "failed");
  assert.match(gone.error!, /not sent/);

  const lost = await go(async () => {
    throw new Error("socket hang up with secret-detail");
  });
  assert.equal(lost.status, "unknown");
  assert.ok(!lost.error!.includes("secret-detail"));
});

test("progress survives into the final run record", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "pact-prog-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = await ActionStore.load(join(dir, "actions.json"));
  const plan = await store.propose({
    title: "t",
    instruction: "i",
    toolName: "ask_fo",
    arguments: { message: "m" },
    pactId: "p",
    contextHash: "b".repeat(64),
  });
  const run = await store.approve(plan.planId, {
    validate() {},
    async execute(p) {
      await store.progress(p.planId, "Searching public sources");
      throw new Error("still working");
    },
  });
  for (let i = 0; i < 200 && store.getRun(run.runId)!.status === "running"; i++)
    await new Promise((r) => setTimeout(r, 5));
  const done = store.getRun(run.runId)!;
  assert.equal(done.status, "unknown");
  assert.equal(done.progress, "Searching public sources");
});
