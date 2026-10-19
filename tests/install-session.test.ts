import test from "node:test";
import assert from "node:assert/strict";
import { api, clearInstallToken } from "../lib/api";

test("concurrent first requests share one install token and never split the account", async () => {
 const savedFetch = globalThis.fetch;
 const savedChrome = (globalThis as any).chrome;
 const state: Record<string, string> = {};
 (globalThis as any).chrome = { storage: { local: {
  async get(key: string) { return { [key]: state[key] }; },
  async set(values: Record<string, string>) { Object.assign(state, values); },
  async remove(key: string) { delete state[key]; },
 } } };
 let issues = 0;
 const headers: string[] = [];
 globalThis.fetch = (async (url, init) => {
  if (String(url).endsWith("/api/install")) { issues++; await new Promise((r) => setTimeout(r, 10)); return new Response(JSON.stringify({ token: "test-install-one" })); }
  headers.push(new Headers(init?.headers).get("Authorization") ?? "");
  return new Response(JSON.stringify({ ok: true }));
 }) as typeof fetch;
 try {
  await clearInstallToken();
  await Promise.all([api("/api/health"), api("/api/fo/status"), api("/api/health")]);
  assert.equal(issues, 1); assert.deepEqual(headers, Array(3).fill("Bearer test-install-one"));
 } finally { await clearInstallToken(); globalThis.fetch = savedFetch; (globalThis as any).chrome = savedChrome; }
});
