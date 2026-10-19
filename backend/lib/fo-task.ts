import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";

type ThreadStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};
type ToolReply = {
  content?: unknown;
  structuredContent?: unknown;
  isError?: unknown;
  [key: string]: unknown;
};
type Caller = (
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolReply>;
export type FoStatus = "complete" | "failed" | "needs_answer";

// Per-Pact Fo conversation handles. Private: never returned to the client or logged.
export class Threads {
  private map: Record<string, string> = {};
  private writing: Promise<void> = Promise.resolve();
  // Bumped whenever all handles are dropped, so an in-flight ask cannot re-save a handle afterwards.
  epoch = 0;
  private constructor(private write: (json: string) => Promise<void>) {}
  private async hydrate(read: () => Promise<string | null>) {
    try {
      const raw = await read();
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === "object")
        for (const [k, v] of Object.entries(saved))
          if (typeof v === "string") this.map[k] = v;
    } catch {
      /* a missing record starts empty */
    }
  }
  static async open(directory: URL) {
    const file = new URL("fo-threads.json", directory);
    const threads = new Threads(async (json) => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temp = new URL(`fo-threads.${randomUUID()}.tmp`, directory);
      await writeFile(temp, json, { mode: 0o600 });
      await rename(temp, file);
    });
    await threads.hydrate(async () => {
      try {
        return await readFile(file, "utf8");
      } catch {
        return null;
      }
    });
    return threads;
  }
  static async openStore(store: ThreadStore, key: string) {
    const threads = new Threads((json) => store.set(key, json));
    await threads.hydrate(() => store.get(key));
    return threads;
  }
  get(pactId: string) {
    return Object.hasOwn(this.map, pactId) ? this.map[pactId] : undefined;
  }
  private persist() {
    const w = this.writing.catch(() => {}).then(() => this.write(JSON.stringify(this.map)));
    this.writing = w;
    return w;
  }
  async remember(pactId: string, id: string, epoch: number) {
    if (epoch !== this.epoch || this.get(pactId) === id) return;
    this.map[pactId] = id;
    await this.persist();
  }
  async forget(pactId: string) {
    if (this.get(pactId) === undefined) return;
    delete this.map[pactId];
    await this.persist();
  }
  async forgetAll() {
    this.epoch++;
    this.map = {};
    await this.persist();
  }
}

const KEYS = [
  "status",
  "response",
  "reply",
  "answer",
  "error",
  "conversationId",
  "conversation_id",
  "conversations",
  "turns",
];
const WRAPPERS = ["structuredContent", "result", "data", "output"];
const isObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const meaningful = (v: unknown) =>
  isObject(v) && KEYS.some((k) => v[k] !== undefined);
