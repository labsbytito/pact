import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { writeJournalFile } from "./actions-file";

export { validateToolArguments } from "./actions-schema";

export class ActionError extends Error {}
// Thrown only before anything reached Fo, so the run is a definite failure rather than uncertain.
export class NotSubmittedError extends ActionError {}
/** The request was accepted and is still running. The journal stays `running` for a later poll. */
export class DeferredRun extends Error {
  constructor(
    public progress: string,
    public conversationId?: string,
  ) {
    super(progress);
    this.name = "DeferredRun";
  }
}
export type PlanInput = {
  title: string;
  instruction: string;
  toolName: string;
  arguments: Record<string, unknown>;
  pactId?: string;
  contextHash: string;
};
export type Plan = PlanInput & {
  planId: string;
  expires: number;
  runId?: string;
  invalidated?: boolean;
};
export type Run = {
  runId: string;
  planId: string;
  status: "running" | "returned" | "needs_answer" | "failed" | "unknown";
  startedAt: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  progress?: string;
  requestId?: string;
  conversationId?: string;
  polls?: number;
};
type JournalAdapter = {
  read: () => Promise<string | null>;
  write: (json: string) => Promise<void>;
};
type Journal = { version: 1; plans: Plan[]; runs: Run[] };
type ToolResult = {
  [key: string]: unknown;
  isError?: unknown;
  content?: unknown;
  structuredContent?: unknown;
};
const LIMIT = 500,
  MAX_BYTES = 16 * 1024 * 1024,
  RETENTION = 30 * 86400000;
const uncertain =
  "Fo may have received this action. Check Fo activity before creating another request.";

