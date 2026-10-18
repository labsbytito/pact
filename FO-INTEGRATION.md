# Fo integration

## Confirmed (live-verified by main chat)
- MCP endpoint: `https://mcp.api.wajo.ai/fo` (Streamable HTTP).
- Metadata `https://mcp.api.wajo.ai/.well-known/oauth-authorization-server`: `registration_endpoint` = `https://mcp.api.wajo.ai/oauth/register`, `token_endpoint_auth_methods_supported` = `['none']`, `scopes_supported` = `['mcp']`, PKCE `S256`.
- Pact registers as a public client (`token_endpoint_auth_method: none`, scope `mcp`), redirect `http://127.0.0.1:4317/oauth/callback`. PKCE is handled by the MCP SDK `auth()` flow via the provider's `saveCodeVerifier`/`codeVerifier`.

## Not done / limitations
- No authentication or Fo call was made in this task. The Fo tool list is unverified.
- Credentials live in `server/.local/fo.json` (mode 0600). Never copy Claude's grant.
- Disconnect removes tokens but keeps the dynamic client registration.
- `restoreFo` failures are logged (message only, no tokens) and leave Fo disconnected.

## Fix: disconnect race
Problem: a pending `connect`, `finishAuth` or token refresh could finish after `disconnectFo` and re-save tokens or assign `client`.

Fix in `server/fo.ts`:
- A `generation` counter. `beginFo` and `disconnectFo` call `supersede()`, which bumps it, builds a new provider bound to that generation, clears pending state/verifier/URL, and returns the in-flight client to close.
- A superseded provider is inert: `saveTokens`, `saveClientInformation`, `saveCodeVerifier`, `redirectToAuthorization`, `invalidateCredentials`, `state` and `codeVerifier` throw "connection was cancelled"; `tokens()` and `clientInformation()` return nothing.
- `connect` re-checks the generation after `connect`/`listTools` and before assigning `client`/`tools`; superseded clients are closed.
- `finishFo` re-checks after `finishAuth`.
- Writes to `fo.json` are serialized and snapshot state at write time, so the disconnect write always lands last.

## One read-only test needed (after user authorizes in the UI)
Connect, then disconnect while `listTools` is in flight (or while `finishAuth` is pending). Expect: `foStatus().fo === false`, `tools` empty, `fo.json` has no `tokens`, and a later `callFo` fails with "Connect Fo first." Then connect again and list tools only (no tool calls) to record the real tool names.

## Live verification — 18 October 2026

The local companion successfully completed dynamic registration, OAuth PKCE and authenticated tool discovery through Wajo's existing signed-in account. A separate read-only `list_fo_conversations` MCP call succeeded. No external message, booking, purchase or calendar event was submitted. Account grant balances remain unverified.

Five tools were actually discovered: `ask_fo`, `get_fo_conversation`, `get_fo_reply`, `list_fo_conversations`, and `start_fo_call`. The implementation now polls `working` replies, routes each Pact to a private Fo conversation, serializes requests, and retains uncertainty after interruptions. Conversation handles and credentials are never included in public evidence.

## Stage two: conversation-to-action reliability (offline-tested only)
No live Fo or paid AI call was made. Verified only with mocked MCP replies (`tests/fo-envelope.test.ts`, `fo-runner.test.ts`, `ai.test.ts`).

- Reply decoding accepts `structuredContent`, wrapped shapes (`result`/`data`/`output`/`structuredContent`, objects or JSON strings) and JSON or plain text blocks. Real Fo field names beyond `status`, `response`, `conversationId`, `progress` are unverified, so aliases are accepted.
- Settled outcomes: `complete`, `failed`, `needs_answer`. Anything else (unknown status, empty or malformed reply, polling error, max polls, missing handle) throws and the run becomes `unknown` with "check Fo activity". It is never reported as complete.
- Run status `needs_answer` is new: `result` holds Fo's question. Progress is kept on the run through to the terminal state.
- `NotSubmittedError` (not connected or tool gone, raised before any Fo call) yields a definite `failed` run saying the request was not sent. Errors after Fo accepted a request are always uncertain.
- Budget exhaustion on a failed reply sets `reason: "budget"` and a clear run error.
- Per-Pact Fo handles live in `.local/fo-threads.json` (0600), are cleared on disconnect and when a fresh sign-in starts, and late saves from in-flight asks are ignored. Model-supplied `conversationId`/`newConversation` are stripped; each Pact's own handle is used.
- `/interpret`: one in-flight interpretation per Pact (409 otherwise); while a Fo question is unanswered only `ask_fo` can be proposed; an `ask_fo` proposal's displayed instruction is forced to equal the exact message sent; a bad action is withheld without discarding the reply.
- AI: direct API default `claude-sonnet-5-5` (`ANTHROPIC_MODEL` overrides). CLI model only via `PACT_CLAUDE_MODEL`. Budget caps now apply to both providers. `/health` adds non-secret `aiStatus`. Provider errors map to specific messages with 402/429/502/503/504; unknown server errors return 500.

A real-world booking or other consequential action has not been tested. The user will choose the demonstration later; no fixed demo flow is built into the product.

## Fix: expired Fo sign-in (offline-tested only)
`fo: true` means a live client exists. A refresh or `callTool` that the MCP SDK rejects as unauthorized (`UnauthorizedError`, HTTP 401, or `invalid_grant`) calls `expireIfCurrent` for that connection generation: tokens are removed, the client is closed, and `needsReconnect` becomes true. The panel shows Reconnect. `/fo/connect` (`beginFo`) deletes a stale token set and asks for a new authorization URL instead of staying “connected”.

A rejection before Fo accepts the tool is `NotSubmittedError`: the run is `failed` and the request was not sent. After Fo has accepted a call, a later poll error stays `unknown` (“check Fo activity”) and is not retried. Tool results whose text says unauthorized are Fo’s own reply, not a transport auth failure, so the session stays connected. A newer connect is not clobbered: expiry checks the generation it observed.

No expired-token refresh was exercised against the live Fo endpoint.

## Fix: consequential Fo tools (offline-tested only)
`ask_fo` and read-only `get_*` / `list_*` tools are allowed by default. `start_fo_call` and any other tool name are denied unless `PACT_FO_CONSEQUENTIAL` is exactly `1`. When that env value is set, the server marks the proposal `consequential` and `/actions/approve` still rejects it unless the body includes `confirmConsequential: true`. The server recomputes the policy; the client flag alone is not trusted. Denied tools are omitted from the model’s tool list and, if proposed anyway, withheld with a sentence that nothing was sent.

No live `start_fo_call` was made.
