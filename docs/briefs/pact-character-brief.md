# Pact mascot: animated blob companion brief
For Bagel / Pact (WXT + React Chrome side panel, about 360px wide). Prepared by Otto, 19 Oct 2026 (EAT).
Tags: **[DOC]** = value taken from a cited source. **[REC]** = my recommendation, tuned for a small (about 64–96px) blob. Not sourced.

## TL;DR
- **Build it in plain SVG + CSS keyframes, with two small React hooks (blink, eye-follow).** There's no new dependency and no editor to learn, and it fits in 2 hours. Skip Rive and Lottie for this deadline (reasons in §3).
- One `<PactBlob state="idle|greeting|listening|thinking|speaking|happy|error|sleepy" />`. The body animation is a CSS class per state. Eyes are a separate `<g>` driven by JS (blink plus look offset), the same split Duolingo uses in Rive: body pose states and mouth states run in parallel ([DOC], blog.duolingo.com/world-character-visemes).
- Key numbers: blink about 150ms total, closing faster than opening; random gap 2.5–6s; idle breathe 3.6s at ±3%; greeting about 900ms, once per browser session; pupils clamp to 3px with a 0.15 lerp; go still after 60s and "sleep" after 5 min; pause on `visibilitychange`; follow `prefers-reduced-motion`.

## 1. Ranked build order (about 2h)
1. **(15 min) Static SVG blob + eyes** in its own `<g>`, `aria-hidden="true"`, wrapped in a div with `transform-origin: 50% 100%` (squash from the feet).
2. **(15 min) Idle breathe/bob keyframes** plus the `prefers-reduced-motion` override. That alone makes it feel alive.
3. **(15 min) `useBlink` hook**: random interval and occasional double blink.
4. **(20 min) Greeting keyframes**: once per session through `chrome.storage.session`, played on panel open.
5. **(15 min) State classes** for thinking (wired to "request in flight") and speaking (wired to streaming tokens).
6. **(15 min) `useEyeFollow`**: pointer inside the panel, plus looking at the input on focus/typing.
7. **(10 min) Happy** (on success) and **error** (on failure).
8. **(10 min) Inactivity → still → sleepy**, plus the `visibilitychange` pause.
9. *(Optional)* Listening, if mic input exists, driven by mic RMS.

