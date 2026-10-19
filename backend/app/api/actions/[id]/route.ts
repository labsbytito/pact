import { fail, json } from "../../../../lib/http";
import { authed, isResponse } from "../../../../lib/route";
import { pollRun } from "../../../../lib/runtime";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    const { id } = await context.params;
    const current = gate.session.actions.getRun(id);
    if (!current)
      return json(
        req,
        { error: "This run is no longer available. Do not retry automatically." },
        404,
      );
    if (current.status !== "running") return json(req, current);
    const next = await pollRun(gate.session, current);
    if (next !== current) await gate.session.actions.patchRun(id, next);
    return json(req, gate.session.actions.getRun(id) ?? next);
  } catch (error) {
    return fail(req, error);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: json(req, {}).headers });
}
