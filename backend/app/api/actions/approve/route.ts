import { z } from "zod";
import { fail, json } from "../../../../lib/http";
import { limitApproval } from "../../../../lib/rate-limit";
import { authed, isResponse } from "../../../../lib/route";
import { approveHeld } from "../../../../lib/runtime";
import { openStore } from "../../../../lib/store";

const bodySchema = z.object({
  planId: z.string().uuid(),
  pactId: z.string().uuid().optional(),
  contextHash: z.string().length(64).optional(),
  requestId: z.string().min(8).max(80).optional(),
  confirmConsequential: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    const body = bodySchema.parse(await req.json());
    const prior = body.requestId ? gate.session.actions.findByRequest(body.requestId) : undefined;
    if (!prior) await limitApproval(openStore(), gate.installId);
    const run = prior ?? (await approveHeld(gate.session, body));
    return json(req, run);
  } catch (error) {
    return fail(req, error);
  }
}
