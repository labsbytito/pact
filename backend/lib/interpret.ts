import { createHash } from "node:crypto";
import { z } from "zod";
import type { JsonSchemaType } from "@modelcontextprotocol/sdk/validation";
import {
  ActionError,
  ActionStore,
  validateToolArguments,
} from "./actions";
import {
  AiError,
  askClaude,
  askClaudeStream,
  aiReady,
  canStream,
  parseModelReply,
  type ClaudeImage,
} from "./ai";
import { aiMocked } from "./env";
import { decideTool, consequentialToolsEnabled } from "./fo-policy";
import { guardMessage, qualifiesForBypass } from "./intent";
import { jsonSystemPrompt, streamSystemPrompt } from "./interpret-prompt";
import { mockRaw } from "./mock";
import { sourceSchema } from "./source";
import { splitStreamReply, streamReplyDelta } from "./stream-parse";

const attachmentSchema = z.object({
  name: z.string().min(1).max(120),
  mime: z.string().min(3).max(80),
  kind: z.enum(["text", "image"]),
  text: z.string().max(24000).optional(),
  data: z.string().max(550000).optional(),
});

export const interpretInput = z.object({
  responseStyle: z.enum(["short", "detailed"]).optional(),
  askBefore: z.enum(["suggested", "always"]).optional(),
  pact: z.object({
    id: z.string().uuid().optional(),
    intention: z.string().min(1).max(8000),
    source: sourceSchema.optional(),
    messages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(12000) }))
      .max(100),
    attachments: z.array(attachmentSchema).max(3).optional(),
  }),
});

