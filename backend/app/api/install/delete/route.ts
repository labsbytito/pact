import { fail, json } from "../../../../lib/http";
import { authed, isResponse } from "../../../../lib/route";
import { openStore } from "../../../../lib/store";

export async function POST(req: Request) {
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    const store = openStore();
    await store.del(`journal:${gate.installId}`);
    await store.del(`fo:${gate.installId}`);
    return json(req, { deleted: true });
  } catch (error) {
    return fail(req, error);
  }
}
