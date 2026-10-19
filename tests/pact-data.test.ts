import test from "node:test";
import assert from "node:assert/strict";
import { makePact } from "../lib/model";
import { changePact, migratePact, retainPactMetadata } from "../lib/pact-data";
import { mergeReply } from "../lib/context";
import { groupLibraryPacts } from "../lib/library";
const companion = { name: "Otter", appearance: { shape: 4, color: "#3B82F6", v: 2 as const } };
test("legacy identity snapshots once and final companion cannot change on subsequent updates", () => {
 const legacy = makePact("Legacy");
 const first = migratePact(legacy, companion);
 const second = migratePact(first, { ...companion, name: "Other" });
 assert.deepEqual(second.companion, companion);
 const updated = retainPactMetadata(first, { ...first, companion: { ...companion, name: "Other" } });
 assert.deepEqual(updated.companion, companion);
});
test("rename survives AI title and stale polling updates, pin/archive restore preserve full conversation", () => {
 const pact = makePact("Initial", undefined, [], companion);
 const renamed = changePact(pact, "rename", "My deliberate title");
 assert.equal(mergeReply(renamed, { reply: "Hello", title: "AI title" }, "m", "now").title, renamed.title);
 const pinned = changePact(renamed, "pin");
 const archived = changePact(pinned, "archive");
 const stale = retainPactMetadata(archived, { ...pact, title: "AI title" });
 assert.equal(stale.title, renamed.title); assert.equal(stale.pinned, true); assert.equal(stale.archived, true);
 const restored = changePact(stale, "archive"); assert.equal(restored.archived, false); assert.deepEqual(restored.messages, pact.messages);
});
test("delete removes chat and files while retaining action evidence and blocks stale resurrection", () => {
 const pact = { ...makePact("Private"), action: { id: "a", title: "Sent request", instruction: "Inspect", status: "unknown" as const } };
 const deleted = changePact(pact, "delete");
 assert.equal(deleted.messages.length, 0); assert.equal(deleted.intention, ""); assert.equal(deleted.action?.status, "unknown");
 assert.equal(groupLibraryPacts([deleted], [], { archived: false, query: "" })[0]?.pacts.length, 0);
 const stale = retainPactMetadata(deleted, pact); assert.deepEqual(stale.messages, []); assert.ok(stale.deletedAt);
});
