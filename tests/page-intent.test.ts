import { test } from "node:test";
import assert from "node:assert/strict";
import { requestsCurrentPage } from "../lib/page-intent";

test("typed and dictated current-page requests require fresh page context", () => {
  for (const text of ["Read this page", "Can you summarize the current page?", "What ingredients are in this video?", "read the page", "Explain this article to me"])
    assert.equal(requestsCurrentPage(text), true, text);
});
test("ordinary conversation does not silently capture a page", () => {
  for (const text of ["Hi", "What should I cook tonight?", "Write an article about pasta", "What did the video say yesterday?", "Read my email"])
    assert.equal(requestsCurrentPage(text), false, text);
});
