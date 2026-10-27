import { createHmac } from "node:crypto";
import { matchesSecret } from "@/lib/access-token";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(token: string, expiresAt: number): string {
  return createHmac("sha256", token).update(`session:${expiresAt}`).digest("base64url");
}

export function createSession(token: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${expiresAt}.${sign(token, expiresAt)}`;
}

export function isValidSession(
  value: string | null | undefined,
  token: string,
  now = Date.now(),
): boolean {
  const [expires, signature] = value?.split(".") ?? [];
  const expiresAt = Number(expires);
  if (!signature || !Number.isInteger(expiresAt) || expiresAt * 1000 <= now) return false;
  return matchesSecret(signature, sign(token, expiresAt));
}
