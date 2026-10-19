import assert from "node:assert/strict";
import test from "node:test";
import { interpretationContext, mergeReply } from "../lib/context";
import {
  createSection,
  deletePact,
  describeAttachment,
  FILE_TEXT,
  groupedPacts,
  movePact,
  removeSection,
  renamePact,
  renameSection,
  markArchived,
} from "../lib/chats";
import { makePact, type Pact, type Section } from "../lib/model";

const sample = () => makePact("Visit the town next year");

test("rename keeps the name the person chose when a later reply arrives", () => {
  const renamed = renamePact(sample(), "  Kyoto trip  ");
  assert.equal(renamed.title, "Kyoto trip");
  assert.equal(renamed.titleEdited, true);
  const merged = mergeReply(
    renamed,
    { reply: "Noted.", title: "Generated title" },
    "m",
    "now",
  );
  assert.equal(merged.title, "Kyoto trip");
  assert.throws(() => renamePact(sample(), "   "), /name/);
});

test("archive, delete, and sections stay local to the saved list", () => {
  const first = sample();
  const second = makePact("Learn the language");
  const archived = markArchived(first, true);
  assert.equal(archived.archived, true);
  assert.deepEqual(
    deletePact([first, second], first.id).map((pact) => pact.id),
    [second.id],
  );
  const sections = createSection([], "Travel");
  assert.equal(sections.length, 1);
  assert.throws(() => createSection(sections, " travel "), /already have/);
  const moved = movePact(first, sections[0]!.id);
  assert.equal(moved.sectionId, sections[0]!.id);
  const loose = movePact(moved, undefined);
  assert.equal(loose.sectionId, undefined);
  const renamed = renameSection(sections, sections[0]!.id, "Trips");
  const removed = removeSection(renamed, [moved], renamed[0]!.id);
  assert.equal(removed.sections.length, 0);
  assert.equal(removed.pacts[0]?.sectionId, undefined);
});

test("library groups follow section order and keep unnamed conversations", () => {
  const travel = { id: "s1", name: "Travel" } satisfies Section;
  const ideas = { id: "s2", name: "Ideas" } satisfies Section;
  const a = { ...sample(), id: "a", sectionId: "s1" } as Pact;
  const b = { ...sample(), id: "b" } as Pact;
  const groups = groupedPacts([b, a], [travel, ideas]);
  assert.deepEqual(
    groups.map((group) => [group.section?.name, group.pacts.map((p) => p.id)]),
    [
      ["Travel", ["a"]],
      ["Ideas", []],
      [undefined, ["b"]],
    ],
  );
});

test("text files keep an excerpt and other files keep only a description", () => {
  const note = describeAttachment({
    name: "notes.md",
    type: "text/markdown",
    size: 12,
    text: "hello town",
  });
  assert.equal(note.attachment?.text, "hello town");
  const long = describeAttachment({
    name: "notes.md",
    type: "text/markdown",
    size: 20,
    text: "x".repeat(FILE_TEXT + 5),
  });
  assert.equal(long.attachment?.text?.length, FILE_TEXT);
  assert.equal(long.attachment?.truncated, true);
  const image = describeAttachment({
    name: "map.png",
    type: "image/png",
    size: 40,
    text: "not really text",
  });
  assert.equal(image.attachment?.text, undefined);
  assert.match(
    describeAttachment({ name: "big.txt", type: "text/plain", size: 2_000_000 })
      .error ?? "",
    /1\.5 MB/,
  );
});

test("interpretation includes an attached excerpt without rewriting the saved message", () => {
  const pact = sample();
  const made = describeAttachment({
    name: "plan.txt",
    type: "text/plain",
    size: 11,
    text: "Kyoto notes",
  });
  pact.messages[0] = {
    ...pact.messages[0]!,
    attachments: [made.attachment!],
  };
  const context = interpretationContext(pact);
  assert.match(context.pact.messages[0]!.text, /Kyoto notes/);
  assert.equal(pact.messages[0]!.text.includes("Kyoto notes"), false);
  assert.ok(Buffer.byteLength(JSON.stringify(context)) < 300000);
});
