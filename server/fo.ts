import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const directory = new URL("../.local/", import.meta.url);
const file = new URL("fo.json", directory);
const endpoint = new URL("https://mcp.api.wajo.ai/fo");
type Saved = { client?: OAuthClientInformationMixed; tokens?: OAuthTokens };
let saved: Saved = {};
try {
  saved = JSON.parse(await readFile(file, "utf8"));
} catch {}
// Writes are serialized and snapshot `saved` when they run, so the last write always reflects the latest state (e.g. a disconnect).
let writing: Promise<void> = Promise.resolve();
function persist() {
  const w = writing
    .catch(() => {})
    .then(async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(file, JSON.stringify(saved), { mode: 0o600 });
    });
  writing = w;
  return w;
}
// Each connect attempt/disconnect starts a new generation. A provider is bound to one generation and becomes inert once superseded.
type Attempt = {
  gen: number;
  verifier: string;
  state: string;
  url?: string;
  startedAt: number;
};
let generation = 0;
let attempt: Attempt = { gen: 0, verifier: "", state: "", startedAt: 0 };
let client: Client | undefined;
let pending: Client | undefined;
let tools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
const cancelled = () =>
  new Error("Fo connection was cancelled. Connect again in Pact.");
function makeProvider(a: Attempt): OAuthClientProvider {
  const live = () => a.gen === generation;
  const guard = () => {
    if (!live()) throw cancelled();
  };
  return {
    redirectUrl: "http://127.0.0.1:4317/oauth/callback",
    clientMetadata: {
      client_name: "Pact local companion",
      redirect_uris: ["http://127.0.0.1:4317/oauth/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp",
    },
    state() {
      guard();
      if (!a.state) a.state = randomBytes(32).toString("hex");
      return a.state;
    },
    clientInformation: () => (live() ? saved.client : undefined),
    async saveClientInformation(info) {
      guard();
      saved.client = info;
      await persist();
    },
    tokens: () => (live() ? saved.tokens : undefined),
    async saveTokens(tokens) {
      guard();
      saved.tokens = tokens;
      await persist();
    },
    redirectToAuthorization(url) {
      guard();
      a.url = url.href;
    },
    saveCodeVerifier(value) {
      guard();
      a.verifier = value;
    },
    codeVerifier() {
      guard();
      if (!a.verifier)
        throw new Error("Connection expired. Start again in Pact.");
      return a.verifier;
    },
    async invalidateCredentials(scope) {
      guard();
      if (scope === "all" || scope === "tokens") delete saved.tokens;
      if (scope === "all" || scope === "client") delete saved.client;
      if (scope === "all" || scope === "verifier") a.verifier = "";
      await persist();
    },
  };
}
let provider = makeProvider(attempt);
// Supersede everything in flight: new generation, fresh provider, pending state/verifier dropped, in-flight client closed.
function supersede() {
  generation++;
  attempt = { gen: generation, verifier: "", state: "", startedAt: 0 };
  provider = makeProvider(attempt);
  const old = pending;
  pending = undefined;
  return old;
}
async function closeQuietly(c?: Client) {
  try {
    await c?.close();
  } catch {}
}
async function connect(a: Attempt, p: OAuthClientProvider) {
  if (a.gen !== generation) throw cancelled();
  const c = new Client({ name: "pact", version: "0.1.0" });
  const t = new StreamableHTTPClientTransport(endpoint, { authProvider: p });
  pending = c;
  try {
    await c.connect(t);
    const list = (await c.listTools()).tools;
    if (a.gen !== generation) throw cancelled();
    const previous = client;
    client = c;
    tools = list;
    pending = undefined;
    if (previous && previous !== c) await closeQuietly(previous);
    return c;
  } catch (e) {
    if (pending === c) pending = undefined;
    await closeQuietly(c);
    throw e;
  }
}
export function foStatus() {
  return {
    fo: !!client,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
}
export async function beginFo() {
  if (client) return { connected: true };
  await closeQuietly(supersede());
  const a = attempt,
    p = provider;
  a.startedAt = Date.now();
  try {
    await connect(a, p);
    return { connected: true };
  } catch (e) {
    if (a.gen === generation && a.url) return { url: a.url };
    throw e;
  }
}
export async function finishFo(code: string, returnedState: string) {
  const a = attempt,
    p = provider;
  if (
    !a.state ||
    returnedState !== a.state ||
    Date.now() - a.startedAt > 600000
  )
    throw new Error(
      "Connection request expired or did not match. Return to Pact and connect again.",
    );
  const t = new StreamableHTTPClientTransport(endpoint, { authProvider: p });
  await t.finishAuth(code);
  if (a.gen !== generation) throw cancelled();
  a.state = "";
  a.verifier = "";
  await connect(a, p);
}
export async function disconnectFo() {
  const old = pending;
  const current = client;
  supersede();
  client = undefined;
  tools = [];
  delete saved.tokens;
  await Promise.all([closeQuietly(old), closeQuietly(current)]);
  await persist();
}
export async function callFo(name: string, args: Record<string, unknown>) {
  if (!client) throw new Error("Connect Fo first.");
  if (!tools.some((t) => t.name === name))
    throw new Error("This Fo tool is not available.");
  return client.callTool({ name, arguments: args }, undefined, {
    timeout: 300000,
  });
}
export async function restoreFo() {
  if (!saved.tokens) return;
  const a = attempt,
    p = provider;
  try {
    await connect(a, p);
  } catch (e) {
    if (a.gen === generation) {
      client = undefined;
      console.warn(
        "Fo restore failed:",
        e instanceof Error ? e.message : "unknown error",
      );
    }
  }
}
