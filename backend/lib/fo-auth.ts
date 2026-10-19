import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

const AUTH_CODES = new Set(["invalid_grant", "invalid_token", "unauthorized"]);

// Transport failures only. A tool result that mentions authorization is not an auth rejection:
// Fo already accepted that call, and the runner decides whether the outcome is known.
export function isAuthRejection(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if (error instanceof UnauthorizedError) return true;
  if (error instanceof StreamableHTTPError && error.code === 401) return true;
  if (
    error instanceof OAuthError &&
    AUTH_CODES.has(String(error.errorCode))
  )
    return true;
  const value = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    error?: unknown;
    errorCode?: unknown;
  };
  if (value.name === "UnauthorizedError") return true;
  if (value.code === 401 || value.status === 401 || value.statusCode === 401)
    return true;
  const oauth =
    typeof value.error === "string"
      ? value.error
      : typeof value.errorCode === "string"
        ? value.errorCode
        : "";
  if (AUTH_CODES.has(oauth)) return true;
  const message = typeof value.message === "string" ? value.message : "";
  if (
    /^unauthorized$/i.test(message.trim()) ||
    /\binvalid_grant\b|\binvalid_token\b|failed to (?:re-)?authenticate|authentication failed|failed to authorize|authentication requires user authorization|server returned 401\b/i.test(
      message,
    )
  )
    return true;
  return false;
}

