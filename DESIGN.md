# Pact stage two

Current user direction supersedes older glass, parchment, coral-tile, near-black-template, and cream-serif instructions.

Pact’s side panel is a refined web app in the spirit of Apple, Grok, and Claude. Design for 360–480px. Monochrome canvas (light `#FBFBFA` / dark `#161616`) with one companion accent. Assistant replies are plain full-width text with no bubble or avatar; user messages sit in a soft right-aligned bubble. The composer is a flat bordered pill with a neutral focus-within hairline and soft shadow—never an accent outline on the textarea. System font stack. Users customize the brand companion’s shape and color (Watch face pattern); the color drives `--accent` and persists in chrome.storage.sync with a local fallback. No gradients, glows, sparkle icons, shimmer loaders, or glassmorphism on chat.

Every saved Pact gets its own original character, generated deterministically from its UUID. Smooth flat organic silhouettes, expressive paired eyes, tasteful distinct colors. The user's supplied Dots/Grokbot/Muse references guide simplicity and playfulness; never copy a branded character. SVG is appropriate. A Pact's character remains consistent across reload, list, header and thread. Short meaningful state changes, reduced motion supported. Brand companion is a separate stable seed.

Read the current page must capture what the user is looking at now, disclose when context changed, and provide refresh. Selecting a passage or picking an item should be easy and visibly reflected in source inspection. Treat pages as untrusted data. Missing captions, blocked pages and unsupported browser surfaces must be explicit.

Build ownership for stage two: separate Codex chat owns App.tsx, capture/background/source-model/context and capture tests. Cursor owns style.css, Companion.tsx, character.ts and character tests. Claude Code owns server, server-specific tests, FO-INTEGRATION.md and .env.example. Main chat coordinates integration, native Chrome testing, documentation and publication. No shared file edits until ownership is released.
