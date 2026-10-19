import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupLibraryPacts,
  normalizeSections,
  sortLibraryPacts,
} from "../lib/library";
import { makePact, type Pact } from "../lib/model";

const base = (over: Partial<Pact> = {}): Pact => ({
  ...makePact("Hello"),
  ...over,
});

test("normalizeSections keeps valid entries only", () => {
  assert.deepEqual(
    normalizeSections([
      { id: "a", name: " Work ", createdAt: "t" },
      { id: 1, name: "bad" },
      null,
    ]),
    [{ id: "a", name: "Work", createdAt: "t" }],
  );
});

test("sortLibraryPacts puts pinned first then recent", () => {
  const a = base({
    id: "1",
    title: "a",
    pinned: false,
    updatedAt: "2020-01-02T00:00:00.000Z",
  });
  const b = base({
    id: "2",
    title: "b",
    pinned: true,
    updatedAt: "2020-01-01T00:00:00.000Z",
  });
  const c = base({
    id: "3",
    title: "c",
    pinned: false,
    updatedAt: "2020-01-03T00:00:00.000Z",
  });
  assert.deepEqual(
    sortLibraryPacts([a, b, c]).map((p) => p.id),
    ["2", "3", "1"],
  );
});

test("groupLibraryPacts builds pinned and section groups", () => {
  const sections = [
    { id: "s1", name: "Side projects", createdAt: "t" },
  ];
  const list = [
    base({
      id: "p1",
      title: "Pinned one",
      pinned: true,
      updatedAt: "2020-01-04T00:00:00.000Z",
    }),
    base({
      id: "p2",
      title: "In section",
      sectionId: "s1",
      updatedAt: "2020-01-03T00:00:00.000Z",
    }),
    base({
      id: "p3",
      title: "Loose",
      updatedAt: "2020-01-02T00:00:00.000Z",
    }),
    base({
      id: "p4",
      title: "Archived",
      archived: true,
      updatedAt: "2020-01-05T00:00:00.000Z",
    }),
  ];
  const groups = groupLibraryPacts(list, sections, {
    archived: false,
    query: "",
  });
  assert.equal(groups[0]?.name, "Pinned");
  assert.deepEqual(
    groups[0]?.pacts.map((p) => p.id),
    ["p1"],
  );
  assert.equal(groups[1]?.name, "Side projects");
  assert.deepEqual(
    groups[1]?.pacts.map((p) => p.id),
    ["p2"],
  );
  assert.equal(groups[2]?.name, "Pacts");
  assert.deepEqual(
    groups[2]?.pacts.map((p) => p.id),
    ["p3"],
  );
});

test("empty sections are omitted from the library", () => {
  const groups = groupLibraryPacts(
    [base({ id: "only", title: "Only" })],
    [{ id: "empty", name: "Empty", createdAt: "t" }],
    { archived: false, query: "" },
  );
  assert.equal(
    groups.some((g) => g.id === "empty"),
    false,
  );
});

test("groupLibraryPacts search matches message bodies", () => {
  const pact = base({
    id: "x",
    title: "Quiet title",
    messages: [
      {
        id: "m",
        role: "user",
        text: "unique-pottery-needle",
        at: "t",
      },
    ],
  });
  const groups = groupLibraryPacts([pact], [], {
    archived: false,
    query: "pottery-needle",
  });
  assert.equal(groups.flatMap((g) => g.pacts).length, 1);
});
