import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { createFoConnection } from "../backend/lib/fo";

export const redirect = new URL("https://mcp.api.wajo.ai/authorize?test=1");

export async function harness(
  t: { after: (fn: () => Promise<void>) => void },
  options: {
    seed?: unknown;
    createClient: () => {
      connect(transport: unknown): Promise<void>;
      listTools(): Promise<{ tools: { name: string }[] }>;
      callTool(
        params: { name: string; arguments?: Record<string, unknown> },
        resultSchema: undefined,
        options: { timeout: number },
      ): Promise<unknown>;
      close(): Promise<void>;
    };
    finishAuth?: (code: string, provider: OAuthClientProvider) => Promise<void>;
  },
) {
  const dir = await mkdtemp(join(tmpdir(), "pact-fo-auth-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "fo.json");
  if (options.seed !== undefined)
    await writeFile(file, JSON.stringify(options.seed), { mode: 0o600 });
  const connection = await createFoConnection({
    directory: pathToFileURL(`${dir}/`),
    createClient: options.createClient,
    createTransport: (_endpoint, authProvider) => ({
      authProvider,
      finishAuth: (code) =>
        options.finishAuth?.(code, authProvider) ?? Promise.resolve(),
    }),
  });
  return { connection, file };
}

export function tokens(access: string) {
  return { tokens: { access_token: access, token_type: "Bearer" } };
}

export function tools() {
  return {
    tools: [{ name: "ask_fo" }, { name: "get_fo_reply" }, { name: "start_fo_call" }],
  };
}

