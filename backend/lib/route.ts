import { bearer, corsHeaders, guardOrigin, json } from "./http";
import { sessionFor } from "./runtime";

export async function authed(req: Request) {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
  const blocked = guardOrigin(req);
  if (blocked) return blocked;
  const installId = bearer(req);
  if (!installId) return json(req, { error: "Pact needs you to open the panel again." }, 401);
  const session = await sessionFor(installId, req);
  return { installId, session };
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}
