import { chmod, mkdir, open, readFile, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import type { JsonSchemaType } from "@modelcontextprotocol/sdk/validation";

export class ActionError extends Error {}
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
  status: "running" | "returned" | "failed" | "unknown";
  startedAt: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  progress?: string;
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

// Compile the live discovered schema; schema/validation errors never expose arguments.
export function validateToolArguments(
  schema: JsonSchemaType,
  args: Record<string, unknown>,
) {
  try {
    if (new AjvJsonSchemaValidator().getValidator(schema)(args).valid) return;
  } catch {}
  throw new ActionError(
    "The proposed arguments do not match this Fo tool. Ask Pact for a fresh proposal.",
  );
}

export class ActionStore {
  private data: Journal = { version: 1, plans: [], runs: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(private path: string) {}
  static async load(path: string | URL) {
    const store = new ActionStore(
      path instanceof URL ? fileURLToPath(path) : path,
    );
    try {
      if ((await stat(store.path)).size > MAX_BYTES)
        throw new Error("oversize");
      const parsed = JSON.parse(await readFile(store.path, "utf8"));
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.plans) ||
        !Array.isArray(parsed.runs) ||
        parsed.plans.length > LIMIT ||
        parsed.runs.length > LIMIT
      )
        throw new Error("invalid");
      store.data = parsed;
      for (const run of store.data.runs)
        if (run.status === "running") {
          run.status = "unknown";
          run.error = uncertain;
          run.finishedAt = new Date().toISOString();
        }
      await store.persist(store.data);
    } catch (e) {
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
        "The local action journal is full. No new action was submitted.",
      );
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(json);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, this.path);
    await chmod(this.path, 0o600);
    const directory = await open(dirname(this.path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
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
          "The action journal is full. No new proposal was saved.",
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
  async progress(planId: string, text: string) {
    await this.transaction((data) => {
      const run = data.runs.find((r) => r.planId === planId);
      if (run?.status === "running") run.progress = text.slice(0, 1000);
    });
  }
  async approve(
    planId: string,
    options: {
      pactId?: string;
      contextHash?: string;
      validate: (plan: Plan) => void;
      execute: (plan: Plan) => Promise<ToolResult>;
    },
  ): Promise<Run> {
    const decision = await this.transaction((data) => {
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
          "This proposal belongs to an earlier intention. Review a fresh next step.",
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
          "The action journal is full. No new action was submitted.",
        );
      options.validate(plan);
      const run: Run = {
        runId: randomUUID(),
        planId,
        status: "running",
        startedAt: new Date().toISOString(),
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
      outcome =
        result.isError === true
          ? {
              status: "failed",
              error:
                "Fo reported an error. Check Fo activity for details before trying again.",
            }
          : {
              status: "returned",
              result:
                rendered.length > 32768
                  ? `${rendered.slice(0, 32700)}\n[Response shortened. Inspect Fo activity for the full result.]`
                  : rendered,
            };
    } catch {
      outcome = { status: "unknown", error: uncertain };
    }
    await this.transaction((data) => {
      const run = data.runs.find((r) => r.runId === runId);
      if (run)
        Object.assign(run, outcome, { finishedAt: new Date().toISOString() });
    });
  }
}
