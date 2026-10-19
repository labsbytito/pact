import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ActionError,
  ActionStore,
  DeferredRun,
  validateToolArguments,
  type Plan,
  type Run,
} from "./actions";
import { decryptString, encryptString } from "./crypto";
import { aiMocked, foKeyBytes, foMocked, publicBase } from "./env";
import { createFoConnection, type FoTool } from "./fo";
import { consequentialToolsEnabled, toolSendBlock } from "./fo-policy";
import { settleFo, Threads } from "./fo-task";
import type { JsonSchemaType } from "@modelcontextprotocol/sdk/validation";
import { MOCK_TOOLS, mockResult } from "./mock";
import { openStore, type Store } from "./store";

type FoConn = Awaited<ReturnType<typeof createFoConnection>>;
type Session = {
  id: string;
  actions: ActionStore;
  threads: Threads;
  fo?: FoConn;
};

const sessions = new Map<string, Promise<Session>>();
const root = fileURLToPath(new URL("..", import.meta.url));

async function connectFo(id: string, store: Store, redirectUrl: string): Promise<FoConn> {
  const directory = new URL(`file://${join(root, ".local", "installs", id)}/`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const sealed = await store.get(`fo:${id}`);
  if (sealed) await writeFile(new URL("fo.json", directory), sealed, { mode: 0o600 });
  const key = foKeyBytes();
  return createFoConnection({
    directory,
    redirectUrl,
    seal: async (json) => {
      const hidden = encryptString(json, key);
      await store.set(`fo:${id}`, hidden);
      return hidden;
    },
    open: (raw) => Promise.resolve(decryptString(raw, key)),
    createClient: () => new Client({ name: "pact", version: "0.2.0" }) as never,
    createTransport: (url, authProvider) =>
      new StreamableHTTPClientTransport(url, { authProvider }) as never,
  });
}

export async function sessionFor(installId: string, req?: Request) {
  const store = openStore();
  let pending = sessions.get(installId);
  if (!pending) {
    pending = (async () => {
      const directory = new URL(`file://${join(root, ".local", "installs", installId)}/`);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const actions = await ActionStore.load(
        join(root, ".local", "installs", installId, "actions.json"),
        {
          read: () => store.get(`journal:${installId}`),
          write: (json) => store.set(`journal:${installId}`, json),
        },
        { keepRunning: true },
      );
      const threads = await Threads.open(directory);
      const fo = foMocked()
        ? undefined
        : await connectFo(installId, store, `${publicBase(req)}/api/fo/callback`);
      return { id: installId, actions, threads, fo };
    })();
    sessions.set(installId, pending);
  }
  return pending;
}

export function toolsFor(session: Session): FoTool[] {
  if (foMocked()) return MOCK_TOOLS as FoTool[];
  return session.fo?.status().tools ?? [];
}

export function foLabel(session: Session): "signed in" | "needs reconnect" | "signed out" {
  if (foMocked()) return "signed in";
  const status = session.fo?.status();
  if (status?.fo) return "signed in";
  if (status?.needsReconnect) return "needs reconnect";
  return "signed out";
}

function latestMessage(plan: Plan) {
  return typeof plan.arguments.message === "string" ? plan.arguments.message : plan.instruction;
}

export async function approveHeld(
  session: Session,
  body: {
    planId: string;
    pactId?: string;
    contextHash?: string;
    requestId?: string;
    confirmConsequential?: boolean;
  },
) {
  const tools = toolsFor(session);
  return session.actions.approve(body.planId, {
    ...body,
    validate(plan) {
      if (!foMocked() && !session.fo?.status().fo)
        throw new ActionError("Connect Fo before approving this action.");
      const tool = tools.find((item) => item.name === plan.toolName);
      if (!tool?.inputSchema)
        throw new ActionError("This Fo tool is no longer available. Ask Pact for a fresh proposal.");
      const block = toolSendBlock(
        plan.toolName,
        body.confirmConsequential,
        consequentialToolsEnabled(),
      );
      if (block) throw new ActionError(block);
      validateToolArguments(tool.inputSchema as JsonSchemaType, plan.arguments);
    },
    execute: async (plan) => {
      if (foMocked()) {
        const epoch = session.threads.epoch;
        const existing = plan.pactId ? session.threads.get(plan.pactId) : undefined;
        const conversationId = existing ?? `demo-${plan.pactId ?? plan.planId}`;
        if (plan.pactId && !existing)
          await session.threads.remember(plan.pactId, conversationId, epoch);
        throw new DeferredRun("Asking Fo…", conversationId);
      }
      if (!session.fo) throw new ActionError("Connect Fo before approving this action.");
      const epoch = session.threads.epoch;
      let args = plan.arguments;
      if (plan.toolName === "ask_fo" && plan.pactId) {
        const { conversationId: _a, newConversation: _b, ...rest } = args;
        const id = session.threads.get(plan.pactId);
        args = id ? { ...rest, conversationId: id } : { ...rest, newConversation: true };
      }
      try {
        return (await settleFo((name, callArgs) => session.fo!.call(name, callArgs) as Promise<never>, plan.toolName, args, {
          maxPolls: 0,
          onConversation: plan.pactId
            ? (conversationId) => session.threads.remember(plan.pactId!, conversationId, epoch)
            : undefined,
        })) as never;
      } catch (error) {
        if (error instanceof Error && /still working/i.test(error.message)) {
          const conversationId = plan.pactId ? session.threads.get(plan.pactId) : undefined;
          throw new DeferredRun("Asking Fo…", conversationId);
        }
        throw error;
      }
    },
  });
}

export async function pollRun(session: Session, run: Run) {
  const polls = (run.polls ?? 0) + 1;
  if (run.status !== "running") return run;
  if (foMocked()) {
    if (polls < 2)
      return { ...run, polls, progress: "Asking Fo…", status: "running" as const };
    const plan = session.actions.getPlan(run.planId);
    return {
      ...run,
      polls,
      status: "returned" as const,
      result: mockResult(plan ? latestMessage(plan) : ""),
      finishedAt: new Date().toISOString(),
    };
  }
  if (!run.conversationId || !session.fo)
    return {
      ...run,
      status: "unknown" as const,
      error: "Fo may have received this action. Check Fo activity before creating another request.",
      finishedAt: new Date().toISOString(),
    };
  try {
    const result = await settleFo(
      (name, args) => session.fo!.call(name, args) as Promise<never>,
      "get_fo_reply",
      { conversationId: run.conversationId, waitSeconds: 2 },
      { maxPolls: 0 },
    );
    const text = result.content?.[0]?.text ?? "";
    const state = result.structuredContent?.status;
    const status = state === "needs_answer" ? "needs_answer" : state === "failed" ? "failed" : "returned";
    return {
      ...run,
      polls,
      status,
      result: text,
      ...(status === "failed" ? { error: text } : {}),
      finishedAt: new Date().toISOString(),
    } as Run;
  } catch (error) {
    if (error instanceof Error && /still working/i.test(error.message))
      return { ...run, polls, status: "running" as const, progress: "Asking Fo…" };
    return {
      ...run,
      polls,
      status: "unknown" as const,
      error: "Fo may have received this action. Check Fo activity before creating another request.",
      finishedAt: new Date().toISOString(),
    };
  }
}

let modelCache: { at: number; id: string; ok: boolean } | undefined;

export async function verifyModel() {
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
  if (aiMocked()) return { model, modelVerified: true };
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { model, modelVerified: false };
  if (modelCache && modelCache.id === model && Date.now() - modelCache.at < 600_000)
    return { model, modelVerified: modelCache.ok };
  try {
    const response = await fetch(`https://api.anthropic.com/v1/models/${model}`, {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(8000),
    });
    modelCache = { at: Date.now(), id: model, ok: response.ok };
  } catch {
    modelCache = { at: Date.now(), id: model, ok: false };
  }
  return { model, modelVerified: modelCache.ok };
}

export function resetSessions() {
  sessions.clear();
  modelCache = undefined;
}
