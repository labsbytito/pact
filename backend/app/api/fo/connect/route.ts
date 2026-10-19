import { foMocked, publicBase } from "../../../../lib/env";
import { fail, json } from "../../../../lib/http";
import { authed, isResponse } from "../../../../lib/route";
import { openStore } from "../../../../lib/store";

export async function POST(req: Request) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    if (foMocked() || !gate.session.fo) return json(req, { connected: true, demo: true });
    if (!gate.session.fo.status().fo) await gate.session.threads.forgetAll();
    const begun = await gate.session.fo.begin();
    if ("url" in begun && begun.url) {
      const state = new URL(begun.url).searchParams.get("state");
      if (state) await openStore().set(`oauth-state:${state}`, gate.installId, 600);
      return json(req, { url: begun.url, redirect: `${publicBase(req)}/api/fo/callback` });
    }
    return json(req, { connected: true });
  } catch (error) {
    return fail(req, error);
  }
}
