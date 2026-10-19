# Design source

When these disagree, use them in this order:

1. The Grok Bot screenshots in `docs/refs/` (`grokbot-chat.png`, `grokbot-chat-light.png`, `grokbot-settings.png`).
2. `docs/briefs/pact-ui-ux-brief.md`.
3. `docs/briefs/pact-character-brief.md`.

`styles.refero.design` (Raycast and ChatGPT) fills only the gaps those three do not cover. Do not read or restore `Downloads/DESIGN.md`.

## Light theme

Taken from `grokbot-chat-light.png` and the Grok teardown:

- Canvas `#fcfcfc`, surfaces `#efefef` and `#ffffff`, selected `#e4e4e4`.
- Text `#1c1c1c` / `#646464` / `#8d8d8d`.
- Assistant bubbles `#efefef`. User bubbles `#1c1c1c` with white text.
- Dark selected `#242424`. Dark hairline `#292929`.
- Areas separate by tone. No divider lines.
- Composer stays a pill. The send control stays a 24px circle so its radius stays at 12px. It is inverse with an up arrow when there is text, and muted when empty.

Dark tokens stay the ones in `styles/tokens.css`.

## Radii and type

Rows, menu items, and nav items are 6px. Settings cards, menus, and popovers are 10px. Message bubbles are 12px. Buttons are 8px. Avatar cards are 8px. A full pill (9999px) is for the name pill, the composer, the 24px context chips, compact dropdown triggers, mood chips, and the 32×18 toggles. Nothing else goes above 12px. The send control is a 24px circle.

Settings at 420px and up use a left nav with an icon on each item. Below 420px, settings is a list that opens a detail view with a back arrow. Settings rows are 48px. The settings title is 15px / 600. The empty-state companion is 72px. Companion shape previews are 40px. No headline is larger than 15px.

## Motion

Calm, like Grok Bot. The companion does not follow the pointer. Blinks and breathing stay slow. Every animation respects `prefers-reduced-motion`. Nothing jumps or bounces.

## Voice

Copy can be warm, expressive, and full of personality. Clean describes the layout, spacing, radii, and motion, not the voice. Sentences stay natural and well written.
