import { fail, json } from "../../../../../lib/http";
import { authed, isResponse } from "../../../../../lib/route";
import { pollRun } from "../../../../../lib/runtime";

export async function GET(req: Request, context: { params: Promise<{ planId: string }> }) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    const { planId } = await context.params;
    const current = gate.session.actions.getByPlan(planId);
    if (!current)
      return json(
        req,
        { error: "No accepted run is recorded for this plan. Do not automatically resubmit." },
        404,
      );
    if (current.status === "running") {
      const next = await pollRun(gate.session, current);
      await gate.session.actions.patchRun(current.runId, next);
      return json(req, gate.session.actions.getRun(current.runId) ?? next);
    }
    return json(req, current);
  } catch (error) {
    return fail(req, error);
  }
}