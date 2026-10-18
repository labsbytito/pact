import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  brandCharacter,
  characterFor,
  type CharacterSize,
  type CompanionAppearance,
} from "../../lib/character";
import { prefersReducedMotion, type BlobState } from "./pactBlob";

export type { BlobState } from "./pactBlob";

export type PactBlobHandle = {
  /** Trigger a short speaking pulse (throttled ≥90ms by caller or here). */
  pulse: () => void;
};

export type PactBlobProps = {
  state: BlobState;
  seed?: string;
  appearance?: CompanionAppearance;
  dark?: boolean;
  size?: CharacterSize | number;
  /** Override look target (e.g. composer focus → {x:0,y:3}). */
  look?: { x: number; y: number };
  /** Optional status under the blob. */
  caption?: string;
  /** Dense list avatars: no life loops. */
  lively?: boolean;
  className?: string;
  children?: ReactNode;
};

const SIZE_MAP: Record<CharacterSize, number> = {
  tiny: 28,
  small: 32,
  row: 38,
  normal: 72,
  hero: 96,
};

function usePageHidden() {
  const [hidden, setHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}

/** Blink: squash dark pills vertically. Close ~50 / hold ~20 / open ~80. */
export function useBlink(state: BlobState, paused: boolean) {
  const [lid, setLid] = useState(0);
  useEffect(() => {
    if (paused || state === "sleepy" || state === "still") return;
    let t = 0;
    let cancelled = false;
    const mult =
      state === "thinking" ? 1.5 : state === "speaking" ? 0.8 : 1;
    const [min, max] = prefersReducedMotion()
      ? [6000, 10000]
      : [2500, 6000];

    const blinkOnce = (done?: () => void) => {
      if (cancelled) return;
      setLid(1);
      t = window.setTimeout(() => {
        if (cancelled) return;
        setLid(0);
        done?.();
      }, 70);
    };

    const loop = () => {
      t = window.setTimeout(
        () => {
          if (cancelled) return;
          blinkOnce(() => {
            if (cancelled) return;
            if (Math.random() < 0.15) {
              t = window.setTimeout(() => blinkOnce(loop), 180 + 80);
            } else loop();
          });
        },
        (min + Math.random() * (max - min)) * mult,
      );
    };
    loop();
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [state, paused]);
  return lid;
}

export function useEyeFollow(
  svgRef: RefObject<SVGSVGElement | null>,
  paused: boolean,
  look?: { x: number; y: number },
) {
  const [off, setOff] = useState({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const idleT = useRef(0);

  useEffect(() => {
    if (paused || prefersReducedMotion()) {
      setOff({ x: 0, y: 0 });
      return;
    }
    const MAX = 3;
    const LERP = 0.15;
    const tick = () => {
      const c = cur.current;
      const g = look ?? target.current;
      c.x += (g.x - c.x) * LERP;
      c.y += (g.y - c.y) * LERP;
      setOff({ x: c.x, y: c.y });
      if (Math.abs(g.x - c.x) + Math.abs(g.y - c.y) > 0.05) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = 0;
        c.x = g.x;
        c.y = g.y;
        setOff({ x: g.x, y: g.y });
      }
    };
    const kick = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };
    if (look) {
      target.current = look;
      kick();
    }
    const onMove = (e: PointerEvent) => {
      if (look) return;
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.45);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(d / 150, 1) * MAX;
      target.current = { x: (dx / d) * k, y: (dy / d) * k };
      window.clearTimeout(idleT.current);
      idleT.current = window.setTimeout(() => {
        target.current = { x: 0, y: 0 };
        kick();
      }, 1500);
      kick();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    kick();
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(idleT.current);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [paused, look?.x, look?.y, svgRef]);

  return off;
}

const PactBlob = forwardRef<PactBlobHandle, PactBlobProps>(function PactBlob(
  {
    state,
    seed,
    appearance,
    dark = false,
    size = "normal",
    look,
    caption,
    lively = true,
    className,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hidden = usePageHidden();
  const paused = hidden || !lively;
  const [talkPulse, setTalkPulse] = useState(false);
  const lastPulse = useRef(0);

  const character =
    seed && seed.trim()
      ? characterFor(seed)
      : brandCharacter(appearance, dark);

  const px = typeof size === "number" ? size : SIZE_MAP[size];
  const lidBlink = useBlink(lively ? state : "still", paused);
  const forcedLook =
    look ??
    (state === "thinking"
      ? { x: 2, y: -3 }
      : state === "listening"
        ? { x: 0, y: 2 }
        : undefined);
  const eye = useEyeFollow(svgRef, paused || !lively, forcedLook);

  useImperativeHandle(ref, () => ({
    pulse() {
      const now = Date.now();
      if (now - lastPulse.current < 90) return;
      lastPulse.current = now;
      setTalkPulse(true);
      window.setTimeout(() => setTalkPulse(false), 120);
    },
  }));

  const happyEyes = state === "happy" || state === "greeting";
  const sleepyLid =
    state === "sleepy" ? 1 : state === "error" ? 0.35 : 0;
  const lid = Math.max(lidBlink, sleepyLid);
  const { eye: eyeGeom } = character;
  const leftCx = eyeGeom.cx - eyeGeom.gap / 2;
  const rightCx = eyeGeom.cx + eyeGeom.gap / 2;
  const eyeCy = eyeGeom.cy;
  const pillW = eyeGeom.width;
  const pillH = eyeGeom.height;
  const rx = pillW / 2;

  const style = {
    width: px,
    height: px,
    ["--pact-blob" as string]: character.color,
    ["--lvl" as string]: talkPulse ? 0.8 : 0,
  } satisfies CSSProperties;

  return (
    <div
      className={`pact-blob s-${state}${paused ? " paused" : ""}${talkPulse ? " talk-pulse" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      data-seed={character.seed}
      data-shape={character.shape}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 72 72"
        aria-hidden="true"
        focusable="false"
      >
        <g
          className="blob-pose"
          transform={`rotate(${character.tilt} 36 36)`}
        >
          <path className="blob-body" d={character.path} />
          <g
            className="blob-eyes"
            style={{
              transform: `translate(${eye.x}px, ${eye.y}px)`,
            }}
          >
            {[leftCx, rightCx].map((cx) =>
              happyEyes ? (
                <path
                  key={cx}
                  className="blob-arc"
                  d={`M${cx - 4.5} ${eyeCy + 1} q4.5 -6.5 9 0`}
                />
              ) : (
                <g
                  key={cx}
                  className="blob-eye"
                  style={{
                    transform: `scaleY(${Math.max(0.08, 1 - lid)})`,
                    transformOrigin: `${cx}px ${eyeCy}px`,
                    transitionDuration: lid > 0 ? "50ms" : "80ms",
                    transitionTimingFunction:
                      lid > 0
                        ? "cubic-bezier(0.55, 0, 1, 0.45)"
                        : "cubic-bezier(0, 0.55, 0.45, 1)",
                  }}
                >
                  <rect
                    className="blob-pill"
                    x={cx - pillW / 2}
                    y={eyeCy - pillH / 2}
                    width={pillW}
                    height={pillH}
                    rx={rx}
                    ry={rx}
                  />
                </g>
              ),
            )}
          </g>
        </g>
      </svg>
      {caption ? (
        <span className="blob-caption" aria-live="polite">
          {caption}
        </span>
      ) : null}
    </div>
  );
});

export default PactBlob;
