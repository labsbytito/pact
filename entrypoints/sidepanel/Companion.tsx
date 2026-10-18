import {
  characterFor,
  type CharacterSize,
  type CharacterState,
} from "../../lib/character";

export type CompanionProps = {
  seed?: string;
  size?: CharacterSize;
  thinking?: boolean;
  state?: CharacterState;
};

function resolveState(
  thinking: boolean | undefined,
  state: CharacterState | undefined,
): CharacterState {
  if (thinking) return "thinking";
  return state ?? "idle";
}

/** SVG companion — deterministic from seed. Default seed is the brand mascot. */
export default function Companion({
  seed,
  size = "normal",
  thinking = false,
  state,
}: CompanionProps) {
  const character = characterFor(seed);
  const mood = resolveState(thinking, state);
  const { eye } = character;
  const rx = eye.width / 2;
  const leftX = eye.cx - eye.gap / 2 - eye.width / 2 + eye.lookX;
  const rightX = eye.cx + eye.gap / 2 - eye.width / 2 + eye.lookX;
  const eyeY = eye.cy - eye.height / 2 + eye.lookY;

  return (
    <span
      className={`companion ${size} state-${mood}${mood === "thinking" ? " thinking" : ""}`}
      data-shape={character.shape}
      data-seed={character.seed}
      aria-hidden="true"
    >
      <svg viewBox="0 0 72 72" fill="none" focusable="false">
        <g
          className="character-pose"
          transform={`rotate(${character.tilt} 36 36)`}
        >
          <path className="character-body" d={character.path} fill={character.color} />
          <g
            className="character-eyes"
            transform={`rotate(${eye.rotate} ${eye.cx + eye.lookX} ${eye.cy + eye.lookY})`}
          >
            <rect
              className="character-eye"
              x={leftX}
              y={eyeY}
              width={eye.width}
              height={eye.height}
              rx={rx}
              ry={rx}
            />
            <rect
              className="character-eye"
              x={rightX}
              y={eyeY}
              width={eye.width}
              height={eye.height}
              rx={rx}
              ry={rx}
            />
          </g>
        </g>
      </svg>
    </span>
  );
}

export { characterFor, BRAND_SEED } from "../../lib/character";
