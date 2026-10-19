import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { NotSubmittedError } from "./actions";
import { randomBytes } from "node:crypto";

const directory = new URL("../.local/", import.meta.url);
const endpoint = new URL(process.env.FO_MCP_URL || "https://mcp.api.wajo.ai/fo");
const DEFAULT_REDIRECT = "http://127.0.0.1:4317/oauth/callback";
type OauthPending = {
  verifier: string;
  state: string;
  url?: string;
  startedAt: number;
};
type Saved = {
  client?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  oauth?: OauthPending;
};
type Attempt = {
  gen: number;
  verifier: string;
  state: string;
  url?: string;
  startedAt: number;
};
export type FoTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};
type FoClient = {
  connect(transport: unknown): Promise<void>;
  listTools(): Promise<{ tools: FoTool[] }>;
  callTool(
    params: { name: string; arguments?: Record<string, unknown> },
    resultSchema: undefined,
    options: { timeout: number },
  ): Promise<unknown>;
  close(): Promise<void>;
};
type FoTransport = {
  finishAuth(code: string): Promise<void>;
};
import { isAuthRejection } from "./fo-auth";
export { isAuthRejection };

export async function createFoConnection(options: {
  directory: URL;
  endpoint?: URL;
  redirectUrl?: string;
  /** Encrypt the credential file before it hits disk. Tests omit this and stay plaintext. */
  seal?: (json: string) => Promise<string>;
  open?: (raw: string) => Promise<string>;
  createClient: () => FoClient;
  createTransport: (endpoint: URL, authProvider: OAuthClientProvider) => FoTransport;
}) {
  const base = options.directory.href.endsWith("/")
    ? options.directory
    : new URL(`${options.directory.href}/`);
  const file = new URL("fo.json", base);
  const target = options.endpoint ?? endpoint;
  const redirect = options.redirectUrl ?? DEFAULT_REDIRECT;
  let saved: Saved = {};
  try {
    let raw = await readFile(file, "utf8");
    if (options.open) raw = await options.open(raw);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      saved = parsed;
  } catch {
    saved = {};
  }
  // Writes are serialized and freeze `saved` when they are scheduled, so the last write always reflects the latest state (e.g. a disconnect).
  let writing: Promise<void> = Promise.resolve();
  function persist() {
    const snapshot = saved;
    const w = writing.catch(() => {}).then(async () => {
      let json = JSON.stringify(snapshot);
      if (options.seal) json = await options.seal(json);
      await mkdir(base, { recursive: true, mode: 0o700 });
      await writeFile(file, json, { mode: 0o600 });
    });
    writing = w;
    return w;
  }
  function rememberOauth(a: Attempt) {
    if (!a.state && !a.verifier) {
      if (saved.oauth) {
        const next = { ...saved };
        delete next.oauth;
        saved = next;
        return persist();
      }
      return Promise.resolve();
    }
    saved = {
      ...saved,
      oauth: {
        verifier: a.verifier,
        state: a.state,
        url: a.url,
        startedAt: a.startedAt,
      },
    };
    return persist();
  }
  // Each connect attempt/disconnect starts a new generation. A provider is bound to one generation and becomes inert once superseded.
  let generation = 0;
  let attempt: Attempt = { gen: 0, verifier: "", state: "", startedAt: 0 };
  let client: FoClient | undefined;
  let pending: FoClient | undefined;
  let tools: FoTool[] = [];
  let needsReconnect = false;
  const cancelled = () =>
    new Error("Fo connection was cancelled. Connect again in Pact.");
  function makeProvider(a: Attempt): OAuthClientProvider {
    const live = () => a.gen === generation;
    const guard = () => {
      if (!live()) throw cancelled();
    };
    return {
      redirectUrl: redirect,
      clientMetadata: {
        client_name: "Pact",
        redirect_uris: [redirect],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "mcp",
      },
      state() {
        guard();
        if (!a.state) {
          a.state = randomBytes(32).toString("hex");
          void rememberOauth(a);
        }
        return a.state;
      },
      clientInformation: () => (live() ? saved.client : undefined),
      async saveClientInformation(info) {
        guard();
        saved = { ...saved, client: info };
        await persist();
      },
      tokens: () => (live() ? saved.tokens : undefined),
      async saveTokens(tokens) {
        guard();
        saved = { ...saved, tokens };
        await persist();
      },
      async redirectToAuthorization(url) {
        guard();
        a.url = url.href;
        await rememberOauth(a);
      },
      async saveCodeVerifier(value) {
        guard();
        a.verifier = value;
        await rememberOauth(a);
      },
      codeVerifier() {
        guard();
        if (!a.verifier)
          throw new Error("Connection expired. Start again in Pact.");
        return a.verifier;
      },
      async invalidateCredentials(scope) {
        guard();
        const next = { ...saved };
        if (scope === "all" || scope === "tokens") delete next.tokens;
        if (scope === "all" || scope === "client") delete next.client;
        saved = next;
        if (scope === "all" || scope === "verifier") a.verifier = "";
        await persist();
      },
    };
  }
  if (saved.oauth?.state || saved.oauth?.verifier) {
    attempt = {
      gen: generation,
      verifier: saved.oauth.verifier || "",
      state: saved.oauth.state || "",
      url: saved.oauth.url,
      startedAt: saved.oauth.startedAt || 0,
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
  async function closeQuietly(c?: FoClient) {
    try {
      await c?.close();
    } catch {
      /* Closing a failed session should not hide the outcome. */
    }
  }
  async function connect(a: Attempt, p: OAuthClientProvider) {
    if (a.gen !== generation) throw cancelled();
    const c = options.createClient();
    const t = options.createTransport(target, p);
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
  async function expireIfCurrent(seen: number) {
    if (seen !== generation) return;
    const oldPending = supersede();
    const current = client;
    client = undefined;
    tools = [];
    const next = { ...saved };
    delete next.tokens;
    saved = next;
    needsReconnect = true;
    await Promise.all([
      closeQuietly(oldPending),
      closeQuietly(current),
      persist(),
    ]);
  }
  function status() {
    return {
      fo: !!client,
      needsReconnect: !client && needsReconnect,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  }
  async function attemptConnect(
    allowAuthRetry: boolean,
  ): Promise<{ connected: true } | { url: string }> {
    await closeQuietly(supersede());
    const a = attempt;
    const p = provider;
    a.startedAt = Date.now();
    try {
      await connect(a, p);
      needsReconnect = false;
      return { connected: true };
    } catch (e) {
      if (a.gen !== generation) throw cancelled();
      if (a.url) return { url: a.url };
      if (allowAuthRetry && isAuthRejection(e)) {
        needsReconnect = true;
        if (a.gen === generation) {
          const next = { ...saved };
          delete next.tokens;
          saved = next;
          await persist();
        }
        if (a.gen !== generation) throw cancelled();
        return attemptConnect(false);
      }
      throw e;
    }
  }
  async function begin() {
    if (client) return { connected: true as const };
    return attemptConnect(true);
  }
  async function finish(code: string, returnedState: string) {
    const a = attempt;
    const p = provider;
    if (
      !a.state ||
      returnedState !== a.state ||
      Date.now() - a.startedAt > 600000
    )
      throw new Error(
        "Connection request expired or did not match. Return to Pact and connect again.",
      );
    const t = options.createTransport(target, p);
    await t.finishAuth(code);
    if (a.gen !== generation) throw cancelled();
    a.state = "";
    a.verifier = "";
    await connect(a, p);
    needsReconnect = false;
  }
  async function disconnect() {
    const old = pending;
    const current = client;
    supersede();
    client = undefined;
    tools = [];
    needsReconnect = false;
    const next = { ...saved };
    delete next.tokens;
    delete next.oauth;
    saved = next;
    await Promise.all([closeQuietly(old), closeQuietly(current)]);
    await persist();
  }
  async function call(name: string, args: Record<string, unknown>) {
    if (!client)
      throw new NotSubmittedError(
        "Fo isn't connected. Reconnect Fo in Pact. This request was not sent.",
      );
    if (!tools.some((tool) => tool.name === name))
      throw new NotSubmittedError(
        "This Fo tool is not available. This request was not sent.",
      );
    const seen = generation;
    const current = client;
    try {
      return await current.callTool({ name, arguments: args }, undefined, {
        timeout: 300000,
      });
    } catch (e) {
      if (!isAuthRejection(e)) throw e;
      // The transport rejected the call. Fo did not return a tool result, so this was not accepted.
      await expireIfCurrent(seen);
      throw new NotSubmittedError(
        "Fo rejected this request before accepting it. Reconnect Fo in Pact. This request was not sent.",
      );
    }
  }
  async function restore() {
    if (!saved.tokens) return;
    const a = attempt;
    const p = provider;
    const seen = a.gen;
    try {
      await connect(a, p);
      if (seen === generation) needsReconnect = false;
    } catch (e) {
      if (seen !== generation) return;
      if (isAuthRejection(e)) {
        console.warn("Fo restore failed: sign-in expired");
        await expireIfCurrent(seen);
        return;
      }
      client = undefined;
      tools = [];
      console.warn(
        "Fo restore failed:",
        e instanceof Error ? e.message : "unknown error",
      );
    }
  }
  return { status, begin, finish, disconnect, call, restore };
}

const connection = await createFoConnection({
  directory,
  endpoint,
  createClient: () =>
    new Client({ name: "pact", version: "0.1.0" }) as unknown as FoClient,
  createTransport: (url, authProvider) =>
    new StreamableHTTPClientTransport(url, { authProvider }),
});
export function foStatus() {
  return connection.status();
}
export function beginFo() {
  return connection.begin();
}
export function finishFo(code: string, returnedState: string) {
  return connection.finish(code, returnedState);
}
export function disconnectFo() {
  return connection.disconnect();
}
export function callFo(name: string, args: Record<string, unknown>) {
  return connection.call(name, args);
}
export function restoreFo() {
  return connection.restore();
}
