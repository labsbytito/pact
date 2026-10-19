import { fail, json } from "../../../../lib/http";
import { authed, isResponse } from "../../../../lib/route";

export async function POST(req: Request) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    await gate.session.actions.invalidateAll();
    await gate.session.fo?.disconnect();
    await gate.session.threads.forgetAll();
    return json(req, { disconnected: true });
  } catch (error) {
    return fail(req, error);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: json(req, {}).headers });
}