export type InterpretPact = z.infer<typeof interpretInput>["pact"];
type Proposal = {
  reply: string;
  title?: string;
  action?: {
    title: string;
    instruction: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
};
type Tool = { name: string; description?: string; inputSchema?: Record<string, unknown> };

const proposal = z.object({
  reply: z.string().min(1).max(12000),
  title: z.string().max(90).optional(),
  action: z
    .object({
      title: z.string().max(120),
      instruction: z.string().max(4000),
      toolName: z.string(),
      arguments: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

const thinking = new Set<string>();

export function holdPact(id?: string) {
  if (!id) return () => {};
  if (thinking.has(id)) {
    const error = new AiError("Pact is still working on your last message. Give it a moment.", 409);
    throw error;
  }
  thinking.add(id);
  return () => thinking.delete(id);
}

function payload(pact: InterpretPact, actions: ActionStore, tools: Tool[]) {
  const consequentialEnabled = consequentialToolsEnabled();
  const available = tools.filter((tool) => decideTool(tool.name, consequentialEnabled) !== "deny");
  const foQuestion = actions.awaitingAnswer(pact.id);
  const images: ClaudeImage[] = (pact.attachments ?? [])
    .filter(
      (item) =>
        item.kind === "image" &&
        !!item.data &&
        ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(item.mime),
    )
    .map((item) => ({ mime: item.mime as ClaudeImage["mime"], data: item.data! }));
  const content = JSON.stringify({
    userIntention: pact.intention,
    currentRequest: pact.messages.filter((m) => m.role === "user").at(-1)?.text,
    foActivity: actions.recentActivity(pact.id),
    pageContext: pact.source,
    conversation: pact.messages.slice(-24),
    ...(foQuestion ? { foQuestion } : {}),
  });
  return { available, foQuestion, images, content, consequentialEnabled };
}

export async function finalizeProposal(
  pact: InterpretPact,
  model: unknown,
  available: Tool[],
  foQuestion: unknown,
  actions: ActionStore,
  askBefore?: "suggested" | "always",
) {
  const record = model && typeof model === "object" ? (model as Record<string, unknown>) : {};
  const checked = proposal.safeParse(model);
  const loose = proposal.pick({ reply: true, title: true }).safeParse(model);
  const parsed: Proposal | undefined = checked.success
    ? checked.data
    : loose.success
      ? { reply: loose.data.reply, title: loose.data.title }
      : undefined;
  if (!parsed)
    throw new AiError("Claude’s reply wasn’t in a usable form. Please send that again. Your Pact is saved.", 502);
  let withheld = !checked.success && !!record.action;
  let policyWithheld = false;
  const consequentialEnabled = consequentialToolsEnabled();
  if (parsed.action) {
    const tool = available.find((item) => item.name === parsed.action!.toolName);
    const decision = decideTool(parsed.action.toolName, consequentialEnabled);
    if (decision === "deny") {
      delete parsed.action;
      withheld = true;
      policyWithheld = true;
    } else {
      try {
        if (!tool?.inputSchema || (foQuestion && parsed.action.toolName !== "ask_fo"))
          throw new ActionError("unavailable");
        validateToolArguments(tool.inputSchema as JsonSchemaType, parsed.action.arguments);
      } catch {
        delete parsed.action;
        withheld = true;
      }
    }
  }
  if (policyWithheld)
    parsed.reply += "\n\n(That would place a real call or use an unfamiliar Fo tool, so nothing was proposed.)";
  else if (withheld)
    parsed.reply += "\n\n(I couldn’t prepare that action safely, so nothing was proposed.)";
  if (!parsed.action) return parsed;
  const latest = [...pact.messages].reverse().find((item) => item.role === "user")?.text ?? "";
  const consequential = decideTool(parsed.action.toolName, consequentialEnabled) === "confirm";
  const rawMessage = typeof parsed.action.arguments.message === "string" ? parsed.action.arguments.message : "";
  const explicit =
    parsed.action.toolName === "ask_fo" &&
    qualifiesForBypass({
      latest,
      toolName: parsed.action.toolName,
      message: rawMessage,
      consequential,
      askBefore,
    });
  if (parsed.action.toolName === "ask_fo") {
    const guarded = guardMessage(explicit ? latest : rawMessage);
    parsed.action.arguments = { ...parsed.action.arguments, message: guarded };
    parsed.action.instruction = guarded;
  }
  const contextHash = createHash("sha256").update(JSON.stringify(pact)).digest("hex");
  const plan = await actions.propose({ ...parsed.action, pactId: pact.id, contextHash });
  return {
    ...parsed,
    action: {
      ...parsed.action,
      ...(consequential ? { consequential: true } : {}),
      ...(explicit ? { explicit: true } : {}),
      planId: plan.planId,
      expiresAt: new Date(plan.expires).toISOString(),
      contextHash,
    },
  };
}

function modelFromStream(raw: string) {
  const { reply, meta } = splitStreamReply(raw);
  if (!reply.trim())
    throw new AiError("Claude’s reply wasn’t in a usable form. Please send that again. Your Pact is saved.", 502);
  const base = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
  return { reply, ...base };
}

async function* chunks(system: string, content: string, images: ClaudeImage[], signal: AbortSignal, latest: string) {
  if (aiMocked()) {
    const raw = mockRaw(latest);
    const reply = raw.split("\n")[0] ?? raw;
    const pace = Number(process.env.PACT_MOCK_PACE_MS || 0);
    for (const word of reply.split(" ")) {
      if (pace > 0) await new Promise((resolve) => setTimeout(resolve, pace));
      yield { type: "delta" as const, text: `${word} ` };
    }
    yield { type: "done" as const, raw };
    return;
  }
  yield* askClaudeStream(system, content, images, signal);
}

export async function runInterpretation(options: {
  pact: InterpretPact;
  actions: ActionStore;
  tools: Tool[];
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  responseStyle?: "short" | "detailed";
  askBefore?: "suggested" | "always";
}) {
  if (!aiMocked() && !aiReady())
    throw new AiError("Replies are unavailable right now. Your Pact is saved.", 503);
  await options.actions.invalidate(options.pact.id);
  const latest = options.pact.messages.filter((item) => item.role === "user").at(-1)?.text ?? options.pact.intention;
  const packed = payload(options.pact, options.actions, options.tools);
  if (!options.onDelta && !aiMocked() && !canStream()) {
    const raw = await askClaude(jsonSystemPrompt(packed.available, packed.foQuestion, options.responseStyle), packed.content, packed.images);
    return finalizeProposal(options.pact, parseModelReply(raw), packed.available, packed.foQuestion, options.actions, options.askBefore);
  }
  const abort = new AbortController();
  options.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  let buffer = "";
  let emitted = 0;
  let stopped = false;
  for await (const chunk of chunks(
    streamSystemPrompt(packed.available, packed.foQuestion, options.responseStyle),
    packed.content,
    packed.images,
    abort.signal,
    latest,
  )) {
    if (chunk.type === "delta") {
      buffer += chunk.text;
      const next = streamReplyDelta(emitted, buffer);
      emitted = next.replyLength;
      if (next.emit) options.onDelta?.(next.emit);
    } else if (chunk.type === "error") throw chunk.error;
    else if (chunk.type === "done") {
      buffer = chunk.raw || buffer;
      if (abort.signal.aborted) stopped = true;
    }
  }
  const partial = splitStreamReply(buffer).reply;
  if (stopped || abort.signal.aborted) return { stopped: true as const, reply: partial };
  if (emitted < partial.length) options.onDelta?.(partial.slice(emitted));
  const done = await finalizeProposal(
    options.pact,
    modelFromStream(buffer),
    packed.available,
    packed.foQuestion,
    options.actions,
    options.askBefore,
  );
  return { stopped: false as const, ...done };
}
