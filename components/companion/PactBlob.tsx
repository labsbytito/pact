import { useEffect, useRef, useState } from "react";
import { brandCharacter, characterFor, type CompanionAppearance, type CompanionMood } from "../../lib/character";
import { idleDelay, lookOffset, pickIdle, prefersReducedMotion, reactionFor, type BlobState } from "../../lib/pact-blob";

function faceFor(state: BlobState, mood: CompanionMood): CompanionMood | "greeting" {
  if (state === "still" || state === "error") return "idle";
  if (state === "thinking" || state === "listening") return "thinking";
  if (state === "sleepy") return "sleepy";
  if (state === "happy") return "happy";
  if (state === "greeting") return "greeting";
  return mood;
}

export function PactBlob({
  state = "idle",
  size = 24,
  seed,
  appearance,
  label,
  live = false,
}: {
  state?: BlobState;
  size?: number;
  seed?: string;
  appearance?: CompanionAppearance;
  label?: string;
  live?: boolean;
}) {
  const character = appearance ? brandCharacter(appearance, document.documentElement.dataset.theme === "dark") : characterFor(seed);
  const mood = appearance?.mood ?? "idle";
  const face = faceFor(state, mood);
  const [lid, setLid] = useState(0);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const [pop, setPop] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [setting, setSetting] = useState(() =>
    typeof document === "undefined" ? "on" : (document.documentElement.dataset.motion ?? "on"),
  );
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setSetting(root.dataset.motion ?? "on");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-motion"] });
    return () => observer.disconnect();
  }, []);
  const motion = live && setting !== "off" && !prefersReducedMotion();
  const follow = motion && size >= 16 && setting === "on" && face !== "sleepy";
  const mode = !motion ? "off" : setting === "reduced" ? "reduced" : "on";
  const [react, setReact] = useState<string>("");
  const prevState = useRef(state);
  useEffect(() => {
    const kind = reactionFor(prevState.current, state);
    prevState.current = state;
    if (!kind || !motion) return;
    setReact(kind);
    const t = window.setTimeout(() => setReact(""), 900);
    return () => { window.clearTimeout(t); setReact(""); };
  }, [state, motion]);
  const [idle, setIdle] = useState<string>("");
  useEffect(() => {
    if (!motion || setting !== "on" || face === "sleepy" || state === "listening") return;
    let wait = 0;
    let clear = 0;
    const schedule = () => {
      wait = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          setIdle(pickIdle());
          clear = window.setTimeout(() => setIdle(""), 1800);
        }
        schedule();
      }, idleDelay());
    };
    schedule();
    return () => {
      window.clearTimeout(wait);
      window.clearTimeout(clear);
      setIdle("");
    };
  }, [motion, setting, face, state]);
  useEffect(() => {
    if (motion) setPop((n) => n + 1);
  }, [face, motion]);
  useEffect(() => {
    if (!motion || face === "sleepy" || size < 20) {
      setDrift({ x: 0, y: 0 });
      return;
    }
    let timer = 0;
    const glance = () => {
      const fast = face === "thinking";
      setDrift({ x: (Math.random() - 0.5) * 2 * size * (fast ? 0.05 : 0.025), y: (Math.random() - 0.5) * 2 * size * 0.015 });
      timer = window.setTimeout(glance, (fast ? 700 : 1800) + Math.random() * (fast ? 900 : 2600));
    };
    timer = window.setTimeout(glance, 600);
    return () => window.clearTimeout(timer);
  }, [motion, face, size]);
  useEffect(() => {
    if (!motion) {
      setLid(0);
      return;
    }
    let timer = 0;
    const blink = () => {
      setLid(1);
      timer = window.setTimeout(() => {
        setLid(0);
        if (face !== "sleepy" && Math.random() < 0.22) timer = window.setTimeout(() => { setLid(1); timer = window.setTimeout(() => setLid(0), 80); }, 150);
      }, face === "sleepy" ? 140 : 90);
    };
    const loop = () => {
      const wait = face === "happy" ? 900 + Math.random() * 800 : face === "sleepy" ? 5200 + Math.random() * 2400 : 3200 + Math.random() * 2600;
      timer = window.setTimeout(() => {
        blink();
        loop();
      }, wait);
    };
    loop();
    return () => window.clearTimeout(timer);
  }, [motion, face]);
  useEffect(() => {
    if (!follow) {
      setLook({ x: 0, y: 0 });
      return;
    }
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const event = last;
      if (!event) return;
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      setLook(lookOffset(dx, dy, size));
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [follow, size]);
  const eye = character.eye;
  const closed = face === "sleepy" ? 0.55 : lid;
  const height = face === "sleepy" ? eye.height * 0.42 : eye.height;
  const glance = face === "thinking" ? { x: size * 0.08, y: -size * 0.1 } : { x: 0, y: 0 };
  const left = eye.cx - eye.gap / 2 - eye.width;
  const right = eye.cx + eye.gap / 2;
  const bob = state === "listening" ? "listening" : face === "greeting" ? "greeting" : face;
  return (
    <span ref={ref} className="blob" data-state={state} data-bob={bob} data-motion={mode} data-live={live ? "on" : "off"} data-size={size < 32 ? "sm" : "md"} data-react={react || undefined} data-idle={idle || undefined} data-face={face} style={{ width: size, height: size }} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <g className="blob-body"><g className="blob-react">
          <g className="blob-pop" data-pop={pop % 2}>
          <g className="blob-face" style={{ transform: `rotate(${character.tilt}deg)` }}>
            <path d={character.path} fill={character.color} />
            <g className="look" style={{ transform: `translate(${look.x + drift.x + glance.x + (character.eye.lookX * size) / 100}px, ${look.y + drift.y + glance.y + (character.eye.lookY * size) / 100}px)` }}>
              {face === "happy" ? (
                <g fill="none" stroke="#111" strokeOpacity={0.9} strokeWidth={3.4} strokeLinecap="round">
                  <path d={`M${left} ${eye.cy} q ${eye.width / 2} -9 ${eye.width} 0`} />
                  <path d={`M${right} ${eye.cy} q ${eye.width / 2} -9 ${eye.width} 0`} />
                </g>
              ) : (
                <g className="eye" style={{ transform: `scaleY(${Math.max(0.15, 1 - closed)})` }}>
                  <rect x={left} y={eye.cy - height / 2} width={eye.width} height={height} rx={eye.width / 2} fill="#111" fillOpacity={0.9} />
                  <rect x={right} y={eye.cy - height / 2} width={eye.width} height={height} rx={eye.width / 2} fill="#111" fillOpacity={0.9} />
                </g>
              )}
            </g>
          </g>
          </g>
          </g>
        </g>
        {face === "thinking" && state !== "listening" && size >= 20 && (
          <g className="thought" fill="currentColor" aria-hidden="true">
            <circle cx="74" cy="12" r="4.2" />
            <circle cx="86" cy="5" r="3.2" />
            <circle cx="95" cy="-1" r="2.2" />
          </g>
        )}
        {face === "sleepy" && size >= 40 && (
          <g className="zzz" fill="currentColor" aria-hidden="true">
            <text x="76" y="14" fontSize="16" fontWeight="600">z</text>
            <text x="90" y="2" fontSize="11" fontWeight="600">z</text>
          </g>
        )}
      </svg>
    </span>
  );
}
