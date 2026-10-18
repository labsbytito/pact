# Pact

**A little intention. A real next step.**

Pact is a conversational Chrome side-panel companion for turning web discoveries into action. Read a page when you choose, talk through an intention, save a Pact, and review a concrete request before Fo receives it.

## Run locally

Requires Node 22+ and pnpm. This is a local hackathon prototype; the companion is not a multi-user hosted service.

```sh
pnpm install
pnpm build
pnpm server
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`. Open an ordinary webpage and click the Pact toolbar icon to grant access to that page. Click **Start with this page** to capture its context. Chrome internal pages and the Web Store cannot be captured.

For visual preview, serve `.output/chrome-mv3` on `http://127.0.0.1:5173` and open `/sidepanel.html`. A normal web preview cannot read other tabs; page capture needs the extension.

### Intelligence

Choose a permitted Claude API key on the companion, never in the extension:

```sh
ANTHROPIC_API_KEY=your_key ANTHROPIC_MODEL=your_model pnpm server
```

For **local development/testing only**, an opt-in adapter can use an already signed-in Claude Code CLI without reading or copying its credentials:

```sh
PACT_AI=claude-code PACT_AI_REQUEST_CAP=0.15 PACT_AI_SESSION_CAP=1 pnpm server
```

The CLI adapter disables all tools and MCP servers. It reserves the full per-request cap conservatively in `.local/ai-usage.json` and refuses further requests at the total cap, including after restarts. Each message can use existing API credit. It is not a production inference service or an entitlement to use restricted credits outside their terms. No account balance is assumed by the application.

### Fo

Choose **Settings → Connections → Connect Fo → Continue to Wajo**. Authenticate using Wajo's own page. Pact uses SDK-backed OAuth PKCE and dynamic public-client registration. Its callback is `http://127.0.0.1:4317/oauth/callback`. Access and refresh tokens stay in the ignored, owner-readable `.local/` directory; no Wajo password is collected.

Fo is optional for saving Pacts and chatting. The local companion must be running for AI and Fo. Connecting or disconnecting does not remove saved Pacts.

## What is implemented

- React / TypeScript / WXT Manifest V3 side panel; original CSS companion, responsive layout and reduced motion.
- Invocation-based active-tab capture, source inspection, selected text, video position, available YouTube captions and explicit transcript failure.
- Persistent local Pact conversations, next-step proposals, archived Pacts and preserved action history.
- Claude interpretation with bounded conversation/transcript context that prioritizes the current video moment.
- Live Fo tool discovery, schema-validated requests, exact request review, single-use idempotent approval and durable run journal.
- Polling of long-running Fo replies; private per-Pact conversation handles; uncertain outcomes stay uncertain across restarts.
- Optional editable speech dictation where Chrome supports it.

## Honest limits

Caption extraction depends on YouTube availability and page structure. Missing speech is disclosed. The companion's tool list reflects what the linked Fo account exposes; it does not guarantee bookings, payments or messaging work. A Fo reply is displayed as a reply, not proof that every requested task completed. Interrupted actions are never retried automatically.

The current local prototype is single-user. Chrome permissions include `activeTab`, `scripting`, `storage`, `sidePanel`, `identity`, plus the loopback companion host. No browsing-history permission or all-sites host access is requested. Page context is shared with Claude when a message is sent; Fo receives an approved task. Direct web content is treated as untrusted context.

## Verify

```sh
pnpm check
pnpm test
pnpm build
```

The tests cover duplicate approvals, lost responses, restart recovery, uncertainty, schema rejection, action history, transcript/conversation budgets, and Fo progress polling. See [PACT.md](PACT.md), [DESIGN.md](DESIGN.md), and [FO-INTEGRATION.md](FO-INTEGRATION.md).
