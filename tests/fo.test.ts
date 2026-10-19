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

test("auth rejection recognizes the SDK's expired-session errors only", () => {
  assert.equal(isAuthRejection(new UnauthorizedError()), true);
  assert.equal(
    isAuthRejection(
      new UnauthorizedError(
        "Authentication requires user authorization - redirect initiated",
      ),
    ),
    true,
  );
  assert.equal(
    isAuthRejection(
      new StreamableHTTPError(
        401,
        "Server returned 401 after successful authentication",
      ),
    ),
    true,
  );
  assert.equal(isAuthRejection(new InvalidGrantError("refresh expired")), true);
  assert.equal(isAuthRejection(new StreamableHTTPError(403, "nope")), false);
  assert.equal(isAuthRejection(new StreamableHTTPError(500, "nope")), false);
  assert.equal(isAuthRejection(new Error("socket hang up")), false);
  assert.equal(isAuthRejection(new Error("Unauthorized")), true);
  assert.equal(
    isAuthRejection({ isError: true, message: "Unauthorized to call that number" }),
    false,
  );
});

test("a rejected refresh disconnects Fo and Connect can start a new sign-in", async (t) => {
  let connects = 0;
  const { connection, file } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect(transport) {
        connects++;
        const provider = (transport as { authProvider: OAuthClientProvider })
          .authProvider;
        const saved = await provider.tokens();
        if (saved?.access_token === "expired") throw new UnauthorizedError();
        if (!saved) {
          await provider.state?.();
          await provider.redirectToAuthorization(redirect);
          throw new UnauthorizedError(
            "Authentication requires user authorization - redirect initiated",
          );
        }
      },
      async listTools() {
        return tools();
      },
      async callTool() {
        throw new UnauthorizedError();
      },
      async close() {},
    }),
  });
  assert.deepEqual(await connection.begin(), { connected: true });
  assert.equal(connection.status().fo, true);
  assert.equal(connection.status().needsReconnect, false);
  await assert.rejects(
    () => connection.call("ask_fo", { message: "hi" }),
    (error: unknown) => {
      assert.ok(error instanceof NotSubmittedError);
      assert.match(error.message, /not sent/);
      assert.match(error.message, /Reconnect Fo/);
      return true;
    },
  );
  assert.equal(connection.status().fo, false);
  assert.equal(connection.status().needsReconnect, true);
  assert.equal(connection.status().tools.length, 0);
  assert.equal(JSON.parse(await readFile(file, "utf8")).tokens, undefined);
  const again = await connection.begin();
  assert.equal("url" in again && again.url, redirect.href);
  assert.equal(connection.status().fo, false);
  assert.ok(connects >= 2);
});

test("expired saved tokens are dropped once and the next attempt can open Wajo", async (t) => {
  let connects = 0;
  const { connection, file } = await harness(t, {
    seed: tokens("expired"),
    createClient: () => ({
      async connect(transport) {
        connects++;
        const provider = (transport as { authProvider: OAuthClientProvider })
          .authProvider;
        const saved = await provider.tokens();
        if (saved?.access_token === "expired")
          throw new StreamableHTTPError(401, "Server returned 401 after successful authentication");
        if (!saved) {
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
  });
  const result = await connection.begin();
  assert.equal("url" in result && result.url, redirect.href);
  assert.equal(connects, 2);
  assert.equal(connection.status().fo, false);
  assert.equal(connection.status().needsReconnect, true);
  assert.equal(JSON.parse(await readFile(file, "utf8")).tokens, undefined);
});

test("startup restore of an expired sign-in stays disconnected and reconnectable", async (t) => {
  const { connection, file } = await harness(t, {
    seed: tokens("expired"),
    createClient: () => ({
      async connect() {
        throw new InvalidGrantError("refresh expired");
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
  await connection.restore();
  assert.equal(connection.status().fo, false);
  assert.equal(connection.status().needsReconnect, true);
  assert.equal(JSON.parse(await readFile(file, "utf8")).tokens, undefined);
  await assert.rejects(
    () => connection.call("ask_fo", { message: "hi" }),
    /not sent/,
  );
});

test("a transport failure keeps the session and is not recorded as an auth rejection", async (t) => {
  const { connection, file } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect() {},
      async listTools() {
        return tools();
      },
      async callTool() {
        throw new Error("socket hang up");
      },
      async close() {},
    }),
  });
  await connection.begin();
  await assert.rejects(
    () => connection.call("ask_fo", { message: "hi" }),
    (error: unknown) => {
      assert.ok(!(error instanceof NotSubmittedError));
      assert.equal(error instanceof Error && error.message, "socket hang up");
      return true;
    },
  );
  assert.equal(connection.status().fo, true);
  assert.equal(
    JSON.parse(await readFile(file, "utf8")).tokens.access_token,
    "ok",
  );
});

test("a tool error result is not treated as a dropped sign-in", async (t) => {
  const { connection } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect() {},
      async listTools() {
        return tools();
      },
      async callTool() {
        return {
          isError: true,
          content: [{ type: "text", text: "Unauthorized to call that number" }],
        };
      },
      async close() {},
    }),
  });
  await connection.begin();
  const result = await connection.call("ask_fo", { message: "hi" });
  assert.equal((result as { isError: boolean }).isError, true);
  assert.equal(connection.status().fo, true);
  assert.equal(connection.status().needsReconnect, false);
});

test("an auth rejection before Fo accepts is a failed run; one after acceptance stays unknown", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "pact-fo-run-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = await ActionStore.load(join(dir, "actions.json"));
  const { connection } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect() {},
      async listTools() {
        return tools();
      },
      async callTool() {
        throw new UnauthorizedError();
      },
      async close() {},
    }),
  });
  await connection.begin();
  const plan = await store.propose({
    title: "Ask",
    instruction: "Ask Fo",
    toolName: "ask_fo",
    arguments: { message: "hi" },
    pactId: "p",
    contextHash: "c".repeat(64),
  });
  const started = await store.approve(plan.planId, {
    validate() {},
    execute: () => connection.call("ask_fo", { message: "hi" }) as Promise<any>,
  });
  let run = store.getRun(started.runId)!;
  for (let i = 0; i < 50 && run.status === "running"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    run = store.getRun(started.runId)!;
  }
  assert.equal(run.status, "failed");
  assert.match(run.error!, /not sent/);
  assert.equal(connection.status().needsReconnect, true);

  const { connection: again } = await harness(t, {
    seed: tokens("ok"),
    createClient: () => ({
      async connect() {},
      async listTools() {
        return tools();
      },
      async callTool(params) {
        if (params.name === "ask_fo")
          return {
            structuredContent: {
              status: "working",
              conversationId: "thread-1",
            },
          };
        throw new UnauthorizedError();
      },
      async close() {},
    }),
  });
  await again.begin();
  await assert.rejects(
    () => settleFo((name, args) => again.call(name, args) as Promise<any>, "ask_fo", {
      message: "hi",
    }),
    /Check Fo activity/,
  );
  assert.equal(again.status().fo, false);
  assert.equal(again.status().needsReconnect, true);
});

