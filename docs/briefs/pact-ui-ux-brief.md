# Pact UI/UX brief: making it feel premium (Oct 19, ~1:45 AM EAT, by Otto)
Tags: [DOC] = value from the cited source; [REC] = Otto's recommendation. No primary source publishes the exact CSS of Claude.ai, ChatGPT, Grok, Perplexity, Arc/Dia, Notion or Raycast, so this never claims "app X uses Y".

## 0. What the PR #1 branch (cursor/premium-side-panel-1291) has now
Good already: monochrome tokens with alpha hairlines (rgba(0,0,0,.08) / rgba(255,255,255,.08)), system-ui font stack, ease-out cubic-bezier(.22,1,.36,1), 120/200/300ms durations, tabular numbers on sidebar counts, 44px settings rows inside grouped cards.
Gaps that look budget:
1. Conversation rows are 48px and two lines (title + preview) with an avatar, which fills a narrow panel with blocks.
2. Corners too big: settings cards use --r-lg 18px, composer --r-xl 24px.
3. Section labels are 11px uppercase with 0.04em letter-spacing, which reads as a template.
4. No row actions in App.tsx: no onContextMenu, no ⋯ menu, no rename/delete/pin, no undo toast. Only Archive exists.
5. Little motion: only spin/blink/glance/pulse/voice-pulse keyframes. Menus and popovers don't animate in. No skeletons or toasts.

## 1. Density and scale
- [DOC] Apple HIG macOS text styles, size/line height in pt: Body 13/16, Headline 13/16 bold, Callout 12/15, Subheadline 11/14, Footnote/Caption 10/13, Title 3 15/20, Title 2 17/22. macOS default 13pt, minimum 10pt; iOS Body 17/22. https://developer.apple.com/design/human-interface-guidelines/typography
- [DOC] HIG Buttons: hit areas at least 44x44pt. https://developer.apple.com/design/human-interface-guidelines/buttons
- [DOC] Vercel guidelines: expand any visible target under 24px to a 24px+ hit area on desktop; 44px minimum on mobile. https://vercel.com/design/guidelines
- [DOC] shadcn sidebar (sidebar.tsx in the open-source registry):
  - Menu button h-8 (32px), text-sm 14px, p-2, rounded-md, gap-2, 16px icons, title truncated.
  - Small variant h-7 (28px) with text-xs.
  - Group label h-8, 12px, font-medium, foreground at 70% opacity.
  - Sidebar width 16rem.
  - Row actions use showOnHover: opacity-0, shown on group hover, focus-within or open menu.
  - https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/sidebar.tsx
- [DOC] Linear redesign: goals were to "reduce visual noise, maintain visual alignment, and increase the hierarchy and density of navigation elements". They often relied on Apple standards and aligned labels, icons and buttons on both axes. https://linear.app/now/how-we-redesigned-the-linear-ui
- [REC] Pact at 360-480px:
  - One-line 32px conversation rows: 13px/500 title, 12px meta in text-3 on the right. No preview line or per-row avatar in the list; keep the avatar in the conversation header.
  - Nav rows 32px; section labels 12px/500 in sentence case.
  - Settings rows 40px with 12px horizontal padding.
  - 14px body only in the conversation and composer; 13px elsewhere.
  - Corners: 6px rows and menu items, 10px cards and menus, 16px max for the composer.

## 2. Conversation list management
- [DOC] HIG Context menus: keep the menu small and only the most-used actions. Delete goes last and is marked destructive. Hide unavailable items rather than dimming them. At most one submenu level. Every action must also be reachable elsewhere, and menus stay consistent. https://developer.apple.com/design/human-interface-guidelines/context-menus
- [DOC] Radix Context/Dropdown Menu: opens on right-click or long-press. Roving focus: up/down move, Enter/Space activate, Esc closes, typeahead. --radix-*-content-transform-origin lets the menu animate from where it opened. https://www.radix-ui.com/primitives/docs/components/context-menu
- [DOC] shadcn dropdown:
  - Menu: p-1, rounded-md, border, shadow-md, min-w 8rem.
  - Item: px-2 py-1.5 text-sm rounded-sm, 16px muted icons; destructive variant is red text with a red/10 background on focus.
  - Animates in with fade, zoom-in-95 and a 2-unit slide from the trigger side.
