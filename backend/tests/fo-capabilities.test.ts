import test from "node:test";
import assert from "node:assert/strict";
import { ActionStore } from "../lib/actions";
import { finalizeProposal } from "../lib/interpret";
const store = () => ActionStore.load("store://test", { read: async () => null, write: async () => {} });
const tools = [{ name: "ask_fo", inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } }];

test("a reviewed email request retains its send instruction instead of forbidding contact", async () => {
 const pact = { intention: "Send an email", messages: [{ role: "user" as const, text: "Send an email to my chosen contact about the meeting" }] };
 const result = await finalizeProposal(pact, { reply: "Review this email request.", action: { title: "Send email", instruction: "Send email", toolName: "ask_fo", arguments: { message: pact.messages[0]!.text } } }, tools, undefined, await store());
 assert.equal(result.action?.explicit, undefined);
 assert.equal(result.action?.arguments.message, pact.messages[0]!.text);
 assert.doesNotMatch(String(result.action?.arguments.message), /Do not book, contact/);
});
test("bypassed read-only research retains the no-commit guard", async () => {
 const text = "Find opening hours for the museum";
 const result = await finalizeProposal({ intention: text, messages: [{ role: "user", text }] }, { reply: "Looking up hours", action: { title: "Find hours", instruction: text, toolName: "ask_fo", arguments: { message: text } } }, tools, undefined, await store());
 assert.equal(result.action?.explicit, true);
 assert.match(String(result.action?.arguments.message), /Do not book, contact, pay, or commit/);
});
test("custom live connectors can be proposed with mandatory review and exact schema validation", async () => {
 const custom = [{ name: "workspace_update_record", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } }];
 const pact = { intention: "Update this record", messages: [] };
 const model = { reply: "Review this update", action: { title: "Update record", instruction: "Update the chosen record", toolName: custom[0]!.name, arguments: { id: "record-one" } } };
 const result = await finalizeProposal(pact, model, custom, undefined, await store());
 assert.equal(result.action?.consequential, true); assert.equal(result.action?.explicit, undefined);
 const invalid = await finalizeProposal(pact, { ...model, action: { ...model.action, arguments: { id: 42 } } }, custom, undefined, await store());
 assert.equal(invalid.action, undefined);
});