## 2. What the references do (sourced; internals mostly not public)
| Product | What's public | Takeaway for Pact |
|---|---|---|
| **OpenAI ChatGPT voice** | Showcased as animated black dots (May 2024), replaced by a blue animated sphere at the AVM rollout in Sept 2024 (techcrunch.com/2024/09/24/openai-rolls-out-advanced-voice-mode-with-more-voices-and-a-new-look/). Users see it "pulse and morph" and shrink-fade on close (60fps.design/shots/chatgpt-voice-blob-gradient-interaction). OpenAI's implementation isn't public. A community recreation uses a noise shader plus a "floating bob and breathing scale" on the container (adithyavis.github.io/awesome-mobile-app-animations/docs/animations/chatgpt-voice-profiles). | No face needed to feel alive. Breathing scale plus a voice-reactive pulse does most of the work. Exit = shrink + fade. |
| **Grok companions** | Launched July 2025 as interactive 3D voice avatars in the Grok app (testingcatalog.com/grok-debuts-interactive-ai-companions-on-ios-with-anime-avatars/). Secondary reports say the feature was retired in Sept 2026 (unverified). The animation internals aren't public. | Not a useful technical reference (3D, full-body). I deliberately kept to the technical side only. |
| **Meta Muse** | Customisable avatar (default Jollybot) that animates while tasks run in the background. Under the avatar is a snippet of what it's working on, and tapping the avatar opens the activity log (introducing.muse.ai, axios.com/2026/09/25/ai-doom-meta-muse-mascot). Motion specs aren't public. | **Tie the mascot to real status**: a "thinking" state plus a one-line caption under it ("Reading page…"). Clicking the mascot could open the activity log. |
| **Fo by Wajo** | Wajo's site shows Fo as an action agent with a live "Fo working now" status (wajo.ai, fo.wajo.ai). I found **no public material on Fo's character animation**. | Same lesson as Muse: a status line beats decoration. |
| **Clippy / Microsoft Agent** | Microsoft's own Agent guidelines: idling is progressive. **Level 1** = blink or glance around, **Level 2** = reading, **Level 3** = sleeping. "Animations that include many or large movements are not well suited for idle animations because they draw the user's attention." Provide several variants and pick at random. "Sometimes just an animated blink, visible breath, or body shift" keeps it believable. Defined states include Greet, Listening/Hearing ("head tilts or other slight gestures"), Think ("looks up"), Processing, Pleased, Surprised, Confused (learn.microsoft.com/en-us/windows/win32/lwef/agent-states). Stanford research found productivity-focused users found Clippy's social/idle animations distracting and annoying (xenon.stanford.edu/~lswartz/paperclip/paperclip.pdf). | Copy this state model directly. Idle must be tiny. Never interrupt, never pop up unbidden. |
| **Microsoft Mico (Clippy successor)** | Copilot voice-mode blob that listened, reacted with facial expressions and changed colour (theverge.com/news/804106/microsoft-mico-copilot-ai-assistant-clippy). Removed from Copilot's core voice experience in Aug 2026, kept in Learn Live (theverge.com/tech/979871/microsoft-copilot-mico-retired, geekwire.com/2026/farewell-mico-microsofts-cute-little-ai-blob-is-going-the-way-of-bob/). | Closest analogue to Pact (a blob with a face). It was pulled from the main product, which is more evidence to keep it subtle, small and optional. |
| **Duolingo** | Characters had "idle behavior" first, then lip-sync. Built in Rive state machines with separate states for poses and for mouths. Phoneme timings map to 20+ viseme mouths (blog.duolingo.com/world-character-visemes). Rive has no automatic lip-sync: you feed a numeric input from code (rive.app community forum; rive.expert/blog/lip-sync-animation uses about 10 visemes). | Layer the body and the face independently. For Pact, a simple amplitude-driven mouth/body pulse is enough. Visemes are overkill. |
| **Apple Memoji / Animoji** | Driven by ARKit face blend-shape coefficients from 0.0 to 1.0, e.g. `eyeBlinkLeft` 0 = open, 1 = closed (developer.apple.com/documentation/arkit/arfaceanchor/blendshapes). Apple's sample maps blink to eye scale as `1 - eyeBlinkLeft` (developer.apple.com/documentation/ARKit/tracking-and-visualizing-faces). | **Model the eyes as a 0–1 "lid" value and render it as `scaleY(1 - lid)`.** That's exactly the approach in the code below. |

## 3. Tool choice for a 2-hour window
| Option | Verdict | Why |
|---|---|---|
| **Plain SVG + CSS keyframes + 2 hooks** | ✅ **Use this** | Zero dependencies. Every state is a class swap. Eyes and pointer are plain JS, so it's fully interactive. Transforms and opacity run on the compositor. Easy to honour reduced motion. |
| Framer Motion (`motion`) | ⚠️ Optional | Nice spring API, but it adds a dependency and doesn't do anything here that CSS can't. Only use it if it's already in the repo. |
| Rive | ❌ Not today | Best long-term option: state machines, used by Duolingo, and it can "settle" to near-zero idle cost (charmotion.app/guides/rive-vs-lottie-performance). But it needs the character re-authored in the Rive editor (not a 2h task for a new user). The runtime is 222 KB (canvas-lite) to 567 KB (canvas) brotli [DOC] (rive.app/docs/runtimes/runtime-sizes). By default the React runtime **fetches `rive.wasm` from unpkg** [DOC] (rive.app/docs/runtimes/react/preloading-wasm). Fetching that from a CDN conflicts with MV3's no-remote-code policy, so you'd have to bundle the WASM locally, which adds CSP risk. |
| Lottie | ❌ Not for this | Timeline playback, made in After Effects or LottieFiles. Branching or blending between interactive states and cursor-following eyes is awkward. lottie-web is about 76 KB gzip (46 KB light) [DOC] (charmotion.app). |

## 4. Global motion tokens
- `--ease-standard: cubic-bezier(0.2, 0, 0, 1)` [DOC] Material 3 standard (m3.material.io/styles/motion/easing-and-duration/tokens-specs)
- `--ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1)` with **400ms** for entrances [DOC] M3 emphasized decelerate / medium4
- `--ease-breathe: cubic-bezier(0.45, 0, 0.55, 1)` (symmetric sine-like in/out) [REC]
- `--ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1)` (back-out, about 10% overshoot for landings and pops) [REC]
- `--ease-blink-close: cubic-bezier(0.55, 0, 1, 0.45)` (accelerating) and `--ease-blink-open: cubic-bezier(0, 0.55, 0.45, 1)` (decelerating) [REC]
- Blob size 72px in the side panel header, or 96px on the empty state [REC]. Eye white about 10px and pupil about 5px at 72px [REC].

