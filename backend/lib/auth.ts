import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export function issueInstallToken(secret: string) {
  const id = randomUUID();
  const mac = createHmac("sha256", secret).update(id).digest("base64url");
  return { id, token: `${id}.${mac}` };
}

export function readInstallId(token: string, secret: string) {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !mac) return null;
  const expected = createHmac("sha256", secret).update(id).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return id;
}
