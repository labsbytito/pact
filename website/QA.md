# Verification — 2026-10-19

Baseline: `origin/rebuild/v2`, `1ef4ac4c252d1d3722cc171ba57f3ffbbadd74af` (PR #3). Website changes isolated on `codex/pact-website`.

Verified locally:

- Static server returns HTTP 200; every page image loaded.
- JavaScript syntax checks passed for app.js and release.js.
- Release manifest tests passed, including pending/unverified states, malformed hashes, non-ZIP URLs, credentials, insecure remote URLs and token query strings.
- Interactive tab clicks change copy and product conversation; ArrowRight selects the next scene with matching ARIA state.
- Get Pact navigates to installation and shows RELEASE BEING PREPARED. Download stays hidden.
- Chrome-address clipboard button displayed its successful copied message.
- Native FAQ opens the intended answer.
- Desktop 1440px, mobile 360px and mobile 420px have document width equal to viewport width. Decorative orbit extends inside its clipped band only.
- Reduced-motion emulation stops companion/card animation; reveal content remains visible.
- No browser warning/error console entries during the reviewed interactions.
- Desktop/mobile screenshots saved in this chat's outputs directory.

Observed and fixed: cramped mobile section title and walkthrough title; clipboard can otherwise remain unresolved while permission is unavailable, so a timed manual-copy fallback is included.

Limitations:

- Release stays pending. The functionality chat reports that backend fixes still need deployment and real own-account Claude/Fo validation. No public download or end-to-end action success is claimed.
- Positive real-release download cannot be exercised until the release owner supplies the verified ZIP. The manifest validation is tested; HEAD availability gating has been inspected but no real ready release has been supplied.
- Website browser QA does not verify the extension's page access, attachments, Fo sign-in, Google Workspace, phone/email, custom tools, or execution outcomes.
- App visual polish remains with Cursor cloud; this branch does not alter the extension.
- No production publication or merge performed.
