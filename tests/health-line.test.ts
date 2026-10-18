import { test } from "node:test";
import assert from "node:assert/strict";
import {
  companionStartupLine,
  foLoginFrom,
  keyPresent,
} from "../server/health-line";

test("the startup line reports the key, model and Fo login without the secret", () => {
  const line = companionStartupLine({
    keyPresent: true,
    model: "claude-sonnet-5-5",
    foLogin: "signed-out",
  });
  assert.match(line, /Claude key present/);
  assert.match(line, /model claude-sonnet-5-5/);
  assert.match(line, /Fo signed out/);
  assert.equal(line.includes("sk-ant"), false);
  assert.equal(
    companionStartupLine({
      keyPresent: false,
      model: null,
      foLogin: foLoginFrom(false, true),
    }),
    "Pact companion listening on http://127.0.0.1:4317 — Claude key missing, model none, Fo needs reconnect",
  );
  assert.equal(
    companionStartupLine({
      keyPresent: false,
      model: null,
      foLogin: foLoginFrom(true, false),
    }).endsWith("Fo signed in"),
    true,
  );
  assert.equal(keyPresent({ ANTHROPIC_API_KEY: "  " }), false);
  assert.equal(keyPresent({ ANTHROPIC_API_KEY: "present" }), true);
  assert.equal(keyPresent({}), false);
});
