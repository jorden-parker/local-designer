import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDirectory } from "@/lib/data-directory";

const TOKEN_BYTES = 32;

function accessTokenPath(): string {
  return process.env.LOCAL_DESIGNER_TOKEN_FILE ?? path.join(dataDirectory(), "access-token");
}

function createAccessToken(file: string): string {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  fs.writeFileSync(file, token, { mode: 0o600, flag: "wx" });
  return token;
}

export function loadAccessToken(file = accessTokenPath()): string {
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  return createAccessToken(file);
}

export function matchesSecret(candidate: string | null | undefined, secret: string): boolean {
  if (!candidate) return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
