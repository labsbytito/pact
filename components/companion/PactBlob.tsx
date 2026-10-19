import { useEffect, useState } from "react";
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
  const setting = typeof document !== "undefined" ? document.documentElement.dataset.motion : "on";
  const motion = live && setting !== "off" && !prefersReducedMotion();
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
  const eye = character.eye;
  const closed = state === "sleepy" ? 0.85 : lid;
  return (
    <span className="blob" data-state={state} data-motion={mode} data-live={live ? "on" : "off"} style={{ width: size, height: size }} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 0 72 72" width={size} height={size}>
        <g className="blob-body">
          <path d={character.path} fill={character.color} />
          <g className="eye" style={{ transform: `scaleY(${1 - closed})` }}>
            <rect x={eye.cx - eye.gap / 2 - eye.width} y={eye.cy - eye.height / 2} width={eye.width} height={eye.height} rx={eye.width / 2} fill="#1a1a1a" />
            <rect x={eye.cx + eye.gap / 2} y={eye.cy - eye.height / 2} width={eye.width} height={eye.height} rx={eye.width / 2} fill="#1a1a1a" />
          </g>
        </g>
      </svg>
    </span>
  );
}
