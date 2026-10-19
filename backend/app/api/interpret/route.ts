import { fail, json } from "../../../lib/http";
import { holdPact, interpretInput, runInterpretation } from "../../../lib/interpret";
import { limitInterpret } from "../../../lib/rate-limit";
import { authed, isResponse } from "../../../lib/route";
import { toolsFor } from "../../../lib/runtime";
import { openStore } from "../../../lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let release = () => {};
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    await limitInterpret(openStore(), gate.installId);
    const { pact } = interpretInput.parse(await req.json());
    release = holdPact(pact.id);
    const result = await runInterpretation({
      pact,
      actions: gate.session.actions,
      tools: toolsFor(gate.session),
    });
    if ("stopped" in result && result.stopped) return json(req, { reply: result.reply });
    return json(req, result);
  } catch (error) {
    return fail(req, error);
  } finally {
    release();
  }
}
