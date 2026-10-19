import { api, type Interpretation } from "./api";
import type { Pact } from "./model";
import { interpretationContext } from "./context";

export type HealthBody = {
  ok: boolean;
  model: string | null;
  modelVerified: boolean;
  fo: "signed in" | "needs reconnect" | "signed out";
  limits: { interpretPer10Min: number; interpretPerDay: number; approvalsPerDay: number };
  demo?: boolean;
  configured?: boolean;
};

export type RunBody = {
  runId: string;
  planId: string;
  status: "running" | "returned" | "needs_answer" | "failed" | "unknown";
  result?: string;
  error?: string;
  progress?: string;
  conversationId?: string;
};

export const loadHealth = () => api<HealthBody>("/api/health");

export const approveRequest = (body: {
  planId: string;
  pactId?: string;
  contextHash?: string;
  requestId: string;
}) => api<RunBody>("/api/actions/approve", body);

export const pollRun = (id: string) => api<RunBody>(`/api/actions/${id}`);

export const loadRunByPlan = (planId: string) => api<RunBody>(`/api/actions/by-plan/${encodeURIComponent(planId)}`);

export const cancelPlan = (planId: string) => api<{ cancelled: boolean }>("/api/actions/cancel", { planId });

export const loadFoStatus = () =>
  api<{ fo: HealthBody["fo"]; demo?: boolean; tools: { name: string; description?: string }[] }>("/api/fo/status");

export const connectFo = () => api<{ connected?: boolean; url?: string }>("/api/fo/connect", {});

export const disconnectFo = () => api<{ disconnected: boolean }>("/api/fo/disconnect", {});

export const deleteInstall = () => api<{ deleted: boolean }>("/api/install/delete", {});

export function contextFor(pact: Pact) {
  return interpretationContext(pact);
}

export type { Interpretation };
