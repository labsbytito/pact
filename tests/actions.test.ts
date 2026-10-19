import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ActionStore,
  validateToolArguments,
  type Run,
} from "../backend/lib/actions";

const input = {
  title: "Request details",
  instruction: "Ask the venue about access.",
  toolName: "send_message",
  arguments: { recipient: "venue@example.test", body: "Is access step-free?" },
  pactId: "test-pact",
  contextHash: "a".repeat(64),
};
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "pact-actions-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "actions.json");
  return { file, directory, store: await ActionStore.load(file) };
}
async function terminal(store: ActionStore, id: string): Promise<Run> {
  for (let i = 0; i < 100; i++) {
    const run = store.getRun(id)!;
    if (run.status !== "running") return run;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Mock action did not finish");
}

test("concurrent approvals and lost-response retry execute one immutable request", async (t) => {
  const { store, file } = await fixture(t);
  const plan = await store.propose(input);
  let calls = 0;
  let finish!: (value: { content: { type: string; text: string }[] }) => void;
  const pending = new Promise<{ content: { type: string; text: string }[] }>(
    (resolve) => {
      finish = resolve;
    },
  );
  const options = {
    validate() {},
    async execute(p: typeof plan) {
      calls++;
      assert.deepEqual(p.arguments, input.arguments);
      return pending;
    },
  };
  const [first, duplicate] = await Promise.all([
    store.approve(plan.planId, options),
    store.approve(plan.planId, options),
  ]);
  assert.equal(first.runId, duplicate.runId);
  assert.equal(calls, 1);
  assert.equal(store.getByPlan(plan.planId)?.runId, first.runId);
  const onDisk = JSON.parse(await readFile(file, "utf8"));
  assert.equal(onDisk.plans[0].runId, first.runId);
  finish({ content: [{ type: "text", text: "Mock accepted" }] });
  assert.equal((await terminal(store, first.runId)).status, "returned");
  const activity = store.recentActivity(input.pactId);
  assert.equal(activity[0]?.reply, "Mock accepted");
  assert.equal(activity[0]?.status, "returned");
  assert.deepEqual(store.recentActivity("another-pact"), []);
  assert.ok(!JSON.stringify(activity).includes(first.runId));
  assert.ok(!JSON.stringify(activity).includes("recipient"));
  const retry = await store.approve(plan.planId, {
    validate() {
      throw new Error("Must not revalidate/resubmit accepted work");
    },
    execute: options.execute,
  });
  assert.equal(retry.runId, first.runId);
  assert.equal(calls, 1);
});

test("restart preserves completed result and duplicate mapping with private file permissions", async (t) => {
  const { store, file } = await fixture(t);
  const plan = await store.propose(input);
  const run = await store.approve(plan.planId, {
    validate() {},
    async execute() {
      return { content: [{ type: "text", text: "Mock result" }] };
    },
  });
  await terminal(store, run.runId);
  const restored = await ActionStore.load(file);
  assert.equal(restored.getByPlan(plan.planId)?.result, "Mock result");
  assert.equal(
    (
      await restored.approve(plan.planId, {
        validate() {
          throw Error();
        },
        async execute() {
          throw Error();
        },
      })
    ).runId,
    run.runId,
  );
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test("restart converts interrupted action to unknown without re-execution", async (t) => {
  const { store, file } = await fixture(t);
  const plan = await store.propose(input);
  let calls = 0;
  const run = await store.approve(plan.planId, {
    validate() {},
    execute() {
      calls++;
      return new Promise(() => {});
    },
  });
  const restored = await ActionStore.load(file);
  assert.equal(restored.getRun(run.runId)?.status, "unknown");
  const duplicate = await restored.approve(plan.planId, {
    validate() {
      throw Error();
    },
    async execute() {
      calls++;
      return {};
    },
  });
  assert.equal(duplicate.status, "unknown");
  assert.equal(duplicate.runId, run.runId);
  assert.equal(calls, 1);
  assert.equal(
    (await ActionStore.load(file)).getRun(run.runId)?.status,
    "unknown",
  );
});

test("transport errors are uncertain and never expose raw exception details", async (t) => {
  const { store } = await fixture(t);
  const plan = await store.propose(input);
  const run = await store.approve(plan.planId, {
    validate() {},
    async execute() {
      throw new Error("Bearer mock-private-token");
    },
  });
  const result = await terminal(store, run.runId);
  assert.equal(result.status, "unknown");
  assert.doesNotMatch(JSON.stringify(result), /mock-private-token/);
});

test("failed durable write prevents execution", async (t) => {
  const { store, file, directory } = await fixture(t);
  const plan = await store.propose(input);
  let calls = 0;
  await rm(directory, { recursive: true });
  await writeFile(directory, "blocks creation of journal directory");
  await assert.rejects(
    store.approve(plan.planId, {
      validate() {},
      async execute() {
        calls++;
        return {};
      },
    }),
  );
  assert.equal(calls, 0);
  assert.equal(store.getByPlan(plan.planId), undefined);
});

test("cancellation survives restart, is idempotent, and cannot cancel accepted work", async (t) => {
  const { store, file } = await fixture(t);
  const plan = await store.propose(input);
  await store.cancel(plan.planId);
  await store.cancel(plan.planId);
  const restored = await ActionStore.load(file);
  await assert.rejects(
    restored.approve(plan.planId, {
      validate() {},
      async execute() {
        throw Error();
      },
    }),
    /expired or was replaced/,
  );
  const next = await restored.propose(input);
  const run = await restored.approve(next.planId, {
    validate() {},
    async execute() {
      return {};
    },
  });
  await restored.cancel(next.planId);
  await terminal(restored, run.runId);
  assert.equal(restored.getByPlan(next.planId)?.status, "returned");
});

test("source/intent binding mismatch rejects approval and new proposal supersedes old one", async (t) => {
  const { store } = await fixture(t);
  const plan = await store.propose(input);
  const options = {
    validate() {},
    async execute() {
      return {};
    },
  };
  await assert.rejects(
    store.approve(plan.planId, { ...options, contextHash: "b".repeat(64) }),
    /earlier intention/,
  );
  await assert.rejects(
    store.approve(plan.planId, { ...options, pactId: "different-pact" }),
    /earlier intention/,
  );
  await store.propose({ ...input, contextHash: "c".repeat(64) });
  await assert.rejects(
    store.approve(plan.planId, options),
    /expired or was replaced/,
  );
});

test("live input schema rejects wrong types, required fields, extras and invalid schema safely", () => {
  const schema = {
    type: "object" as const,
    required: ["recipient"],
    properties: { recipient: { type: "string" as const, format: "email" } },
    additionalProperties: false,
  };
  assert.doesNotThrow(() =>
    validateToolArguments(schema, { recipient: "venue@example.test" }),
  );
  for (const args of [
    {},
    { recipient: 3 },
    { recipient: "invalid" },
    { recipient: "venue@example.test", extra: true },
  ])
    assert.throws(() => validateToolArguments(schema, args), /do not match/);
  assert.throws(
    () => validateToolArguments({ type: "not-a-type" } as any, {}),
    /do not match/,
  );
});

test("corrupt journal fails closed instead of forgetting previous submissions", async (t) => {
  const { file } = await fixture(t);
  await writeFile(file, "incomplete journal");
  await assert.rejects(ActionStore.load(file), /could not be recovered/);
});
