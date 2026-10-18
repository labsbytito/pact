import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listGrantedSites,
  rememberInvocation,
  rememberObservedUrl,
  rememberedSitePattern,
  requestSiteRead,
  resetRememberedSite,
  revokeGrantedSite,
  sitePatternFromUrl,
} from "../lib/site-access";

test("a site pattern is the current origin only", () => {
  assert.equal(
    sitePatternFromUrl("https://example.org/a/b?q=1"),
    "https://example.org/*",
  );
  assert.equal(
    sitePatternFromUrl("http://example.org:8080/post"),
    "http://example.org:8080/*",
  );
  assert.equal(sitePatternFromUrl("https://Example.COM/x"), "https://example.com/*");
  assert.equal(sitePatternFromUrl(undefined), undefined);
  assert.equal(sitePatternFromUrl(""), undefined);
  assert.equal(sitePatternFromUrl("chrome://newtab"), undefined);
  assert.equal(sitePatternFromUrl("chrome-extension://abc/panel.html"), undefined);
  assert.equal(sitePatternFromUrl("file:///tmp/notes.html"), undefined);
  assert.equal(
    sitePatternFromUrl("https://chromewebstore.google.com/detail/pact"),
    undefined,
  );
  assert.equal(
    sitePatternFromUrl("https://chrome.google.com/webstore/detail/pact"),
    undefined,
  );
  assert.equal(
    sitePatternFromUrl("https://chromewebstore.google.com.evil.example/detail"),
    "https://chromewebstore.google.com.evil.example/*",
  );
});

test("Read and Select item request the remembered origin before any later work", async (t) => {
  resetRememberedSite();
  t.after(resetRememberedSite);
  const requested: string[][] = [];
  let started = false;
  const original = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    permissions: {
      request(permission: { origins: string[] }) {
        started = true;
        requested.push(permission.origins);
        return Promise.resolve(true);
      },
    },
  };
  t.after(() => {
    (globalThis as { chrome?: unknown }).chrome = original;
  });
  rememberInvocation({
    tabId: 4,
    url: "https://example.org/current",
  });
  assert.equal(rememberedSitePattern(), "https://example.org/*");
  const pending = requestSiteRead(rememberedSitePattern());
  assert.equal(started, true);
  const granted = await pending;
  assert.equal(granted, true);
  assert.deepEqual(requested, [["https://example.org/*"]]);
  assert.equal(await requestSiteRead(undefined), true);
  assert.deepEqual(requested, [["https://example.org/*"]]);
});

test("a denied site request does not pretend the page was read", async (t) => {
  const original = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    permissions: {
      async request() {
        return false;
      },
    },
  };
  t.after(() => {
    (globalThis as { chrome?: unknown }).chrome = original;
  });
  assert.equal(await requestSiteRead("https://example.org/*"), false);
});

test("another tab cannot replace the origin that will be requested", () => {
  resetRememberedSite();
  rememberInvocation({ tabId: 4, url: "https://example.org/current" });
  rememberObservedUrl(9, "https://other.test/page");
  assert.equal(rememberedSitePattern(), "https://example.org/*");
  rememberObservedUrl(4, "https://example.org/next");
  assert.equal(rememberedSitePattern(), "https://example.org/*");
  rememberObservedUrl(4, "chrome://settings");
  assert.equal(rememberedSitePattern(), undefined);
});

test("granted sites can be listed and revoked without the companion host", async (t) => {
  resetRememberedSite();
  t.after(resetRememberedSite);
  rememberInvocation({ tabId: 4, origin: "https://example.org/*" });
  let origins = [
    "http://127.0.0.1:4317/*",
    "https://example.org/*",
    "https://news.example/*",
    "chrome://newtab/*",
  ];
  const removed: string[][] = [];
  const original = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    permissions: {
      async getAll() {
        return { origins: origins.slice() };
      },
      async remove(permission: { origins: string[] }) {
        removed.push(permission.origins);
        origins = origins.filter((origin) => !permission.origins.includes(origin));
      },
    },
  };
  t.after(() => {
    (globalThis as { chrome?: unknown }).chrome = original;
  });
  assert.deepEqual(await listGrantedSites(), [
    "https://example.org/*",
    "https://news.example/*",
  ]);
  await revokeGrantedSite("https://example.org/*");
  assert.deepEqual(removed, [["https://example.org/*"]]);
  assert.equal(rememberedSitePattern(), undefined);
  assert.deepEqual(await listGrantedSites(), ["https://news.example/*"]);
});