- [DOC] Vercel guidelines: labels that open a follow-up end in "…" (e.g. Rename…). "Confirm destructive actions. Require confirmation or provide Undo with a safe window." Use optimistic updates with rollback or undo on failure. Announce toasts with aria-live="polite".
- [REC] Pact spec:
  - ⋯ button (24px visible, 32px hit area) shows on row hover or focus and stays visible while its menu is open. Right-click opens the same menu.
  - Items: Pin/Unpin · Rename… · Archive · separator · Delete (red, last).
  - Rename happens inline: Enter saves, Esc cancels, blur saves, select all on open, F2 triggers it when the row has focus.
  - Delete and Archive happen immediately with an undo toast ("Pact deleted · Undo", 5s). Confirmation dialog only for "Delete all".
  - Pinned section at the top, shown only when something is pinned.
  - Skip folders/projects today (L effort).

## 3. Settings
- [DOC] HIG Lists and tables: iOS Settings is a hierarchy of lists with short item text. https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- [DOC] HIG Layout: group related items with spacing, container shapes or separators, and use progressive disclosure. https://developer.apple.com/design/human-interface-guidelines/layout
- [DOC] Vercel: nested corners are concentric, child radius ≤ parent.
- [REC] Grouped inset list:
  - Card: --surface-2, 10px corners, no border in light mode; hairline border instead of a shadow in dark mode.
  - Rows 40px, padding 0 12px, separators inset 12px from the left (::before with left:12px), not full width.
  - Label 13px/400 in --text; value 13px in --text-2 aligned right; 12px chevron in text-3.
  - Section header 12px/500 sentence case in text-2, 20px above and 6px below. Footnote 12px in text-3.
  - Toggles 32x18.
  - No uppercase labels and no stacked full-width inputs; put those in a sub-page.

