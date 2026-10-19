import { foMocked } from "../../../../lib/env";
import { fail, json } from "../../../../lib/http";
import { authed, isResponse } from "../../../../lib/route";
import { foLabel, toolsFor } from "../../../../lib/runtime";

export async function GET(req: Request) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    return json(req, {
      fo: foLabel(gate.session),
      demo: foMocked(),
      tools: toolsFor(gate.session).map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    });
  } catch (error) {
    return fail(req, error);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: json(req, {}).headers });
}
