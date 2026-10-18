export type FoLogin = "signed-in" | "reconnect" | "signed-out";

export function foLoginFrom(fo: boolean, needsReconnect: boolean): FoLogin {
  if (fo) return "signed-in";
  if (needsReconnect) return "reconnect";
  return "signed-out";
}

export function keyPresent(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

// One startup sentence. It names the model and whether a key exists, never the key.
export function companionStartupLine(input: {
  keyPresent: boolean;
  model: string | null;
  foLogin: FoLogin;
}) {
  const fo =
    input.foLogin === "signed-in"
      ? "signed in"
      : input.foLogin === "reconnect"
        ? "needs reconnect"
        : "signed out";
  return `Pact companion listening on http://127.0.0.1:4317 — Claude key ${input.keyPresent ? "present" : "missing"}, model ${input.model ?? "none"}, Fo ${fo}`;
}
