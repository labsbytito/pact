# Design source

When these disagree, use them in this order:

1. The Grok Bot screenshots in `docs/refs/` (`grokbot-chat.png`, `grokbot-chat-light.png`, `grokbot-settings.png`).
2. `docs/briefs/pact-ui-ux-brief.md`.
3. `docs/briefs/pact-character-brief.md`.

`styles.refero.design` (Raycast and ChatGPT) fills only the gaps those three do not cover. Do not read or restore `Downloads/DESIGN.md`.

## Light theme

Taken from `grokbot-chat-light.png` and the Grok teardown:

- Canvas `#fcfcfc`, surfaces `#efefef` and `#ffffff`, selected `#e4e4e4`.
- Text `#1a1a1a` / `#5c5c5c` / `#737373`. Dark muted text `#8a8a8a`.
- Light assistant bubbles `#ffffff` with a `#e5e5e5` hairline. Light user bubbles `#e6e6e6`. Dark assistant bubbles are a 6% white fill. Dark user bubbles `#2a2a2a`.
- Dark selected `#242424`. Dark hairline `#292929`.
- Areas separate by tone. No divider lines.
- Composer stays a pill until it wraps past two lines, then the radius is 12px. Send is a 28px circle: white with a `#111` arrow in dark, `#111` with a white arrow in light. It does not use the accent.

Dark tokens stay the ones in `styles/tokens.css`.

## Radii and type

Rows, menu items, and nav items are 6px. Settings cards, menus, and popovers are 10px. Message bubbles are 12px. Buttons and select triggers are 8px. Circles are for 28px icon buttons, swatches, Send, and avatars. A full pill is for chips, mood chips, the status pill, the name pill, the composer, and toggles. Nothing else goes above 12px.

Settings nav is a frosted surface. Below 480px it becomes a horizontal pill row. The settings screen has one back control in the top bar and no close button. Settings rows are 48px. The empty-state companion is 72px. The name-pill companion is 20px. Companion shape previews are 40px. No headline is larger than 15px.

## Motion

Calm, like Grok Bot. The 72px companion follows the pointer a little. Smaller copies stay still. Calm blinks slowly and bobs. Happy eyes are arcs. Thinking glances aside. Sleepy eyes are half closed and do not follow. Animations Off and `prefers-reduced-motion` stop the motion.

## Voice

Copy can be warm, expressive, and full of personality. Clean describes the layout, spacing, radii, and motion, not the voice. Sentences stay natural and well written.
