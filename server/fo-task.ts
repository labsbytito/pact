import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { callFo } from "./fo";
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
const file = new URL("../.local/fo-threads.json", import.meta.url);
let threads: Record<string, string> = {};
try {
  threads = JSON.parse(await readFile(file, "utf8"));
} catch {}
async function remember(pactId: string, id: string) {
  threads[pactId] = id;
  await mkdir(new URL("../.local/", import.meta.url), {
    recursive: true,
    mode: 0o700,
  });
  const temp = new URL(
    `fo-threads.${randomUUID()}.tmp`,
    new URL("../.local/", import.meta.url),
  );
  await writeFile(temp, JSON.stringify(threads), { mode: 0o600 });
  await rename(temp, file);
}
function decoded(reply: ToolReply): Record<string, any> {
  if (reply.structuredContent && typeof reply.structuredContent === "object")
    return reply.structuredContent as Record<string, any>;
  const text = Array.isArray(reply.content)
    ? reply.content
        .filter((x) => x?.type === "text")
        .map((x) => x.text ?? "")
        .join("\n")
    : "";
  try {
    return JSON.parse(text);
  } catch {
    return { response: text };
  }
}
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
  let reply = await call(name, args);
  let data = decoded(reply);
  let polls = 0;
  if (typeof data.conversationId === "string")
    await options.onConversation?.(data.conversationId);
  while (data.status === "working") {
    if (++polls > (options.maxPolls ?? 15))
      throw new Error(
        "Fo is still working. Check Fo activity before trying again.",
      );
    const id = data.conversationId;
    if (typeof id !== "string")
      throw new Error("Fo returned progress without a conversation handle.");
    await options.onProgress?.(
      typeof data.progress === "string"
        ? data.progress
        : "Fo is working on your request.",
    );
    reply = await call("get_fo_reply", { conversationId: id, waitSeconds: 40 });
    data = decoded(reply);
  }
  const response =
    typeof data.response === "string"
      ? data.response
      : typeof data.error === "string"
        ? data.error
        : undefined;
  // Internal conversation handles are never rendered in the client or public trace.
  const text =
    response ??
    (Array.isArray(data.conversations)
      ? `Fo returned ${data.conversations.length} conversation records. Open Fo to view them.`
      : Array.isArray(data.turns)
        ? data.turns.map((t: any) => `${t.role}: ${t.text}`).join("\n")
        : "Fo returned a response. Check Fo activity for its details.");
  return {
    isError: reply.isError === true || data.status === "failed",
    content: [{ type: "text", text }],
    structuredContent: { status: data.status ?? "complete" },
  };
}
let queue: Promise<unknown> = Promise.resolve();
export function runFoAction(
  name: string,
  args: Record<string, unknown>,
  pactId?: string,
  onProgress?: (text: string) => Promise<void>,
) {
  const execute = () => {
    let parameters = args;
    if (name === "ask_fo" && pactId)
      parameters = threads[pactId]
        ? { message: args.message, conversationId: threads[pactId] }
        : { message: args.message, newConversation: true };
    return settleFo(
      async (n, a) => (await callFo(n, a)) as ToolReply,
      name,
      parameters,
      {
        onProgress,
        onConversation: pactId ? (id) => remember(pactId, id) : undefined,
      },
    );
  };
  // Fo asks must settle before another ask starts. Each Pact keeps a private thread handle.
  const run = queue.then(execute);
  queue = run.catch(() => {});
  return run;
}