export class ActionStore {
  private data: Journal = { version: 1, plans: [], runs: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(
    private path: string,
    private adapter?: JournalAdapter,
  ) {}
  static async load(
    path: string | URL,
    adapter?: JournalAdapter,
    options?: { keepRunning?: boolean },
  ) {
    const store = new ActionStore(
      path instanceof URL ? fileURLToPath(path) : path,
      adapter,
    );
    try {
      let raw: string | null;
      if (adapter) {
        raw = await adapter.read();
        if (raw == null || raw === "") return store;
      } else {
        if ((await stat(store.path)).size > MAX_BYTES) throw new Error("oversize");
        raw = await readFile(store.path, "utf8");
      }
      const parsed = JSON.parse(raw);
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.plans) ||
        !Array.isArray(parsed.runs) ||
        parsed.plans.length > LIMIT ||
        parsed.runs.length > LIMIT
      )
        throw new Error("invalid");
      store.data = parsed;
      if (!options?.keepRunning) {
        for (const run of store.data.runs)
          if (run.status === "running") {
            run.status = "unknown";
            run.error = uncertain;
            run.finishedAt = new Date().toISOString();
          }
      }
      await store.persist(store.data);
    } catch (e) {
      if (adapter) {
        if (e instanceof ActionError) throw e;
        throw new ActionError(
          "The action journal could not be recovered. No new actions will be submitted.",
        );
      }
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new ActionError(
          "The action journal could not be recovered. No new actions will be submitted. Preserve .local/actions.json for recovery.",
        );
    }
    return store;
  }
  private async persist(data: Journal) {
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > MAX_BYTES)
      throw new ActionError(
        "Pact's history is full. Nothing was sent.",
      );
    if (this.adapter) {
      await this.adapter.write(json);
      return;
    }
    await writeJournalFile(this.path, json);
  }
  private transaction<T>(change: (next: Journal) => T): Promise<T> {
    const task = this.queue.then(async () => {
      const next = structuredClone(this.data);
      const value = change(next);
      await this.persist(next);
      this.data = next;
      return value;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  private prune(data: Journal) {
    const cutoff = Date.now() - RETENTION;
    // Unknown and running records are retained; admission fails rather than discarding uncertainty.
    data.runs = data.runs.filter(
      (r) =>
        r.status === "running" ||
        r.status === "unknown" ||
        Date.parse(r.finishedAt ?? r.startedAt) > cutoff,
    );
    const retained = new Set(data.runs.map((r) => r.planId));
    data.plans = data.plans.filter((p) =>
      p.runId
        ? retained.has(p.planId)
        : p.expires > Date.now() && !p.invalidated,
    );
  }
  async invalidate(pactId?: string) {
    if (!pactId) return;
    await this.transaction((data) => {
      for (const p of data.plans)
        if (p.pactId === pactId && !p.runId) p.invalidated = true;
    });
  }
  async invalidateAll() {
    await this.transaction((data) => {
      for (const p of data.plans) if (!p.runId) p.invalidated = true;
    });
  }
  async cancel(planId: string) {
    await this.transaction((data) => {
      const plan = data.plans.find((p) => p.planId === planId);
      if (plan && !plan.runId) plan.invalidated = true;
    });
  }
  async propose(input: PlanInput): Promise<Plan> {
    if (Buffer.byteLength(JSON.stringify(input)) > 64 * 1024)
      throw new ActionError(
        "This proposed action is too large. Ask Pact for a smaller next step.",
      );
    return this.transaction((data) => {
      this.prune(data);
      if (data.plans.length >= LIMIT)
        throw new ActionError(
          "Pact's history is full. Nothing was saved.",
        );
      if (input.pactId)
        for (const p of data.plans)
          if (p.pactId === input.pactId && !p.runId) p.invalidated = true;
      const plan = {
        ...structuredClone(input),
        planId: randomUUID(),
        expires: Date.now() + 15 * 60000,
      };
      data.plans.push(plan);
      return structuredClone(plan);
    });
  }
  getRun(id: string) {
    return structuredClone(this.data.runs.find((r) => r.runId === id));
  }
  getByPlan(id: string) {
    return structuredClone(this.data.runs.find((r) => r.planId === id));
  }
  getPlan(id: string) {
    return structuredClone(this.data.plans.find((p) => p.planId === id));
  }
  recentActivity(pactId?: string) {
    if (!pactId) return [];
    return this.data.plans
      .filter((plan) => plan.pactId === pactId && plan.runId)
      .slice(-3)
      .flatMap((plan) => {
        const run = this.data.runs.find((item) => item.runId === plan.runId);
        return run
          ? [
              {
                title: plan.title,
                request: plan.instruction.slice(0, 1000),
                status: run.status,
                reply: run.result?.slice(0, 4000),
                error: run.error?.slice(0, 1000),
                at: run.finishedAt ?? run.startedAt,
              },
            ]
          : [];
      });
  }
  // The Fo question awaiting the user's answer in this Pact, if its latest run asked one.
  awaitingAnswer(pactId?: string) {
    if (!pactId) return undefined;
    for (let i = this.data.plans.length - 1; i >= 0; i--) {
      const plan = this.data.plans[i];
      if (!plan || plan.pactId !== pactId || !plan.runId) continue;
      const run = this.data.runs.find((r) => r.runId === plan.runId);
      return run?.status === "needs_answer" ? run.result : undefined;
    }
  }
  async progress(planId: string, text: string) {
    await this.transaction((data) => {
      const run = data.runs.find((r) => r.planId === planId);
      if (run?.status === "running") run.progress = text.slice(0, 1000);
    });
  }
  async patchRun(runId: string, patch: Partial<Run>) {
    await this.transaction((data) => {
      const run = data.runs.find((r) => r.runId === runId);
      if (!run) return;
      Object.assign(run, patch);
      if (patch.status && patch.status !== "running")
        run.finishedAt = patch.finishedAt ?? new Date().toISOString();
    });
  }
  findByRequest(requestId: string) {
    return structuredClone(this.data.runs.find((r) => r.requestId === requestId));
  }
  async approve(
    planId: string,
    options: {
      pactId?: string;
      contextHash?: string;
      requestId?: string;
      validate: (plan: Plan) => void;
      execute: (plan: Plan) => Promise<ToolResult>;
    },
  ): Promise<Run> {
    const decision = await this.transaction((data) => {
      if (options.requestId) {
        const prior = data.runs.find((r) => r.requestId === options.requestId);
        if (prior) return { run: structuredClone(prior) };
      }
      const plan = data.plans.find((p) => p.planId === planId);
      if (!plan)
        throw new ActionError(
          "This proposal is unavailable. Ask Pact for a fresh next step.",
        );
      if (
        (options.pactId && options.pactId !== plan.pactId) ||
        (options.contextHash && options.contextHash !== plan.contextHash)
      )
        throw new ActionError(
          "This suggestion is out of date. Ask again for a new one.",
        );
      if (plan.runId) {
        const run = data.runs.find((r) => r.runId === plan.runId);
        if (!run) throw new ActionError(uncertain);
        return { run: structuredClone(run) };
      }
      if (plan.invalidated || plan.expires < Date.now())
        throw new ActionError(
          "This proposal expired or was replaced. Ask Pact for a fresh next step.",
        );
      this.prune(data);
      if (data.runs.length >= LIMIT)
        throw new ActionError(
          "Pact's history is full. Nothing was sent.",
        );
      options.validate(plan);
      const run: Run = {
        runId: randomUUID(),
        planId,
        status: "running",
        startedAt: new Date().toISOString(),
        ...(options.requestId ? { requestId: options.requestId } : {}),
      };
      plan.runId = run.runId;
      data.runs.push(run);
      return { run: structuredClone(run), plan: structuredClone(plan) };
    });
    if (decision.plan)
      void this.perform(
        decision.plan,
        decision.run.runId,
        options.execute,
      ).catch(() => {
        // A failed terminal write leaves the durable running record for restart reconciliation.
        console.error(
          "Pact could not persist an action outcome. Check Fo activity before retrying.",
        );
      });
    return decision.run;
  }
  private async perform(
    plan: Plan,
    runId: string,
    execute: (plan: Plan) => Promise<ToolResult>,
  ) {
    let outcome: Partial<Run>;
    try {
      const result = await execute(plan);
      const content = Array.isArray(result.content) ? result.content : [];
      const text = content
        .filter((x) => x && x.type === "text" && typeof x.text === "string")
        .map((x) => x.text)
        .join("\n");
      const rendered =
        text ||
        JSON.stringify(
          result.structuredContent ?? {
            message:
              "Fo returned no text. Inspect Fo activity for the outcome.",
          },
        );
      const shortened =
        rendered.length > 32768
          ? `${rendered.slice(0, 32700)}\n[Response shortened. Inspect Fo activity for the full result.]`
          : rendered;
      const state = (result.structuredContent as any)?.status;
      const reason = (result.structuredContent as any)?.reason;
      outcome =
        result.isError === true
          ? {
              status: "failed",
              error:
                reason === "budget"
                  ? `Fo's credits or budget look exhausted, so it could not do this. Fo said: ${text.slice(0, 500)}`
                  : text
                    ? `Fo reported an error: ${text.slice(0, 500)}`
                    : "Fo reported an error. Check Fo activity for details before trying again.",
            }
          : state === "needs_answer"
            ? { status: "needs_answer", result: shortened }
            : { status: "returned", result: shortened };
    } catch (e) {
      outcome =
        e instanceof DeferredRun
          ? {
              status: "running",
              progress: e.progress.slice(0, 1000),
              ...(e.conversationId ? { conversationId: e.conversationId } : {}),
            }
          : e instanceof NotSubmittedError
            ? { status: "failed", error: e.message }
            : { status: "unknown", error: uncertain };
    }
    await this.transaction((data) => {
      const run = data.runs.find((r) => r.runId === runId);
      if (!run) return;
      Object.assign(run, outcome);
      if (outcome.status !== "running")
        run.finishedAt = new Date().toISOString();
    });
  }
}
