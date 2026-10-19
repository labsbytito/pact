import test from "node:test";
import assert from "node:assert/strict";
import { createFoConnection } from "../lib/fo";
import { sessionFor, toolsFor, foLabel } from "../lib/runtime";
import { memoryStore, useStore } from "../lib/store";

test("fresh per-install sessions restore their own saved Fo credentials before listing live tools", async () => {
 delete process.env.FO_MODE;
 const store = memoryStore(); useStore(store);
 await store.set("fo:alice", JSON.stringify({ tokens: { access_token: "alice-test", token_type: "Bearer" } }));
 const seen: string[] = [];
 const connect = async (id: string) => createFoConnection({
   load: () => store.get(`fo:${id}`), save: (json) => store.set(`fo:${id}`, json),
   createTransport: (_url, provider) => ({ finishAuth: async () => {}, provider }) as never,
   createClient: () => ({
     async connect(transport) { const token = await (transport as any).provider.tokens(); seen.push(token.access_token); },
     async listTools() { return { tools: [{ name: "ask_fo" }, { name: "custom_workspace_action" }] }; },
     async callTool() { throw new Error("No actions should run in this test"); },
     async close() {},
   }),
 });
 try {
   const alice = await sessionFor("alice", undefined, { connect });
   assert.equal(foLabel(alice), "signed in");
   assert.deepEqual(toolsFor(alice).map((t) => t.name), ["ask_fo", "custom_workspace_action"]);
   const bob = await sessionFor("bob", undefined, { connect });
   assert.equal(foLabel(bob), "signed out"); assert.deepEqual(toolsFor(bob), []);
   const reopened = await sessionFor("alice", undefined, { connect });
   assert.equal(foLabel(reopened), "signed in");
   assert.deepEqual(seen, ["alice-test", "alice-test"]);
 } finally { useStore(memoryStore()); }
});
