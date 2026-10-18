import type { Ref } from "react";
import PactBlob, {
  type BlobState,
  type PactBlobHandle,
  type PactBlobProps,
} from "./PactBlob";
import type {
  CharacterSize,
  CharacterState,
  CompanionAppearance,
} from "../../lib/character";

export type CompanionProps = {
  seed?: string;
  size?: CharacterSize | number;
  /** @deprecated Prefer `state`. */
  thinking?: boolean;
  state?: CharacterState | BlobState;
  appearance?: CompanionAppearance;
  dark?: boolean;
  lively?: boolean;
  look?: { x: number; y: number };
  caption?: string;
  blobRef?: Ref<PactBlobHandle>;
  className?: string;
};

function mapState(
  state: CharacterState | BlobState | undefined,
  thinking: boolean | undefined,
): BlobState {
  if (thinking) return "thinking";
  switch (state) {
    case "working":
      return "thinking";
    case "streaming":
      return "speaking";
    case "attention":
      return "listening";
    case "done":
      return "happy";
    case "idle":
    case "greeting":
    case "listening":
    case "thinking":
    case "speaking":
    case "happy":
    case "error":
    case "still":
    case "sleepy":
      return state;
    default:
      return "idle";
  }
}

/** Seed/appearance companion — animated via PactBlob when lively. */
export default function Companion({
  seed,
  size = "normal",
  thinking = false,
  state,
  appearance,
  dark = false,
  lively,
  look,
  caption,
  blobRef,
  className,
}: CompanionProps) {
  const life =
    lively ??
    (typeof size === "number"
      ? size >= 48
      : size === "hero" || size === "normal");

  return (
    <PactBlob
      ref={blobRef}
      seed={seed}
      appearance={appearance}
      dark={dark}
      size={size}
      state={mapState(state, thinking)}
      look={look}
      caption={caption}
      lively={life}
      className={className}
    />
  );
}

export type { PactBlobHandle, PactBlobProps, BlobState };
export {
  characterFor,
  brandCharacter,
  BRAND_SEED,
  DEFAULT_COMPANION,
} from "../../lib/character";
