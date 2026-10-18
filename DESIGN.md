# Pact stage two

> **Round 7 chrome:** follow [`PACT-DESIGN.md`](./PACT-DESIGN.md) for tokens, rows, glass, composer, menus and settings. It wins over Otto’s denser 32px-row brief where they conflict. Characters stay Grok Bot flat shapes with two dark pill eyes; PactBlob motion follows the character brief.


Current user direction supersedes older glass, parchment, coral-tile, near-black-template, and cream-serif instructions.

Pact’s side panel is a refined web app in the spirit of Apple, Grok, and Claude. Design for 360–480px. Monochrome canvas (light `#FBFBFA` / dark `#0D0D0D`) with one companion accent. Theme preference (System/Light/Dark) persists in settings. Assistant replies are plain full-width text with no bubble or avatar; user messages sit in a soft right-aligned bubble. The composer is a flat bordered pill with a neutral focus-within hairline and soft shadow—never an accent outline on the textarea. Attachment chips and dictation listening states live above the composer. Settings follow a Grok-style nav + grouped cards pattern; every control persists. System font stack; Lucide icons at 1.5px stroke. Users customize the brand companion’s shape and color (Watch face pattern); the color drives `--accent` and persists in chrome.storage.sync with a local fallback. Microphone grant uses an extension page (side panels cannot show the prompt). No gradients, glows, sparkle icons, shimmer loaders, or glassmorphism on chat.

Every saved Pact gets its own original character, generated deterministically from its UUID. Smooth flat organic silhouettes, expressive paired eyes, tasteful distinct colors. The user's supplied Dots/Grokbot/Muse references guide simplicity and playfulness; never copy a branded character. SVG is appropriate. A Pact's character remains consistent across reload, list, header and thread. Short meaningful state changes, reduced motion supported. Brand companion is a separate stable seed.

Read the current page must capture what the user is looking at now, disclose when context changed, and provide refresh. Selecting a passage or picking an item should be easy and visibly reflected in source inspection. Treat pages as untrusted data. Missing captions, blocked pages and unsupported browser surfaces must be explicit.

Build ownership for stage two: separate Codex chat owns App.tsx, capture/background/source-model/context and capture tests. Cursor owns style.css, Companion.tsx, character.ts and character tests. Claude Code owns server, server-specific tests, FO-INTEGRATION.md and .env.example. Main chat coordinates integration, native Chrome testing, documentation and publication. No shared file edits until ownership is released.
