import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_PIPELINE, isImageMime } from "../lib/images";
import { ATTACHMENT_LIMITS, isAllowedAttachment } from "../lib/attachments";

test("image pipeline targets Anthropic-friendly long edge and 10MB input", () => {
  assert.equal(IMAGE_PIPELINE.maxLongEdge, 1568);
  assert.equal(IMAGE_PIPELINE.maxInputBytes, 10 * 1024 * 1024);
  assert.equal(ATTACHMENT_LIMITS.maxImageEdge, 1568);
  assert.equal(ATTACHMENT_LIMITS.maxInputBytes, 10 * 1024 * 1024);
});

test("accepts common image MIME types and rejects others", () => {
  assert.equal(isImageMime("image/png"), true);
  assert.equal(isImageMime("image/jpeg"), true);
  assert.equal(isImageMime("image/webp"), true);
  assert.equal(isImageMime("image/gif"), true);
  assert.equal(isImageMime("application/pdf"), false);
  assert.equal(
    isAllowedAttachment(
      new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
    ),
    true,
  );
  assert.equal(
    isAllowedAttachment(
      new File([new Uint8Array(11 * 1024 * 1024)], "big.png", {
        type: "image/png",
      }),
    ),
    true,
  );
});

test("prepareAttachment rejects oversize files before encode", async () => {
  const { prepareAttachment } = await import("../lib/attachments");
  const big = new File(
    [new Uint8Array(11 * 1024 * 1024)],
    "huge.png",
    { type: "image/png" },
  );
  await assert.rejects(() => prepareAttachment(big), /10MB/);
});
