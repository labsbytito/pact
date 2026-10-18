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

A real-world booking or other consequential action has not been tested. The user will choose the demonstration later; no fixed demo flow is built into the product.
