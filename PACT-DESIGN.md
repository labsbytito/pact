# Pact — DESIGN.md (side panel, 360–480px)
> Grok Bot's desktop app, shrunk into a Chrome side panel. Near-black graphite, subtle glass, neutral white actions, colorful flat characters.

**Theme:** dark first, light second.
**Base styles (Refero):**
- **Raycast** (primary, dark): https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8 (`raycast.md`)
- **ChatGPT** (secondary, chat-app structure and light theme): https://styles.refero.design/style/52a007ed-ad1b-46a6-bd44-b76f91df6d0c (`chatgpt.md`)
- Minor: **Linear** https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1 (`linear.md`), for density, hairlines and weight band.

**Source tags:** [RAY] Raycast DESIGN.md · [GPT] ChatGPT DESIGN.md · [LIN] Linear DESIGN.md · [GROK] Tito's Grok Bot desktop screenshot · [ADAPT] my change for a 360–480px panel.

**Rules for the coding agent:**
- This is a rollback in spirit. Pact should feel *familiar*, like Grok Bot, ChatGPT and Claude. Don't invent a new look.
- Achromatic chrome. The only real color in the UI is the characters [RAY "98% achromatic"] [GPT "zero chromatic accents"].
- Keep the existing animated characters and Otto's motion spec (`/workspace/briefs/pact-character-brief.md`). This file only covers the chrome around them.

---

## 1. Color tokens

