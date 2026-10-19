import { z } from "zod";
import { fail, json } from "../../../../lib/http";
import { authed, isResponse } from "../../../../lib/route";

export async function POST(req: Request) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    const { planId } = z.object({ planId: z.string().uuid() }).parse(await req.json());
    await gate.session.actions.cancel(planId);
    return json(req, { cancelled: true });
  } catch (error) {
    return fail(req, error);
  }
}
