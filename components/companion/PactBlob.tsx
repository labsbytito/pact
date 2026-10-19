import { useEffect, useRef, useState } from "react";
import { brandCharacter, characterFor, type CompanionAppearance } from "../../lib/character";
import { prefersReducedMotion, type BlobState } from "../../lib/pact-blob";

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
  /** Only the active companion idles. Every other copy stays still. */
  live?: boolean;
}) {
  const character = appearance ? brandCharacter(appearance, document.documentElement.dataset.theme === "dark") : characterFor(seed);
  const [lid, setLid] = useState(0);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);
  const setting = typeof document !== "undefined" ? document.documentElement.dataset.motion : "on";
  const motion = live && setting !== "off" && !prefersReducedMotion();
  const follow = live && size >= 72 && setting === "on" && !prefersReducedMotion();
  const mode = !motion ? "off" : setting === "reduced" ? "reduced" : "on";
  useEffect(() => {
    if (!motion || state === "sleepy") return;
    let timer = 0;
    const blink = () => {
      setLid(1);
      timer = window.setTimeout(() => setLid(0), 90);
    };
    const loop = () => {
      const wait = 2800 + Math.random() * 3200;
      timer = window.setTimeout(() => {
        blink();
        loop();
      }, wait);
    };
    loop();
    return () => window.clearTimeout(timer);
  }, [motion, state]);
  useEffect(() => {
    if (!follow) {
      setLook({ x: 0, y: 0 });
      return;
    }
    const onMove = (event: PointerEvent) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const reach = Math.hypot(dx, dy) || 1;
      const cap = 1.6;
      setLook({
        x: (dx / reach) * Math.min(cap, Math.abs(dx) / 90),
        y: (dy / reach) * Math.min(cap, Math.abs(dy) / 90),
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [follow]);
  const eye = character.eye;
  const closed = state === "sleepy" ? 0.85 : lid;
  return (
    <span ref={ref} className="blob" data-state={state} data-motion={mode} data-live={live ? "on" : "off"} style={{ width: size, height: size }} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 72 72" width={size} height={size}>
        <g className="blob-body">
          <g className="blob-face" style={{ transform: `rotate(${character.tilt}deg)` }}>
          <path d={character.path} fill={character.color} />
          <g className="look" style={{ transform: `translate(${look.x + (character.eye.lookX * size) / 72}px, ${look.y + (character.eye.lookY * size) / 72}px)` }}>
            <g className="eye" style={{ transform: `scaleY(${1 - closed})` }}>
              <rect x={eye.cx - eye.gap / 2 - eye.width} y={eye.cy - eye.height / 2} width={eye.width} height={eye.height} rx={eye.width / 2} fill="#1a1a1a" />
              <rect x={eye.cx + eye.gap / 2} y={eye.cy - eye.height / 2} width={eye.width} height={eye.height} rx={eye.width / 2} fill="#1a1a1a" />
            </g>
          </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
