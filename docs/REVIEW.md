# Pact independent review

Reviewed 18 October 2026 against `PACT.md`. Static inspection of capture, local persistence, approval/run tracking, and Fo OAuth. Implementation was being edited concurrently; references below describe the inspected snapshot. Only this review file was intentionally edited. No Fo action, OAuth login, paid API request, or server startup was performed.

## Findings

### 1. [P1] A new reply can erase the action currently executing

**References:** `entrypoints/sidepanel/App.tsx:31-38`; `lib/model.ts:4`.

After approval returns a run ID, `busy` becomes false even while Fo is running. The user can send another message; if Claude proposes another action, `send()` replaces the only `Pact.action`. The polling effect then stops tracking the previous run. A completed action is likewise overwritten, including its returned result, so a card cannot retain its action history as required by PACT.md sections 4 and 14. `retryAI()` also writes an older captured Pact over newer state if a poll completes while interpretation is pending.

**Reproduce:** approve an action, send a follow-up while it is running, and receive another action proposal. The first action remains external work, but disappears from the saved Pact and its result is never collected.

**Fix:** retain actions/runs by stable action ID and append proposals separately. Merge asynchronous responses into the latest Pact and verify the target action/run ID before applying a poll result. Prevent replacing an unresolved run.

### 2. [P1] An accepted action can become untrackable if the approval response is lost

**References:** `server/index.ts:46-54`; `entrypoints/sidepanel/App.tsx:35-38`; `lib/api.ts:5`.

The server consumes `planId`, creates a new run ID, returns it, and starts Fo. If the response is lost, the panel closes, or the subsequent storage write fails, the browser has no durable link to that run. The catch path records `failed` without its server run ID, or reopening shows the pre-request `approved` state; only `running` actions are polled. The server cannot look up a run by the consumed plan ID. A user seeking a new proposal can therefore repeat an action that already happened.

**Reproduce safely with mocks:** let `/actions/approve` accept the request, then reject the client's fetch after acceptance; assert that the original run can be rediscovered without submitting it again. Currently it cannot.

**Fix:** use a stable client/request ID persisted before submission, store its association with the run, and make repeat approval requests return that run. Represent uncertain delivery explicitly and reconcile it instead of calling it a definite failure.

### 3. [P1] Restarting the companion permanently loses execution outcomes

**References:** `server/index.ts:18-19,50-57`; `entrypoints/sidepanel/App.tsx:37-39`.

Runs and their results exist only in a process-local Map. Restart the companion after approval but before the panel saves the terminal result: the saved card still says Fo is working, while every poll returns 404. The polling catch only displays an error and leaves the action running forever. External work might already have completed, and neither its result nor a durable recovery record remains. This is especially relevant while the companion is being restarted during the hackathon.

**Fix:** persist a small run journal before submission and on result, retaining unknown/interrupted states across restart. Handle missing runs as a visible needs-attention state with safe reconciliation guidance; never automatically resubmit uncertain work.

### 4. [P2] Correcting or cancelling an intention leaves the old proposal executable

**References:** `entrypoints/sidepanel/App.tsx:30-33`; `server/index.ts:40,46-50`.

When a new interpretation omits `action`, the UI keeps `latest.action` / `active.action`. For example, after proposing an email, the user says “Don't send that; just help me think.” Claude can correctly return advice with no action, but the old email still offers Review and Approve. The server-held plan also remains valid until expiry. The exact-request dialog is a useful final check, but it does not resolve the incorrect retained proposal.

**Fix:** invalidate an outstanding proposal when its source intention/context is revised, and clear/supersede it when the latest response withdraws executable work. Preserve already-submitted actions as history rather than clearing them.

### 5. [P2] Reopened proposals outlive their server validity

**References:** `server/index.ts:18,40,46-47`; `entrypoints/sidepanel/App.tsx:31,61`.

Saved proposed actions retain `planId` indefinitely, but plans expire after 15 minutes and disappear on companion restart or disconnect. Reopening an old card still presents a normal review/approval flow, which can only fail. This breaks the expected return-to-an-unfinished-Pact flow even without an execution failure.

**Fix:** return and save proposal expiry, reflect it in the card, and regenerate a fresh server-held proposal for review before approval. Do not silently execute regenerated arguments under the old approval.

