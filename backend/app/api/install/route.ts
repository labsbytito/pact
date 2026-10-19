import { issueInstallToken } from "../../../lib/auth";
import { installSecret } from "../../../lib/env";
import { clientIp, fail, guardOrigin, json } from "../../../lib/http";
import { limitInstall } from "../../../lib/rate-limit";
import { openStore } from "../../../lib/store";

export async function POST(req: Request) {
  try {
    const blocked = guardOrigin(req);
    if (blocked) return blocked;
    await limitInstall(openStore(), clientIp(req));
    const issued = issueInstallToken(installSecret());
    return json(req, { token: issued.token, installId: issued.id });
  } catch (error) {
    return fail(req, error);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: json(req, {}).headers });
}
