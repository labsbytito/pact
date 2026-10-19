import { budgetPaused } from "../../../lib/ai-budget";
import { aiMocked, foMocked } from "../../../lib/env";
import { fail, guardOrigin, json } from "../../../lib/http";
import { bearer } from "../../../lib/http";
import { limitSnapshot } from "../../../lib/rate-limit";
import { foLabel, sessionFor, verifyModel } from "../../../lib/runtime";

export async function GET(req: Request) {
  try {
    const blocked = guardOrigin(req);
    if (blocked) return blocked;
    const installId = bearer(req);
    if (!installId) return json(req, { error: "Pact needs you to open the panel again." }, 401);
    const [model, session] = await Promise.all([
      verifyModel(),
      sessionFor(installId, req),
    ]);
    const configured = aiMocked() || model.modelVerified;
    const paused = await budgetPaused();
    return json(req, {
      ok: configured && !paused,
      budget: paused ? "paused" : "ok",
      model: model.model,
      modelVerified: model.modelVerified,
      fo: foLabel(session),
      limits: limitSnapshot(),
      demo: aiMocked() || foMocked(),
      configured,
    });
  } catch (error) {
    return fail(req, error);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: json(req, {}).headers });
}