### 6. [P2] Available transcripts can make interpretation fail at the body limit

**References:** `lib/capture.ts:11,14-24`; `lib/api.ts:11`; `server/index.ts:17,28-34`.

Caption extraction can retain 4,000 segments, with no text-byte budget; the DOM transcript path has no segment limit at all. The client sends the entire transcript plus all messages, but Express rejects bodies over 300 KB before interpretation. As a concrete size example, 4,000 segments with 80 ASCII text characters each already exceed that cap before article text or chat is included. Thus successful transcript capture can prevent the foundational video-to-intention flow from working. Truncation to the first 4,000 segments also omits later playback context without disclosing partial coverage.

**Fix:** construct a bounded interpretation payload using transcript passages around playback plus useful broader context; enforce a UTF-8 byte budget and disclose truncated coverage. Keep the capture separately for inspection. Return a specific size error instead of an opaque JSON-parsing error from the client.

### 7. [P2] Every conversation becomes unusable after 100 saved messages

**References:** `lib/api.ts:11`; `server/index.ts:29,32-34`; `entrypoints/sidepanel/App.tsx:30-33`.

The client submits every saved message. Validation rejects arrays longer than 100 *before* the server slices to the last 24 messages for Claude. After 50 successful exchanges, the next user message is saved as message 101 and permanently fails validation; retry sends the same oversized history. Large histories can hit the body limit earlier.

**Fix:** send only the bounded conversational context needed for interpretation while keeping the local history intact. Apply limits consistently before request serialization and validation.

### 8. [P2] Disconnect does not invalidate OAuth work already in flight

**References:** `server/fo.ts:12,18-23,27-40`.

`disconnectFo()` deletes saved tokens and closes the currently assigned client, but does not invalidate pending state/verifier or cancel/guard an in-flight `connect()` / token exchange. A token refresh or `finishFo()` already awaiting the network can subsequently call `saveTokens()` and assign a connected client after disconnect has returned. A delayed connection can therefore restore the account the user just disconnected.

**Fix:** use a connection generation/cancellation token checked before saving tokens or assigning a client, invalidate pending OAuth state on disconnect, and close clients created by superseded attempts. Test disconnect during token exchange and refresh with mocks.

## Validation and security observations

- `tests/` was empty at inspection. The configured test command references `tests/*.test.ts`; there is currently no regression coverage for approval deduplication, uncertain delivery, run recovery, transcript limits, or OAuth cancellation.
- Attempted `pnpm check` and `pnpm test`; both failed before executing TypeScript/tests because the generated launchers could not find `node`. The command environment also reported missing-bin/chmod warnings. No dependency repair or further setup was attempted. No build or browser end-to-end result is claimed.
- Positive controls in the inspected code: invocation-based active-tab capture; no broad browsing-history collection; explicit missing-transcript status; HTTP(S)-only source links; loopback binding and Host/Origin checks; JSON-only POSTs; server-held action arguments consumed before Fo submission; raw arguments visible for approval; SDK-backed PKCE plus random OAuth state and a ten-minute callback expiry; owner-only permissions requested for newly created credential files; credentials excluded by `.gitignore`; Fo responses labelled as responses rather than verified task completion.
- Actual Wajo OAuth compatibility, supported redirect/authorization origins, refresh behavior, and a genuine Fo-backed result remain **unverified**. The panel restricts authorization URLs to `https://mcp.api.wajo.ai` (`App.tsx:34`); verify the URL returned by the supported flow, since a separately hosted Wajo authorization page would be rejected. This is a compatibility check, not a confirmed defect.
- The server checks that a proposed tool name exists, but does not validate its arguments against that tool's schema (`server/index.ts:38-40`). The ban on financial/destructive/account-creation proposals exists only in the model prompt. Validate arguments and enforce the intended action policy in code before offering approval. This review did not exercise any external tool or infer which live tools the account exposes.

## Recommended immediate order

Keep unresolved runs and action history intact; make approval recoverable across lost responses/restarts; invalidate stale proposals; bound the interpretation payload. Add focused mocked tests for those behaviors and OAuth disconnect races, then perform one explicitly authorized Fo smoke test with the builder once the runtime is ready.
