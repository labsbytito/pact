import { fail } from "../../../../lib/http";
import { sessionFor } from "../../../../lib/runtime";
import { openStore } from "../../../../lib/store";

function page(ok: boolean) {
  const title = ok ? "Pact connected" : "Pact could not connect";
  const body = ok
    ? "<h1>You’re connected.</h1><p>Return to Pact. You can close this tab.</p>"
    : "<h1>Fo didn’t connect.</h1><p>Return to Pact and try Connect Fo again.</p>";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font:15px -apple-system,system-ui,sans-serif;background:#121212;color:#f5f5f5;padding:48px;max-width:32rem">${body}</body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    },
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return page(false);
    const installId = await openStore().get(`oauth-state:${state}`);
    if (!installId) return page(false);
    const session = await sessionFor(installId, req);
    if (!session.fo) return page(false);
    await session.fo.finish(code, state);
    await openStore().del(`oauth-state:${state}`);
    return page(true);
  } catch (error) {
    if (error instanceof Error) return page(false);
    return fail(req, error);
  }
}
