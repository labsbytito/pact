import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { loadHealth, type HealthBody } from "../lib/backend";

export type PanelLink =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "limited" }
  | { kind: "unconfigured"; model: string }
  | { kind: "fo"; health: HealthBody }
  | { kind: "ok"; health: HealthBody };

export function useHealth() {
  const [link, setLink] = useState<PanelLink>({ kind: "loading" });
  const refresh = useCallback(async () => {
    try {
      const health = await loadHealth();
      if (health.budget === "paused") { setLink({ kind: "limited" }); return; }
      if (!health.configured && !health.modelVerified)
        setLink({ kind: "unconfigured", model: health.model ?? "claude-sonnet-5-5" });
      else if (health.fo !== "signed in") setLink({ kind: "fo", health });
      else setLink({ kind: "ok", health });
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setLink({ kind: "limited" });
      else if (error instanceof TypeError || (error instanceof Error && /reach Pact|offline|fetch/i.test(error.message)))
        setLink({ kind: "offline" });
      else if (error instanceof ApiError && error.status >= 500) setLink({ kind: "offline" });
      else setLink({ kind: "offline" });
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { link, refresh };
}