## 4. Motion and micro-interactions
- [DOC] Emil Kowalski, Great Animations (https://emilkowal.ski/ui/great-animations):
  - Ease-out, mostly under 300ms.
  - Never animate keyboard-triggered actions.
  - Animate only transform and opacity, using interruptible CSS transitions.
  - Respect prefers-reduced-motion.
  - Raycast "has no animations and it feels right".
  - Sonner deliberately uses ease, a bit slower, to feel elegant.
- [DOC] Sonner defaults (github.com/emilkowalski/sonner):
  - 4000ms lifetime, 3 visible, 14px gap, 356px wide, 24px viewport offset.
  - Swipe-to-dismiss at 45px; 200ms before unmount.
  - transform 400ms ease and opacity 400ms; exit fade-out 0.2s ease.
- [DOC] Vercel:
  - Never transition: all.
  - Set transform-origin to where the motion starts.
  - Skeletons: wait ~150-300ms before showing, keep at least ~300-500ms, and match the final layout.
  - :hover/:active/:focus should have more contrast than rest.
- [DOC] Radix example easing: cubic-bezier(0.16, 1, 0.3, 1).
- [REC] Pact values:
  - Hover: background only, 120ms, no transform.
  - Press: scale(.97) on buttons, 80ms out / 160ms back.
  - Menus and popovers: opacity 0→1 plus scale .96→1 from the transform origin, 140ms cubic-bezier(.16,1,.3,1); exit 100ms ease-in.
  - Dialogs 180ms.
  - New message: fade plus translateY(4px), 180ms.
  - Toasts: Sonner values (or a ~30-line custom toast).
  - Skeleton: 1.4s linear shimmer, shown only after 200ms.

## 5. Surfaces, color, borders
- [DOC] Radix Colors gray, steps 1-12 (https://github.com/radix-ui/colors; scale usage at https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale):
  - Light: #fcfcfc #f9f9f9 #f0f0f0 #e8e8e8 #e0e0e0 #d9d9d9 #cecece #bbbbbb #8d8d8d #838383 #646464 #202020
  - Dark: #111111 #191919 #222222 #2a2a2a #313131 #3a3a3a #484848 #606060 #6e6e6e #7b7b7b #b4b4b4 #eeeeee
  - Uses: 1-2 backgrounds; 3/4/5 component normal/hover/pressed; 6 subtle borders; 7 interactive borders and focus; 8 hovered borders; 11 low-contrast text; 12 high-contrast text.
- [DOC] Geist colors (https://vercel.com/geist/colors):
  - Steps: 100 background, 200 hover, 300 active, 400/500/600 border default/hover/active, 900 secondary text, 1000 primary text.
  - Solid gray by default; gray-alpha only where the background should show through (shadows, overlays).
- [DOC] Linear:
  - Elevation via opacities of black and white; themes moved to LCH.
  - Darker light-mode text and icons, lighter dark-mode ones.
  - Limited accent color in the chrome.
- [DOC] Vercel:
  - Layered shadows, at least two layers (ambient plus direct).
  - Semi-transparent borders plus shadows for crisp edges.
  - color-scheme: dark in dark themes.
- [REC]
  - Map Pact onto Radix gray, with one elevation step per layer.
  - Blur only on the sticky header and composer: backdrop-filter saturate(180%) blur(16px) over a 72% opaque background.

## 6. Typography
- [DOC] HIG: the system font tracks itself automatically, so don't hand-track body text.
- [DOC] Linear: Inter Display for headings, Inter for text.
- [DOC] Vercel:
  - tabular-nums for numbers that get compared.
  - Use the … character, curly quotes, and a space between number and unit.
  - Handle short, average and very long text.
- [REC]
  - Stack: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif.
  - Weights 400/500/600 only, no 700.
  - Titles 15px/600 with -0.01em letter-spacing; no added letter-spacing on body text.
  - Antialiased in dark mode.
  - Single-line truncation with min-width:0 on flex children.
  - text-wrap: balance on headings and empty states; pretty on replies.

## 7. Template tells and their fixes
1. Everything is a rounded card with large corners → 6/10/16 radius scale, flat rows, hairlines.
2. Two-line rows with an avatar per conversation → one-line 32px rows.
3. Uppercase tracked section labels → 12px/500 sentence case.
4. Gray-on-gray with no hierarchy → three text levels (Radix 12/11/9) and one elevation step per layer.
5. Hover changes nothing, or everything → background-only hover at 120ms; press scale on buttons only.
6. transition: all 0.3s ease → name the properties; ease-out under 300ms.
7. Menus pop with no animation, or slide too far → 140ms scale from 96% plus fade from the trigger's origin.
8. window.confirm or a modal for every delete → undo toast.
9. Default focus outlines, or none → 2px :focus-visible ring in gray-8 with 2px offset.
10. Icon-only buttons with no labels → aria-label plus a delayed tooltip.
11. Spinners for everything → inline status text ("Writing…") or a delayed skeleton.
12. Bright accent everywhere → monochrome, with accent only on Send and toggles.
13. Shadows on dark-mode cards → a lighter surface plus a hairline.

## 8. Drop-in tokens for Pact ([REC], gray values from Radix [DOC])
```css
:root{
  --bg:#fcfcfc; --surface:#ffffff; --surface-2:#f9f9f9; --surface-3:#f0f0f0;
  --fill-hover:rgba(0,0,0,.04); --fill-press:rgba(0,0,0,.07); --fill-selected:rgba(0,0,0,.06);
  --hairline:rgba(0,0,0,.08); --hairline-strong:rgba(0,0,0,.12); --ring:#bbbbbb;
  --text:#202020; --text-2:#646464; --text-3:#8d8d8d; --danger:#d93025;
  --shadow-pop:0 0 0 1px rgba(0,0,0,.06),0 2px 4px rgba(0,0,0,.04),0 8px 24px -4px rgba(0,0,0,.12);
  --t-xs:11px; --t-sm:12px; --t-md:13px; --t-body:14px; --t-title:15px;
  --row-h:32px; --row-h-settings:40px; --pad-x:12px;
  --r-xs:4px; --r-sm:6px; --r-md:10px; --r-lg:16px;
  --ease-out:cubic-bezier(.16,1,.3,1); --ease-in:cubic-bezier(.4,0,1,1);
  --d-hover:120ms; --d-press:80ms; --d-pop:140ms; --d-dialog:180ms; --d-toast:400ms;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#111111; --surface:#191919; --surface-2:#191919; --surface-3:#222222;
  --fill-hover:rgba(255,255,255,.05); --fill-press:rgba(255,255,255,.08); --fill-selected:rgba(255,255,255,.07);
  --hairline:rgba(255,255,255,.08); --hairline-strong:rgba(255,255,255,.12); --ring:#606060;
  --text:#eeeeee; --text-2:#b4b4b4; --text-3:#7b7b7b; --danger:#ff6b5e;
  --shadow-pop:0 0 0 1px rgba(255,255,255,.08),0 8px 24px -4px rgba(0,0,0,.5);
  color-scheme:dark;
}}
.row{height:var(--row-h);padding:0 8px;border-radius:var(--r-sm);font-size:var(--t-md);
  transition:background-color var(--d-hover) var(--ease-out)}
.row:hover{background:var(--fill-hover)} .row[aria-current]{background:var(--fill-selected);font-weight:500}
.row .more{opacity:0} .row:hover .more,.row:focus-within .more,.row .more[data-open]{opacity:1}
.menu{padding:4px;border-radius:var(--r-md);background:var(--surface);box-shadow:var(--shadow-pop);
  transform-origin:var(--origin,top right);animation:pop var(--d-pop) var(--ease-out)}
.menu-item{height:30px;padding:0 8px;border-radius:var(--r-sm);font-size:var(--t-md)}
@keyframes pop{from{opacity:0;transform:scale(.96)}}
button:active{transform:scale(.97);transition:transform var(--d-press) var(--ease-out)}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{animation-duration:1ms!important;transition-duration:1ms!important}}
```

## 9. Ranked tasks for today, by visual impact
1. Swap in the token block (S). Remap --r-lg 18→16 and --r-xl 24→16, settings cards to 10px, Radix gray in light and dark. Biggest change in feel for the least work.
2. One-line 32px conversation rows (S): 13px/500 title, right-aligned meta in text-3 with tabular numbers, no preview or avatar.
3. ⋯ menu on hover plus right-click menu (M): Pin · Rename… · Archive · separator · Delete (red, last). Arrow keys, Enter and Esc work; same items in both menus.
4. Undo toast for Delete and Archive (S): bottom of the panel, 5s, Undo button, aria-live polite, enter translateY(8px) plus fade 400ms ease. Replace any confirm dialogs.
5. Inline rename (S): Enter saves, Esc cancels, blur saves, select all on open, F2 to trigger.
6. Pinned section (S): shown only when something is pinned.
7. Settings refinement (S): 40px rows, 12px inset separators, sentence-case 12px headers, 13px label/value, 12px footnotes, 32x18 toggles.
8. Menu and popover entrance motion (S): pop keyframe from the trigger's origin, 140ms in, 100ms exit.
9. Press, hover and focus pass (S): 120ms hover backgrounds, scale(.97) press, :focus-visible rings, no transition: all.
10. Typography pass (S): 400/500/600 weights only, 15px/600 titles at -0.01em, balance and pretty wrapping, … and curly quotes.
11. Frosted sticky header and composer (S): color-mix(in srgb, var(--bg) 72%, transparent) with saturate(180%) blur(16px) and a hairline, shown once content scrolls under it.
12. Message entrance and streaming caret (S): fade plus translateY(4px) over 180ms; a thin blinking caret while streaming; nothing animates on Enter-to-send.
13. Delayed skeletons for history and settings (S): show after 200ms, stay at least 400ms, same shape as the final rows.
14. Empty states (S): one 15px line, one 13px line in text-2, and 2-3 suggestion buttons at 32px. No big illustration cards.
15. Optional: folders/projects (L). Skip for the demo.

Before the demo, check at 360px and 480px, in light and dark mode, and once with reduced motion on.
