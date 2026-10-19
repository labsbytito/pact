# Pact website

A self-contained, buildless marketing site. This package is independent of the Chrome extension and its backend. Serve this directory as the static root; no secrets, runtime dependencies, analytics, account forms or external requests are needed (apart from an optional release ZIP hosted elsewhere).

## Preview and checks

- Run `npm run preview` in this directory, then open http://127.0.0.1:4173.
- Run `npm test` for the release manifest safety checks.
- No build step. Deploy only this directory's web assets; omit tests, package.json and Markdown if desired.
- Publication and merge remain reserved for release coordination.

## Design and media

The user supplied `/Users/tito/Downloads/DESIGN (1).md` (Superhuman), `/Users/tito/Downloads/DESIGN (2).md` (Wispr Flow), and the Superhuman website screenshot as visual references. The combined original direction uses Superhuman’s cinematic composition, glass UI, wine/lilac palette and product rhythm, with Wispr Flow’s large editorial serif, cream floating navigation, ink-bordered lavender actions and rounded dark chamber. The user explicitly requested a textured gradient and person-free artwork; this takes precedence over the Wispr document’s flat-color recommendation. Pact’s orange companion and extension identity remain intact. The hero clearly introduces Chrome + Claude + page context + Fo. This does not change the extension theme.

`assets/horizon-texture.webp` is an original AI-edited cinematic textured horizon with no people, optimized to WebP. `assets/inter.woff2` is Inter Variable, distributed under the included SIL Open Font License. The additional EB Garamond variable fonts (regular and true italic) are locally subsetted and distributed under their included SIL Open Font License. SVG companion is native vector artwork based on Pact's existing round orange character. Product examples are deliberately labeled illustrative; no task is executed by the site.

## Release contract

`release.json` starts pending. The functionality/release owner supplies the judge package and confirms the deployed backend plus own-account end-to-end flow before changing it to:

```json
{
  "status": "ready",
  "backendStatus": "verified",
  "version": "0.2.0",
  "downloadUrl": "./downloads/pact-judges.zip",
  "sha256": "<64 hexadecimal characters>"
}
```

Copy the actual verified ZIP to the corresponding path. The page validates schema, version, digest format and URL, then checks artifact availability with HEAD before enabling Download. It rejects HTML fallback responses. The displayed digest is supplied release metadata, not a claim that the browser independently hashed the file. HTTPS URLs must allow CORS for HEAD. Same-origin downloads are preferred. No tokens, credentials, query strings or hashes in the download URL. Never set `verified` merely because compilation succeeded. On malformed, missing or unreachable artifacts the page stays pending.

The ZIP contract agreed with the functionality chat is `START-HERE.html` plus `pact-extension/`, which contains `manifest.json`. The user extracts it, opens `chrome://extensions`, enables Developer mode, selects Load unpacked, and chooses `pact-extension`. Guide verified against https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked on 2026-10-19. Hosted functionality is still the release owner's responsibility.

## Interaction and accessibility

Three manual walkthrough tabs support click, Left/Right arrows and Home/End. Next buttons cycle the same scenes. Role/tab selection state and a polite announcement region follow the selected scene. FAQ uses native details/summary. The Chrome address helper reports clipboard success or exposes the address as fallback. Keyboard focus, skip link and reduced-motion support are included. Motion is limited to paced entrance/reveal, gentle floating/blinking and scene changes. No autoplay task execution or fake sign-in flows.

## File ownership

This branch changes only `website/`. Cursor cloud owns extension CSS, blob rendering and motion. The separate functionality chat owns extension behavior, attachments, chat state, Fo/backend and judge packaging. No extension files, root package files, deployment settings or credentials are altered here.
