import identity from "../../extension-identity.json" with { type: "json" };
import { ZodError } from "zod";
import { ActionError } from "./actions";
import { AiError } from "./ai";
import { readInstallId } from "./auth";
import { installSecret } from "./env";
import { RateLimitError } from "./rate-limit";

export function allowedIds() {
  const set = process.env.ALLOWED_EXTENSION_IDS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return set?.length ? set : [identity.id];
}

export function originAllowed(origin: string | null) {
  if (!origin) return true;
  if (!origin.startsWith("chrome-extension://")) return false;
  const id = origin.slice("chrome-extension://".length).replace(/\/$/, "");
  return allowedIds().includes(id);
}

export function corsHeaders(origin: string | null) {
  const headers = new Headers();
  headers.set("Vary", "Origin");
  if (origin && originAllowed(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  return headers;
}

export function json(req: Request, body: unknown, status = 200) {
  const headers = corsHeaders(req.headers.get("origin"));
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

export function guardOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !originAllowed(origin))
    return json(req, { error: "This browser origin is not paired with Pact." }, 403);
  return null;
}

export function bearer(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    return readInstallId(token, installSecret());
  } catch {
    return null;
  }
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

export function fail(req: Request, error: unknown) {
  if (error instanceof RateLimitError) {
    const headers = corsHeaders(req.headers.get("origin"));
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Retry-After", String(error.retryAfter));
    return new Response(
      JSON.stringify({ error: error.message, retryAfter: error.retryAfter }),
      { status: 429, headers },
    );
  }
  if (error instanceof ZodError)
    return json(req, { error: "The request was incomplete. No action was submitted." }, 400);
  if (error instanceof ActionError) return json(req, { error: error.message }, 400);
  if (error instanceof AiError) return json(req, { error: error.message }, error.status);
  return json(
    req,
    {
      error:
        "The companion could not complete this request. For an uncertain action, check Fo activity before trying again.",
    },
    500,
  );
}