## 5. State specs (body = CSS on the wrapper, eyes = JS)
| State | Trigger | Motion | Duration / easing |
|---|---|---|---|
| **idle** | default | Breathe: `scale(1.015, 0.985)` ↔ `scale(0.99, 1.01)` (±1.5% [REC]), plus bob `translateY(0 → -2px)` [REC]. Pupils follow the pointer. Random blinks. | 3.6s period [REC] (a calm breathing rate is roughly 12–20 per min = 3–5s; I didn't cite a source, so treat it as [REC]), `--ease-breathe`, infinite alternate |
| **greeting** | panel open, once per browser session | 0–12%: anticipation squash `scale(1.12, 0.88)`. 12–35%: hop `translateY(-12px) scale(0.92, 1.1)` (stretch). 35–50%: land squash `scale(1.1, 0.9)`. 50–100%: settle to 1 with a wiggle `rotate(-6deg → 5deg → -2deg → 0)`. Eyes switch to "happy arcs" (^ ^) at 35–85%, plus one blink at the end. | 900ms total [REC]. Overall `--ease-overshoot` on the settle segment, `ease-in` on the anticipation. Fade/scale in from 0.6 at first mount with `--ease-enter` 400ms [DOC] |
| **listening** | mic on / input focused | Lean toward the input: `rotate(3deg) translateY(1px)` plus slight grow `scale(1.03)`. Eyes wider: `scaleY(1.1)`. Small "attentive" pulse. | Enter 250ms `--ease-standard` [REC]. Pulse 1.6s ±2% [REC]. Mic-driven: `scale = 1 + 0.06 * rmsSmoothed` [REC]. Microsoft Agent: "head tilts or other slight gestures" [DOC qualitative] |
| **thinking** | request in flight | Pupils go to the top-right `(2px, -3px)` (MS Agent "Think: looks up" [DOC qualitative]). Slow sway `rotate(±3deg)`. Breathe slows. Optional caption under the blob: "Reading page…" (Muse/Fo pattern). Blinks less often (people blink less when reading/concentrating: 1.4–14.4/min vs 8–21/min at rest [DOC], doi.org/10.1002/j.1538-9235.2001.tb01355.x). | Sway 2.4s `--ease-breathe` infinite [REC]. Blink interval ×1.5 [REC] |
| **speaking** | streaming tokens (or TTS audio) | Body "talks": `scaleY` pulse 1 → 1.04 → 1, triggered per token chunk, throttled to ≥90ms between pulses. If there's audio: `scaleY = 1 + 0.05 * level` with the level smoothed. Optional mouth ellipse `scaleY(0.2 → 1)` from the same level. Blinks more often (conversation 10.5–32.5/min [DOC] same source). | Pulse 120ms `ease-out` [REC]. Lerp factor 0.3 for the audio level [REC]. Blink interval ×0.8 [REC] |
| **happy** | task success | Two little hops: `translateY(-6px)` with squash/stretch `(0.94, 1.06)` / land `(1.06, 0.94)`. Happy-arc eyes. | 2 × 350ms = 700ms, `--ease-overshoot`, then back to idle [REC] |
| **error** | failure | Small head shake `translateX(-3px, 3px, -2px, 0)`. Eyes droop (lid 0.35). **No red flashing**: change colour at most once, as a static tint. | 400ms `--ease-standard`, then hold the droop for 1.5s [REC] |
| **sleepy** | 5 min with no input | Lid 0.6, then 1 (closed). Breathing period 5s at ±1%. Optional "z" fade in/out (opacity only). Wakes on any pointer or key: open eyes and do a quick 250ms "pop" `scale(1.06)`. | Matches MS Agent's IdlingLevel3 "sleeping" [DOC qualitative]. Timings are [REC] |

**Squash and stretch rule:** preserve volume, so x ≈ 1/y (1.12 × 0.88 ≈ 0.99) [REC]. Cap deformation at ±12% for greeting and ±6% elsewhere [REC]. Always `transform-origin: 50% 100%` so it squashes into the "floor" [REC].

## 6. Blinks
- **Duration:** about 150ms total [REC], based on spontaneous blinks of about 100–150ms with about 110ms of visual blackout [DOC] (pdfs.semanticscholar.org/b5af/0e9c27a05767ba0e3fa6947b59fe9ba3ce4e.pdf). Make **closing faster than opening**: closing is faster in real blinks [DOC] (pmc.ncbi.nlm.nih.gov/articles/PMC4043155/). Split it as close 50ms, hold 20ms, open 80ms [REC].
- **Interval:** people blink about every 3–5s, roughly 20/min [DOC] (sciencedirect.com/science/article/abs/pii/S0304394020305632). For a UI that's a bit busy, so use a **random 2.5–6s uniform interval** (mean about 4.25s) [REC].
- **Double blink:** 15% chance, with the second blink 180ms after the first ends [REC].
- Blink on state changes (e.g. after greeting, on entering thinking) [REC]. Microsoft Agent plays Blink "when the character finishes speaking or idle" [DOC qualitative].
- Render as eye `scaleY(1 - lid)`, the same idea as Apple's ARKit `eyeBlink` 0–1 coefficient [DOC].

## 7. Eye tracking and typing
- In a side panel, `pointermove` only fires while the cursor is **over the panel** (it's a separate document). That's fine: the pupils glance at the cursor and drift back to centre after 1.5s with no movement [REC].
- Target = unit vector from the eye centre to the pointer × min(distance/150px, 1) × **3px max offset** [REC] (pupil radius 2.5 inside a white of radius 5).
- Smooth with a **lerp of 0.15 per frame** at 60fps [REC]. Snap to the target when within 0.05px and stop the rAF loop (no idle CPU).
- **Typing:** on input `focus`, look toward the input (pupils `(0, +3px)` if the input is below) and lean `rotate(2deg)` toward it [REC]. On each `keydown`, add a tiny nod `translateY(+1px)` that decays over 200ms, throttled to one per 120ms [REC]. On `blur`, return to the pointer or centre.

## 8. Speaking from tokens or mic
- **Tokens:** on each streamed chunk call `pulse()`, which toggles a short CSS class (or sets `--talk` = 1 then decays). Throttle to ≥90ms so it doesn't buzz [REC]. When the stream ends: blink, then go to `happy` for 700ms, then `idle`.
- **Mic/TTS:** `AudioContext` → `AnalyserNode` (`fftSize` 512) → RMS each rAF → `level = lerp(level, rms*4, 0.3)` clamped to 0..1 → CSS var `--lvl` → `transform: scaleY(calc(1 + var(--lvl)*0.05))` [REC]. (Duolingo/Rive drive mouths from numeric inputs set in code [DOC qualitative], same idea, simpler signal.)

## 9. Keeping it from getting annoying
- **Greeting once per browser session:** use `chrome.storage.session` (in-memory, cleared when the browser restarts) (developer.chrome.com/docs/extensions/reference/api/storage). `sessionStorage` would reset on every panel reopen, because each open is a new document.
- **Never** move or animate to get attention unprompted. No GetAttention-style waving (Clippy lesson, Stanford paper above).
- **Inactivity:** after 60s with no pointer/key/stream, stop the bob (breathe only, ±1%) [REC]. After 5 min, go to sleepy and stop all loops except a 5s breathe (or fully static under reduced motion) [REC].
- **Hidden panel:** on `document.visibilitychange` with `document.hidden`, add `.paused { animation-play-state: paused }` to the root, cancel the rAF loops and clear the blink timers. Resume when visible. (Browsers already throttle rAF in hidden documents, but CSS keyframes and setTimeout blinks should be paused explicitly.)
- **`prefers-reduced-motion: reduce`:** no hop, bob, sway or shake. Keep state readable through eye shape and static pose only. Blinks at most every 6–10s, or none [REC]. Greeting = a 200ms opacity fade plus happy eyes. (WCAG 2.3.3 asks that motion animation triggered by interaction can be disabled: w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html.)
- Optional "Mascot animations: on/off" toggle in settings [REC].

## 10. Accessibility and performance
- The SVG gets `aria-hidden="true"` and `focusable="false"`. Put state in a visually hidden `aria-live="polite"` text only if it adds meaning (e.g. "Thinking…"), never per token.
- **No flashing:** no more than 3 flashes in any 1-second period [DOC] (WCAG 2.3.1, w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html). Avoid colour flicker entirely. Keep colour changes ≥300ms fades [REC].
- Animate only `transform` and `opacity`. Animate the wrapper `<div>` or the SVG `<g>` with `transform-box: fill-box` and a proper `transform-origin`. Use `will-change: transform` only on the 2–3 moving elements, not everything.
- One rAF loop for the eyes, which stops when settled. Blinks use `setTimeout`, not rAF. Don't animate SVG path `d` attributes or filters (blur/drop-shadow) — those repaint.

## 11. Starter code sketch
```tsx
// PactBlob.tsx
import { useEffect, useRef, useState } from "react";
import "./pact-blob.css";

export type BlobState = "idle"|"greeting"|"listening"|"thinking"|"speaking"|"happy"|"error"|"sleepy";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useBlink(state: BlobState, paused: boolean) {
  const [lid, setLid] = useState(0); // 0 open, 1 closed (ARKit-style)
  useEffect(() => {
    if (paused || state === "sleepy") return;
    let t: number;
    const mult = state === "thinking" ? 1.5 : state === "speaking" ? 0.8 : 1;
    const [min, max] = reduced() ? [6000, 10000] : [2500, 6000];
    const blinkOnce = (done?: () => void) => {
      setLid(1);                                  // close 50ms (CSS transition)
      t = window.setTimeout(() => { setLid(0); done?.(); }, 70); // +20ms hold, open 80ms
    };
    const loop = () => {
      t = window.setTimeout(() => {
        blinkOnce(() => {
          if (Math.random() < 0.15) t = window.setTimeout(() => blinkOnce(loop), 180 + 80);
          else loop();
        });
      }, (min + Math.random() * (max - min)) * mult);
    };
    loop();
    return () => clearTimeout(t);
  }, [state, paused]);
  return lid;
}

export function useEyeFollow(svgRef: React.RefObject<SVGSVGElement>, paused: boolean, look?: {x:number;y:number}) {
  const [off, setOff] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 }), cur = useRef({ x: 0, y: 0 }), raf = useRef(0), idleT = useRef(0);
  useEffect(() => {
    if (paused || reduced()) return;
    const MAX = 3, LERP = 0.15;
    const tick = () => {
      const c = cur.current, g = look ?? target.current;
      c.x += (g.x - c.x) * LERP; c.y += (g.y - c.y) * LERP;
      setOff({ x: c.x, y: c.y });
      if (Math.abs(g.x - c.x) + Math.abs(g.y - c.y) > 0.05) raf.current = requestAnimationFrame(tick);
      else raf.current = 0;
    };
    const kick = () => { if (!raf.current) raf.current = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.45);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(d / 150, 1) * MAX;
      target.current = { x: (dx / d) * k, y: (dy / d) * k };
      clearTimeout(idleT.current);
      idleT.current = window.setTimeout(() => { target.current = { x: 0, y: 0 }; kick(); }, 1500);
      kick();
    };
    window.addEventListener("pointermove", onMove);
    kick();
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [paused, look?.x, look?.y]);
  return off;
}

export function usePageHidden() {
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const f = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return hidden;
}

export function PactBlob({ state, look, size = 72 }: { state: BlobState; look?: {x:number;y:number}; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const hidden = usePageHidden();
  const lid = useBlink(state, hidden);
  const eye = useEyeFollow(ref, hidden, look ?? (state === "thinking" ? { x: 2, y: -3 } : undefined));
  const happyEyes = state === "happy" || state === "greeting";
  const sleepyLid = state === "sleepy" ? 1 : state === "error" ? 0.35 : 0;
  const l = Math.max(lid, sleepyLid);
  return (
    <div className={`pact-blob s-${state} ${hidden ? "paused" : ""}`} style={{ width: size, height: size }}>
      <svg ref={ref} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path className="body" d="M50 8C76 8 92 30 92 58c0 24-18 36-42 36S8 82 8 58C8 30 24 8 50 8Z" />
        <g className="eyes" style={{ transform: `translate(${eye.x}px, ${eye.y}px)` }}>
          {[38, 62].map((cx) => happyEyes ? (
            <path key={cx} className="arc" d={`M${cx-6} 50 q6 -8 12 0`} />
          ) : (
            <g key={cx} className="eye" style={{ transform: `scaleY(${1 - l})`, transformOrigin: `${cx}px 50px` }}>
              <ellipse cx={cx} cy={50} rx={6} ry={8} className="white" />
              <circle cx={cx + eye.x * 0.6} cy={51 + eye.y * 0.6} r={3.5} className="pupil" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

```css
/* pact-blob.css */
.pact-blob { --ease-breathe: cubic-bezier(.45,0,.55,1); --ease-over: cubic-bezier(.34,1.56,.64,1);
  transform-origin: 50% 100%; will-change: transform; }
.pact-blob svg { width: 100%; height: 100%; overflow: visible; }
.pact-blob .body { fill: var(--pact-blob, #7C5CFF); }
.pact-blob .white { fill: #fff; } .pact-blob .pupil { fill: #1B1530; }
.pact-blob .arc { fill: none; stroke: #1B1530; stroke-width: 3; stroke-linecap: round; }
.pact-blob .eye { transition: transform 50ms cubic-bezier(.55,0,1,.45); }       /* close fast */
.pact-blob .eye[style*="scaleY(1)"] { transition-duration: 80ms; }            /* open slower (tweak via state) */

.s-idle      { animation: breathe 3.6s var(--ease-breathe) infinite alternate; }
.s-greeting  { animation: greet 900ms both; }
.s-listening { animation: listen 1.6s var(--ease-breathe) infinite alternate; }
.s-thinking  { animation: sway 2.4s var(--ease-breathe) infinite alternate; }
.s-speaking  { transform: scaleY(calc(1 + var(--lvl, 0) * .05)); }
.s-happy     { animation: hop 350ms var(--ease-over) 2; }
.s-error     { animation: shake 400ms cubic-bezier(.2,0,0,1); }
.s-sleepy    { animation: breathe-slow 5s var(--ease-breathe) infinite alternate; }
.paused, .paused * { animation-play-state: paused !important; }

@keyframes breathe { from { transform: translateY(0) scale(1.015,.985); } to { transform: translateY(-2px) scale(.99,1.01); } }
@keyframes breathe-slow { from { transform: scale(1.01,.99); } to { transform: scale(.995,1.005); } }
@keyframes greet {
  0%   { transform: scale(1,1); animation-timing-function: ease-in; }
  12%  { transform: scale(1.12,.88); animation-timing-function: cubic-bezier(.2,0,0,1); }
  35%  { transform: translateY(-12px) scale(.92,1.1); animation-timing-function: ease-in; }
  50%  { transform: translateY(0) scale(1.1,.9); animation-timing-function: var(--ease-over); }
  65%  { transform: rotate(-6deg); } 80% { transform: rotate(5deg); } 90% { transform: rotate(-2deg); }
  100% { transform: none; }
}
@keyframes listen { from { transform: rotate(3deg) scale(1.02); } to { transform: rotate(3deg) scale(1.04); } }
@keyframes sway   { from { transform: rotate(-3deg); } to { transform: rotate(3deg); } }
@keyframes hop    { 0% { transform: scale(1.06,.94); } 50% { transform: translateY(-6px) scale(.94,1.06); } 100% { transform: scale(1.06,.94); } }
@keyframes shake  { 25% { transform: translateX(-3px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-2px); } 100% { transform: none; } }
@keyframes pulse  { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.04); } }
.talk-pulse { animation: pulse 120ms ease-out; }

@media (prefers-reduced-motion: reduce) {
  .pact-blob, .pact-blob * { animation: none !important; transition: opacity 200ms linear !important; }
}
```

```ts
// greeting once per browser session (side panel)
export async function shouldGreet() {
  const { greeted } = await chrome.storage.session.get("greeted");
  if (greeted) return false;
  await chrome.storage.session.set({ greeted: true });
  return true;
}
// usage: on mount -> if (await shouldGreet()) { setState("greeting"); setTimeout(() => setState("idle"), 900); }
// thinking: setState("thinking") when the request starts; speaking: on first token; per chunk -> pulse (≥90ms throttle)
// inactivity: reset a 60s timer on pointer/key/stream -> drop bob; 5 min -> "sleepy"; any input -> "idle"
```
Notes: the `.eye[style*=...]` selector is a hack. Cleaner is to set `transitionDuration` inline: `l > 0 ? "50ms" : "80ms"`. In the speaking state, the `--lvl` CSS var gets set from the rAF/analyser loop on the wrapper's `style`.

## Caveats
- OpenAI, Grok, Muse, Fo and Mico don't publish animation timings or curves. Everything numeric for them in this brief is [REC], not copied.
- The Grok companion retirement and Mico status come from news/secondary reports, so treat them as context only.
- The blink and blink-rate figures are human physiology [DOC]. Mapping them onto a cartoon is my judgement [REC].
