# Pact shared build
Read PACT.md and DESIGN.md. Do not read or restore Downloads/DESIGN.md. Follow the current assigned scope; no overlapping file edits. Never commit credentials, OAuth tokens, private account details, .local/ or .env. Distinguish proposed/approved/running/Fo replied/verified outcome. Do not send external messages or spend money to test. Report checks actually run. This project is a hackathon prototype, not a deployed service.

## Cloud Agent
`pnpm check` needs `.wxt/tsconfig.json` from `pnpm exec wxt prepare`. On pnpm 10, `pnpm server` is the store server, so start the companion with `pnpm run server`. It listens only on `127.0.0.1:4317` and rejects other Host headers. `pnpm dev --host 127.0.0.1` serves the side panel at `http://127.0.0.1:5173/entrypoints/sidepanel/index.html`. Do not set an API key or connect Fo unless asked.
