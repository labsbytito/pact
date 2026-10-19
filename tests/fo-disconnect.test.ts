import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InvalidGrantError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  createFoConnection,
  isAuthRejection,
} from "../backend/lib/fo";
import { ActionStore, NotSubmittedError } from "../backend/lib/actions";
import { settleFo } from "../backend/lib/fo-task";

import { harness, redirect, tokens, tools } from "./fo-harness";
test("disconnect during connect drops late tokens and does not stay connected", async (t) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { connection, file } = await harness(t, {
    seed: {
      ...tokens("stale"),
      client: { client_id: "pact-client" },
    },
    createClient: () => ({
      async connect(transport) {
        const provider = (transport as { authProvider: OAuthClientProvider })
          .authProvider;
        entered();
        await hold;
        await provider.saveTokens({
          access_token: "late-token",
          token_type: "Bearer",
        });
      },
      async listTools() {
        return tools();
      },
      async callTool() {
        return {};
      },
      async close() {},
    }),
  });
  const pending = connection.begin();
  await ready;
  await connection.disconnect();
  release();
  await assert.rejects(pending, /cancelled/);
  const saved = JSON.parse(await readFile(file, "utf8"));
  assert.equal(saved.tokens, undefined);
  assert.equal(JSON.stringify(saved).includes("late-token"), false);
  assert.equal(saved.client.client_id, "pact-client");
  assert.equal(connection.status().fo, false);
  assert.equal(connection.status().needsReconnect, false);
});

test("disconnect during tool discovery cannot publish that client as connected", async (t) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { connection } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect() {},
      async listTools() {
        entered();
        await hold;
        return tools();
      },
      async callTool() {
        return {};
      },
      async close() {},
    }),
  });
  const pending = connection.begin();
  await ready;
  await connection.disconnect();
  release();
  await assert.rejects(pending, /cancelled/);
  assert.equal(connection.status().fo, false);
  assert.deepEqual(connection.status().tools, []);
  await assert.rejects(() => connection.call("ask_fo", { message: "x" }), /not sent/);
});

test("disconnect during the OAuth callback cannot finish the old attempt", async (t) => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let state = "";
  const { connection } = await harness(t, {
    createClient: () => ({
      async connect(transport) {
        const provider = (transport as { authProvider: OAuthClientProvider })
          .authProvider;
        const saved = await provider.tokens();
        if (!saved) {
          state = (await provider.state?.()) ?? "";
          await provider.redirectToAuthorization(redirect);
          throw new UnauthorizedError();
        }
      },
      async listTools() {
        return tools();
      },
      async callTool() {
        return {};
      },
      async close() {},
    }),
    async finishAuth() {
      entered();
      await hold;
    },
  });
  const started = await connection.begin();
  assert.equal("url" in started && started.url, redirect.href);
  const finishing = connection.finish("code", state);
  await ready;
  await connection.disconnect();
  release();
  await assert.rejects(finishing, /cancelled/);
  assert.equal(connection.status().fo, false);
});

test("a healthy session is not replaced by a second connect", async (t) => {
  let connects = 0;
  const { connection } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect() {
        connects++;
      },
      async listTools() {
        return tools();
      },
      async callTool() {
        return {};
      },
      async close() {},
    }),
  });
  assert.deepEqual(await connection.begin(), { connected: true });
  assert.deepEqual(await connection.begin(), { connected: true });
  assert.equal(connects, 1);
  await assert.rejects(
    () => connection.call("missing_tool", {}),
    /not available/,
  );
  assert.equal(connection.status().fo, true);
});
