# Extension functionality handoff

Branch: `codex/extension-functionality`, based on `rebuild/v2` at `1ef4ac4` (PR #3). PR #3's daily UTC budget fix is preserved. This branch is a release candidate, not a deployed release.

## Implemented

- Composer + opens a real local file picker. Up to three files: UTF-8 text/Markdown/CSV/TSV/JSON/log/XML/YAML (24KB each), PDF (900KB each), PNG/JPEG/WebP/GIF (10MB input, resized by the existing image pipeline). Word/spreadsheet binary formats explicitly request PDF/CSV export.
- Text reaches Claude's prompt; images and PDFs become native Messages API content blocks on both streaming and standard requests. Base64 is never cut to meet a request budget. Requests over 2MB fail clearly. Invalid/missing file content fails validation. The optional Claude Code adapter rejects image/PDF input rather than pretending to read it.
- Files can be removed before submission, remain in the local chat for later questions, and are removed with the deleted chat. Up to the three most recent attachments in the last 24 messages are re-sent as context. No previews are sent. Failed turns retain files for retry. Chrome storage failures are shown.
- History supports New Pact, rename, pin, archive/restore and confirmed deletion. New Pacts choose a name, shape and color; existing companion choices are immutable. Legacy Pacts snapshot the previous global companion once. Settings edit defaults for future Pacts. Manual titles, pin/archive state and deletion survive stale streaming/poll snapshots. Deleted chat/file contents are removed while action evidence remains.
- First-use concurrent API requests share one install token. New installs stay isolated from other Fo accounts. Clearing account data stops local reply/poll work so late callbacks cannot recreate chats.
- Fresh hosted sessions restore their own encrypted Fo credentials before listing tools. Live custom tools can be proposed using their schemas; unfamiliar/consequential direct tools require review. An operator can disable them with `PACT_FO_CONSEQUENTIAL=0`. Only automatically bypassed research receives a no-contact/no-commit guard; reviewed requests retain the user's approved operation. Existing idempotency and action journals remain in place.
- Connections describes the broad Fo layer and lists actual live MCP tools as available. It does not infer Gmail/Calendar connection from tool names. Page permission requests begin in the click gesture; the panel distinguishes a captured page from a mere page label and refreshes invocation labels.
- Production build preserves the configured hosted origin. The packaging script includes compiled artifacts only, rejects unexpected files/symlinks/credential-like content, writes a visual installation guide and deterministic ZIPs with SHA-256 hashes. No Fo MCP host permission is needed in this server-side architecture; Fo calls happen on the backend.

## Validation on 19 October 2026

- Extension TypeScript: passed.
- Backend TypeScript: passed.
- Extension tests: **141 passed, 0 failed**.
- Backend tests: **21 passed, 0 failed** (includes existing budget accounting tests).
- WXT production build: passed; correct hosted origin in manifest.
- Next production build: passed.
- Loaded compiled MV3 build into isolated Chromium. Browser checks passed at 360 and 420 widths: attach distinctive text; inspect real submitted HTTP body; remove/add behavior; library rename/pin/archive/restore/delete; new companion name/shape/color; reopen/persistence; no page errors or horizontal overflow. Network inference replies were controlled test responses, not live Claude output.
- Actual compiled `page-reader.js` injected into a controlled HTTPS page through Chrome scripting returned its distinctive page text and title. This is not proof of YouTube captions or every real site.
- Unit delivery test traces distinctive file text through client preparation, request validation and Claude message content. PDF/image tests preserve exact native content blocks and reject malformed inputs.
- Fo session test restores Alice's saved test credentials across new per-request sessions while Bob remains signed out. No live Fo action was submitted.
- Fresh public install issuance and authenticated `/api/health` returned 200: configured true, modelVerified true, budget ok, demo false, Fo signed out for that new install. Model availability is not proof of successful inference.
- Two package runs produce identical judge ZIP bytes; ZIP CRC/integrity check passed. No credentials or source are included. The manifest public key is intentional to preserve the extension ID.

Commands: `node node_modules/typescript/bin/tsc --noEmit`, backend `tsc --noEmit`, `node --import tsx --test --test-reporter=tap tests/*.test.ts`, corresponding backend tests, `node node_modules/wxt/bin/wxt.mjs build`, backend `node node_modules/next/dist/bin/next build`. The browser check used a separate disposable Chromium profile and controlled API responses. Package with `node scripts/package-judges.mjs [output-directory]` after the final build.

## Release blockers and next verification

Do not mark the website's release contract ready yet. Merge/release coordination must deploy the backend changes from this branch first. Then exercise a distinctive file against real Claude, real Fo OAuth in a fresh Chrome profile, a harmless authorized Fo request, account isolation and panel close/reopen. No inference spend, messages, calls, purchases, merge or production publishing was performed for this task. Those are not implied by these test results.

The package is hosted at build time for `https://pact-nine-lyart.vercel.app`. Judges need no terminal, API key or local server once the matching backend is deployed and verified. They extract `pact-judges.zip`, open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `pact-extension/`. Chrome does not install this extension by dragging a ZIP into Applications. Keep the extracted folder in place.

Website contract: keep `status: pending` until deployment and live checks pass. Then stage the verified ZIP at `/downloads/pact-judges.zip`, set its SHA-256/version, and set `backendStatus: verified`. No public download URL was published here.

Cursor owns visual CSS/companion rendering. This branch changes behavior/components and scoped styles for new controls, not the global visual foundation. Website PR #4 is independent and must be integrated separately.
