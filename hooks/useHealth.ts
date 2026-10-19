import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { loadHealth, type HealthBody } from "../lib/backend";

export type PanelLink =
  | { kind: "offline" }
  | { kind: "limited" }
  | { kind: "unconfigured"; model: string }
  | { kind: "ok"; health: HealthBody };

export function useHealth() {
  const [link, setLink] = useState<PanelLink>({ kind: "offline" });
  const refresh = useCallback(async () => {
    try {
      const health = await loadHealth();
      if (!health.configured && !health.modelVerified)
        setLink({ kind: "unconfigured", model: health.model ?? "claude-sonnet-5-5" });
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
    const wait = link.kind === "ok" ? 30000 : 3000;
    const timer = window.setInterval(() => void refresh(), wait);
    return () => window.clearInterval(timer);
  }, [refresh, link.kind]);
  return { link, refresh };
}
