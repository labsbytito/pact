import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedAttachment,
  wireAttachments,
  type Attachment,
} from "../lib/attachments";
import { interpretationContext } from "../lib/context";
import { makePact } from "../lib/model";

test("allows images and text files by type or extension", () => {
  assert.equal(
    isAllowedAttachment(new File(["hi"], "note.txt", { type: "text/plain" })),
    true,
  );
  assert.equal(
    isAllowedAttachment(
      new File(["{}"], "data.json", { type: "application/json" }),
    ),
    true,
  );
  assert.equal(
    isAllowedAttachment(
      new File([new Uint8Array([1, 2])], "shot.png", { type: "image/png" }),
    ),
    true,
  );
  assert.equal(
    isAllowedAttachment(
      new File(["x"], "notes.md", { type: "application/octet-stream" }),
    ),
    true,
  );
  assert.equal(
    isAllowedAttachment(
      new File(["x"], "song.mp3", { type: "audio/mpeg" }),
    ),
    false,
  );
});

test("wireAttachments drops preview URLs before /interpret", () => {
  const list: Attachment[] = [
    {
      id: "1",
      name: "a.txt",
      mime: "text/plain",
      kind: "text",
      size: 2,
      text: "hi",
      previewUrl: "blob:should-not-send",
    },
    {
      id: "2",
      name: "b.jpg",
      mime: "image/jpeg",
      kind: "image",
      size: 10,
      data: "abc",
      previewUrl: "data:image/jpeg;base64,abc",
    },
  ];
  assert.deepEqual(wireAttachments(list), [
    { name: "a.txt", mime: "text/plain", kind: "text", text: "hi" },
    { name: "b.jpg", mime: "image/jpeg", kind: "image", data: "abc" },
  ]);
});

test("interpretationContext includes attachments under the size budget", () => {
  const pact = makePact("Summarize this");
  const payload = interpretationContext(pact, [
    {
      id: "1",
      name: "brief.txt",
      mime: "text/plain",
      kind: "text",
      size: 12,
      text: "hello world",
    },
  ]);
  assert.equal(payload.pact.attachments?.length, 1);
  assert.equal(payload.pact.attachments?.[0]?.name, "brief.txt");
  assert.equal(payload.pact.attachments?.[0]?.text, "hello world");
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= 240000);
});