### Dark (default)
Raycast's canvas is #040506. Grok Bot's app reads as a lifted graphite (~#1a1a1a–#202020), so the surfaces are raised toward Grok Bot and Raycast's step logic is kept [RAY+GROK].

| Token | Value | Role | Source |
|---|---|---|---|
| `--bg` | `#111214` | Panel canvas behind everything | [RAY Obsidian] |
| `--bg-raised` | `#1a1b1d` | Thread list, settings groups, assistant bubbles | [GROK] tuned off [RAY Graphite #1b1c1e] |
| `--bg-elevated` | `rgba(30,31,34,0.72)` + blur | Menus, popovers, composer (glass) | [RAY glass nav] [ADAPT] |
| `--fill-hover` | `rgba(255,255,255,0.05)` | Row/button hover | [RAY inset input fill 0.05] [LIN pill 0.05] |
| `--fill-selected` | `rgba(255,255,255,0.08)` | Selected conversation row | [GROK] [ADAPT] |
| `--fill-press` | `rgba(255,255,255,0.10)` | Pressed | [ADAPT] |
| `--hairline` | `rgba(255,255,255,0.08)` | Dividers, 1px borders | [LIN input border 0.08] |
| `--hairline-strong` | `#363739` | Glass surface edge | [RAY nav border] |
| `--highlight-top` | `rgba(255,255,255,0.10)` | 1px inset top highlight on glass | [RAY subtle-5] |
| `--text-1` | `#ffffff` | Titles, message text | [RAY Pure White] |
| `--text-2` | `#9c9c9d` | Previews, labels, icons | [RAY Ash] |
| `--text-3` | `#6a6b6c` | Timestamps, placeholders, hints | [RAY Smoke] |
| `--action` | `#e6e6e6` | Primary filled button / send button / user bubble | [RAY Mist neutral CTA] [GROK white send + white user pill] |
| `--on-action` | `#111214` | Text and icons on `--action` | [RAY Iron→dark] [ADAPT] |
| `--danger` | `#ff6363` | Delete item text, error caption only | [RAY Coral Pulse] |
| `--success` | `#59d499` | Connected dot (Fo, server) | [RAY Success Green] |
| `--focus` | `rgba(255,255,255,0.35)` | 2px focus ring | [ADAPT] |
| `--scrim` | `rgba(0,0,0,0.5)` | Dialog backdrop | [GPT Deep Charcoal] |

### Light
Raycast has no light theme, so light comes straight from ChatGPT [GPT].

| Token | Value | Source |
|---|---|---|
| `--bg` | `#f9f9f9` | [GPT Sidebar Mist] |
| `--bg-raised` | `#ffffff` | [GPT Pure White] |
| `--bg-elevated` | `rgba(255,255,255,0.78)` + blur | [ADAPT] |
| `--fill-hover` | `rgba(0,0,0,0.05)` | [GPT Hover Veil #0000000d] |
| `--fill-selected` | `rgba(0,0,0,0.07)` | [ADAPT] |
| `--hairline` | `rgba(0,0,0,0.10)` | [GPT Hairline #0000001a] |
| `--hairline-strong` | `#e6e6e6` | [GPT Edge Gray] |
| `--highlight-top` | `rgba(255,255,255,0.9)` | [ADAPT] |
| `--text-1` | `#0d0d0d` | [GPT Graphite Ink] |
| `--text-2` | `#5d5d5d` | [GPT Mid Ash] |
| `--text-3` | `#8f8f8f` | [GPT Hollow] |
| `--action` | `#0d0d0d` | [GPT] (inverted pill) |
| `--on-action` | `#ffffff` | [GPT] |
| `--danger` | `#d93636` | [ADAPT] (coral darkened for contrast) |

---

## 2. Typography
Use the system stack and no webfonts [GPT "Do not load custom webfonts"]. On Mac it renders SF Pro, which gives the Apple feel for free.
`font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif;`
Use weights 400/500/600 only [RAY 400–600] [LIN "no 700+"]. Use `font-variant-numeric: tabular-nums` for timestamps. Use sentence case everywhere: no uppercase tracked eyebrows in Settings or lists [ADAPT; Raycast's 11px eyebrow is deliberately not used].

| Role | Size / weight / line-height | Tracking | Source |
|---|---|---|---|
| Panel title (header) | 15 / 600 / 1.3 | -0.01em | [LIN 15px -0.011em] |
| Greeting heading | 20 / 600 / 1.25 | -0.012em | [LIN 20px] [GPT ≤24px rule] |
| Message body | 14 / 400 / 1.55 | 0 | [ADAPT from GPT 16/1.5 for panel width] |
| Row title | 14 / 500 / 1.3 | 0 | [GPT Conversation Card 14/500] |
| Row preview | 13 / 400 / 1.35 | 0 | [GPT preview 13] |
| UI label / button / menu item | 13 / 500 | 0.008em | [RAY 13px/500] |
| Meta / timestamp / caption | 12 / 400 | 0 | [RAY 12px] [LIN label 12] |
| Settings group header | 12 / 500, text-3, sentence case | 0 | [ADAPT] |
| Code / IDs / shortcuts | 12 ui-monospace | 0 | [RAY GeistMono, LIN Berkeley Mono → system mono] |

---

## 3. Radii
The scale is short [LIN "three radii is the entire vocabulary"] and sized for a narrow panel [ADAPT].

| Element | Radius | Source |
|---|---|---|
| Badges, kbd, tiny chips | 6px | [RAY badges 6] [LIN buttons 6] |
| Rows, buttons, inputs, menu items | 10px | [GPT 10px for buttons/rows/cards] |
| Menus, popovers, settings groups, bubbles | 14px | [ADAPT between GPT 10 and RAY 16] |
| Composer, user bubble, suggestion chips, send button, toggles | 9999px (pill) | [RAY pills] [GROK pill composer] |
| Character avatars | none (the shape *is* the avatar) | [GROK] |

## 4. Spacing
- 4px base, compact density [LIN].
- Use steps 4, 6, 8, 10, 12, 16, 20, 24 [GPT 6/10/16/24] [LIN 4/8/12].
- Panel side padding 12px at 360px and 16px at ≥420px [ADAPT].
- Gap between list sections 16px. Gap between messages 12px, or 4px for same-author runs [ADAPT].

---

## 5. Glass surfaces
Raycast is the reference: a floating glass bar with `backdrop-blur(48px)`, a 1px #363739 border and a 1px white inset top highlight [RAY]. Glass appears in three places only: the header, the composer and menus. Large panels are never glass [ADAPT].

```css
.glass {
  background: var(--bg-elevated);                 /* 72% dark / 78% light */
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);     /* RAY uses 48px; 24px reads better at panel scale [ADAPT] */
  border: 1px solid var(--hairline-strong);
  box-shadow:
    rgba(255,255,255,0.10) 0 1px 0 0 inset,       /* [RAY subtle-5] top highlight */
    rgba(0,0,0,0.40) 0 8px 24px 0;                /* soft lift, menus/composer only [RAY xl, softened] */
}
```
- Glass needs something behind it. Keep **one** very soft, slow radial glow in the companion's color at ≤8% opacity behind the canvas, like Raycast's single atmospheric hero moment [RAY Hero Gradient, toned way down]. Nothing else is tinted.
- Header: sticky, 44px tall, transparent at the top. It turns `.glass` with a bottom hairline only once content scrolls under it [ADAPT].

---

## 6. Conversation list rows (Grok Bot style, two-line)
Follows [GROK] and [GPT Conversation Card]:
```
[avatar 28] Title (14/500, text-1, 1 line, ellipsis)         2:14 PM (12, text-3, tabular)
            Preview (13/400, text-2, 1 line, ellipsis)
```
- Height 52px, padding 8px 10px, radius 10px, gap 10px between avatar and text [ADAPT from GPT 6/10 padding].
- The row has no fill by default. Hover is `--fill-hover` at 120ms, selected is `--fill-selected`, with no left bar or accent [GPT "chrome recedes until hovered"].
- On hover, show a ⋯ button (24px, radius 6) that replaces the timestamp. Right-click opens the same menu.
- Pinned section appears only when something is pinned. Section headers are 12/500 text-3 in sentence case, with 16px above and 4px below them.
- Search field at top: 32px tall, radius 10, `--fill-hover` background, 13px text, placeholder in text-3 [RAY Inset Input, sized down].

## 7. Character avatars (keep, Grok Bot style)
- Flat solid-color shapes: circle, rounded square, triangle-blob, cloud, drop, flower and hexagon. No gradients and no outline [GROK]. Use saturated colors: violet #8b5cf6, orange #ff8a1f, pink #ff3d8b, teal #14b8a6, red #ff4545, blue #2f7bff, white #f5f5f5, brown #9a6a4a and yellow #ffb020 [GROK].
- Eyes: **two dark vertical pills** (#111 on light shapes, #111 at 85% on dark), each about 9% of the shape's width and 22% of its height, spaced about 22% apart, sitting slightly above centre [GROK]. Variants can tilt the eyes for a mood (`^ ^` happy). No mouth by default.
- Sizes: 28px in rows, 24px in the header, 72–96px on the greeting/empty state.
- All animation (blink, breathe, eye-follow, greeting hop, thinking sway, sleepy) follows Otto's character brief unchanged. The chrome must never compete with it: nothing else in the UI loops.

## 8. Messages
- **User:** right-aligned pill bubble with `--action` fill and `--on-action` text, radius 18px (pill-ish for one line, 14px when multi-line), padding 8px 14px, max-width 80% [GROK white user pill].
- **Assistant:** no bubble by default. Plain text on canvas in text-1, like ChatGPT and Claude [GPT]. Tool/status cards (Fo results, page-read summaries) use `--bg-raised`, radius 14, a 1px hairline and 10px 12px padding [GROK checklist card].
- Status line ("Reading page…", "Asking Fo…"): 12px text-2 with a tiny character pulse, centered or inline [GROK "Messages from…" line].
- Message actions (copy, regenerate, edit) are 24px ghost icons in text-3 that appear on hover [GPT Compact Icon Button].

## 9. Composer (floating glass pill)
- `.glass` with a 9999px radius, min-height 44px and padding 6px 6px 6px 14px. It floats 10px above the bottom and is inset 10px from the sides [RAY glass] [GROK pill composer].
- Left: a 28px ghost `+` button for attachments and page context, in text-2. Right: a 32px circular send button in `--action` with an `--on-action` arrow [GROK white circle send] [RAY neutral CTA]. While streaming it becomes a stop square.
- The textarea is 14px, placeholder "Message Pact" in text-3, auto-grows to 6 lines, and the radius drops to 18px once it wraps [ADAPT].
- Context chips (page, file) sit above the input inside the pill: 24px tall, radius 9999, `--fill-hover` background, 12px text [LIN Pill Button 0.05 fill].
- Focus: the border brightens to `rgba(255,255,255,0.18)`. No glow, no color [LIN "border brightens"].

## 10. Menus (⋯ and right-click)
- `.glass`, radius 14, padding 4px, min-width 200px [RAY + ADAPT].
- Items are 32px tall, radius 10, padding 0 10px, 13/500 text-1, with a 16px icon in text-2 and the shortcut in 12px text-3 on the right [GPT row radius] [RAY 13/500].
- Hover and keyboard highlight use `--fill-selected`. Separators are 1px `--hairline` with 4px vertical margin.
- Order: Pin · Rename… · Move to section ▸ · Archive · ─ · Delete. Delete is `--danger` text with no red fill, and it comes last [Otto UI brief].
- Destructive actions use an undo toast (glass pill, bottom centre, 5s) instead of confirm dialogs.

## 11. Settings (match Tito's Grok Bot settings screenshot)
- Tabs at top: a segmented control in a pill with `--fill-hover` track. The active segment is `--bg-raised` with a `--highlight-top` inset. 28px tall, 12/500 [RAY key-cap inset, small].
- Groups use `--bg-raised` cards with radius 14, a 1px hairline and no shadow [GPT surface card]. The group header sits *above* the card in 12/500 text-3, sentence case.
- Rows are 44px, padding 0 12px, label on the left (13/400 text-1) and value or control on the right (13/400 text-2). Separators are inset 12px from the left [Apple HIG grouped list, via Otto] [ADAPT].
- An optional description sits under the label in 12/400 text-3. That row grows to about 56px.
- Toggles are 32×18 pills. Off is `rgba(255,255,255,0.12)`, on is `--action`, and the knob is `--bg`-coloured when on and white when off. Selects are a ghost value plus a chevron that opens the same glass menu.
- Character editor: a horizontal row of shape swatches (36px, radius 10, selected = 1.5px `--text-1` ring) and a row of 24px color dots. The live 72px preview character sits at the top of the group.
- No big blocky panels, no colored section icons and no uppercase.

## 12. Buttons
| Type | Spec | Source |
|---|---|---|
| Primary | `--action` fill, `--on-action` text, 13/500, height 32, radius 9999, padding 0 14 | [RAY Mist CTA] [GPT pill button] |
| Secondary | transparent, 1px `--hairline-strong`, text-1, height 32, radius 9999 | [LIN ghost] |
| Ghost / icon | transparent, text-2 → text-1 on hover, 28px square, radius 10 | [GPT Compact Icon Button] |
| Suggestion chip | `--fill-hover`, text-1, 13/400, height 30, radius 9999 | [LIN Pill Button] |

## 13. Motion
- Durations 120 / 180 / 240ms. Use ease-out `cubic-bezier(0.2,0,0,1)` for UI and `cubic-bezier(0.16,1,0.3,1)` for menu entrances [Otto UI brief].
- Hover is a background-color change only, 120ms. Press is `scale(.97)` at 100ms. Never use `transition: all` [Otto].
- Menus and popovers: opacity 0→1 and scale .96→1 over 140ms from the trigger origin, with a 100ms exit.
- Messages: fade in and rise 4px over 180ms. Use a streaming caret, not a spinner.
- The header glass fades in over 180ms when content scrolls under it.
- The character is the only thing that moves when idle. Under `prefers-reduced-motion`, keep only fades and the 6–10s blink.

## 14. Don'ts
- Don't add a chromatic accent (no orange, blue or brand gradients) to buttons, links, focus rings or selected states [RAY][GPT].
- Don't use uppercase tracked labels or weights of 700 and up [LIN].
- Don't put shadows on cards or settings groups. Shadows are for floating glass (menus, composer, toast) only [RAY][GPT].
- Don't use radii above 14px except pills [LIN "no 16px+ on cards", adapted].
- Don't use blur on large panels or stack glass on glass.
- Don't use pure black #000 for text or pure white #fff canvases in light mode [GPT].

## 15. Drop-in tokens
```css
:root, [data-theme="dark"] {
  --bg:#111214; --bg-raised:#1a1b1d; --bg-elevated:rgba(30,31,34,.72);
  --fill-hover:rgba(255,255,255,.05); --fill-selected:rgba(255,255,255,.08); --fill-press:rgba(255,255,255,.10);
  --hairline:rgba(255,255,255,.08); --hairline-strong:#363739; --highlight-top:rgba(255,255,255,.10);
  --text-1:#fff; --text-2:#9c9c9d; --text-3:#6a6b6c;
  --action:#e6e6e6; --on-action:#111214; --danger:#ff6363; --success:#59d499;
  --focus:rgba(255,255,255,.35); --scrim:rgba(0,0,0,.5);
  --r-xs:6px; --r-sm:10px; --r-md:14px; --r-pill:9999px;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
  --ease:cubic-bezier(.2,0,0,1); --ease-pop:cubic-bezier(.16,1,.3,1);
  --t-fast:120ms; --t-med:180ms; --t-slow:240ms;
  --glass-blur:saturate(180%) blur(24px);
  --glass-shadow:rgba(255,255,255,.10) 0 1px 0 0 inset, rgba(0,0,0,.40) 0 8px 24px 0;
}
[data-theme="light"] {
  --bg:#f9f9f9; --bg-raised:#fff; --bg-elevated:rgba(255,255,255,.78);
  --fill-hover:rgba(0,0,0,.05); --fill-selected:rgba(0,0,0,.07); --fill-press:rgba(0,0,0,.09);
  --hairline:rgba(0,0,0,.10); --hairline-strong:#e6e6e6; --highlight-top:rgba(255,255,255,.9);
  --text-1:#0d0d0d; --text-2:#5d5d5d; --text-3:#8f8f8f;
  --action:#0d0d0d; --on-action:#fff; --danger:#d93636; --success:#1f9d63;
  --focus:rgba(0,0,0,.35);
  --glass-shadow:rgba(255,255,255,.9) 0 1px 0 0 inset, rgba(0,0,0,.10) 0 8px 24px 0;
}
```

## QA before demo
Check 360px and 480px, dark and light, and reduced motion. Compare side by side with the Grok Bot screenshot. If anything is more colorful or more "designed" than Grok Bot, tone it down.