// Accepts a bare object, a JSON string, or the same wrapped one or two levels deep.
function unwrap(v: unknown, depth = 0): Record<string, any> | undefined {
  if (typeof v === "string" && /^\s*[{]/.test(v)) {
    try {
      v = JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  if (!isObject(v) || depth > 3) return undefined;
  if (meaningful(v)) return v;
  for (const key of WRAPPERS) {
    const inner = unwrap(v[key], depth + 1);
    if (inner) return inner;
  }
  return undefined;
}
function textOf(v: unknown): string | undefined {
  const s = typeof v === "string" ? v : isObject(v) ? v.message : undefined;
  return typeof s === "string" && s.trim() ? s : undefined;
}
export function decodeFoReply(reply: ToolReply): Record<string, any> {
  const text = Array.isArray(reply?.content)
    ? reply.content
        .filter((x) => x?.type === "text" && typeof x.text === "string")
        .map((x) => x.text)
        .join("\n")
    : "";
  const data =
    unwrap(reply?.structuredContent) ??
    unwrap(text) ??
    (text.trim() && !/^\s*[{[]/.test(text) ? { response: text } : {});
  const out = { ...data };
  if (reply?.isError === true && out.status === undefined)
    out.status = "failed";
  if (reply?.isError === true && textOf(out.response) === undefined) {
    const fallback = textOf(out.error) ?? (text.trim() || undefined);
    if (fallback) out.response = fallback;
  }
  return out;
}
const status = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
const WORKING = new Set([
  "working",
  "running",
  "pending",
  "queued",
  "in_progress",
  "processing",
  "started",
]);
const DONE = new Set(["complete", "completed", "done", "success", "succeeded"]);
const FAILED = new Set([
  "failed",
  "error",
  "errored",
  "cancelled",
  "canceled",
  "rejected",
]);
const ASKING = new Set([
  "needs_input",
  "needs_user_input",
  "needs_answer",
  "needs_clarification",
  "awaiting_user",
  "awaiting_input",
  "awaiting_answer",
  "waiting_for_user",
  "waiting_for_input",
  "input_required",
  "requires_input",
]);
const BUDGET =
  /\b(insufficient|exhausted|out of|no (?:remaining |more )?|run out of)\s*(credits?|balance|budget|funds|grant)|\b(credits?|budget|quota|usage limit|grant)\b.{0,40}\b(exhausted|exceeded|reached|depleted|insufficient|used up)/i;
const uncertain = (why: string) =>
  new Error(`${why} Check Fo activity before trying again.`);

export async function settleFo(
  call: Caller,
  name: string,
  args: Record<string, unknown>,
  options: {
    onProgress?: (text: string) => Promise<void>;
    maxPolls?: number;
    onConversation?: (id: string) => Promise<void>;
  } = {},
) {
  // Errors from this first call propagate untouched: a typed "not submitted" error stays definite.
  let reply = await call(name, args);
  let data = decodeFoReply(reply);
  let id: string | undefined =
    typeof args.conversationId === "string" ? args.conversationId : undefined;
  let announced: string | undefined;
  const learn = async () => {
    const found = data.conversationId ?? data.conversation_id;
    if (typeof found === "string" && found) id = found;
    if (id && id !== announced && id !== args.conversationId) {
      announced = id;
      try {
        await options.onConversation?.(id);
      } catch {}
    }
  };
  await learn();
  let polls = 0;
  while (WORKING.has(status(data.status))) {
    if (++polls > (options.maxPolls ?? 15))
      throw uncertain("Fo is still working.");
    if (!id)
      throw uncertain("Fo returned progress without a conversation handle.");
    try {
      await options.onProgress?.(
        textOf(data.progress) ?? "Fo is working on your request.",
      );
    } catch {}
    try {
      reply = await call("get_fo_reply", {
        conversationId: id,
        waitSeconds: 40,
      });
    } catch {
      // The request was already accepted, so a later transport or disconnect error is uncertain, never a clean failure.
      throw uncertain("Fo stopped answering after accepting the request.");
    }
    data = decodeFoReply(reply);
    await learn();
  }
  const s = status(data.status);
  if (s && !DONE.has(s) && !FAILED.has(s) && !ASKING.has(s))
    throw uncertain("Fo returned a status Pact does not recognize.");
  const response =
    textOf(data.response) ??
    textOf(data.reply) ??
    textOf(data.answer) ??
    textOf(data.error);
  const turns = Array.isArray(data.turns)
    ? data.turns
        .filter((t: any) => isObject(t) && typeof t.text === "string")
        .map((t: any) => `${t.role ?? "fo"}: ${t.text}`)
        .join("\n")
    : "";
  // Internal conversation handles are never rendered in the client or public trace.
  const text =
    response ??
    (Array.isArray(data.conversations)
      ? `Fo returned ${data.conversations.length} conversation records. Open Fo to view them.`
      : turns || undefined);
  const failed = reply?.isError === true || FAILED.has(s);
  if (!text && !failed)
    throw uncertain("Fo returned no readable reply.");
  const shown = text ?? "Fo reported an error without details.";
  const result: FoStatus = failed
    ? "failed"
    : ASKING.has(s)
      ? "needs_answer"
      : "complete";
  return {
    isError: failed,
    content: [{ type: "text", text: shown }],
    structuredContent: {
      status: result,
      ...(failed && BUDGET.test(shown) ? { reason: "budget" } : {}),
    },
  };
}

export function createFoRunner(deps: { call: Caller; threads: Threads }) {
  let queue: Promise<unknown> = Promise.resolve();
  return function run(
    name: string,
    args: Record<string, unknown>,
    pactId?: string,
    onProgress?: (text: string) => Promise<void>,
  ) {
    const execute = async () => {
      let parameters = args;
      const epoch = deps.threads.epoch;
      if (name === "ask_fo" && pactId) {
        // The approved message is sent as-is; the Pact's own handle decides the conversation, never a model-supplied id.
        const { conversationId: _a, newConversation: _b, ...rest } = args;
        const id = deps.threads.get(pactId);
        parameters = id
          ? { ...rest, conversationId: id }
          : { ...rest, newConversation: true };
      }
      const result = await settleFo(deps.call, name, parameters, {
        onProgress,
        onConversation: pactId
          ? (id) => deps.threads.remember(pactId, id, epoch)
          : undefined,
      });
      // A definite "unknown conversation" failure drops the stale handle; nothing is retried automatically.
      if (
        pactId &&
        result.isError &&
        /conversation/i.test(result.content[0]?.text ?? "") &&
        /not found|no such|unknown|invalid|expired/i.test(
          result.content[0]?.text ?? "",
        )
      )
        await deps.threads.forget(pactId).catch(() => {});
      return result;
    };
    // Fo asks must settle before another ask starts, so a follow-up always sees the previous handle.
    const next = queue.then(execute);
    queue = next.catch(() => {});
    return next;
  };
}
