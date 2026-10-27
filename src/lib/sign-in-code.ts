import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { matchesSecret } from "@/lib/access-token";
import { dataDirectory } from "@/lib/data-directory";

const APP_ORIGIN = "http://127.0.0.1:4490";
const CODE_BYTES = 32;

function signInCodePath(): string {
  return process.env.LOCAL_DESIGNER_SIGN_IN_FILE ?? path.join(dataDirectory(), "sign-in-code");
}

function readCode(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : null;
}

function claim(file: string): boolean {
  try {
    fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

export function issueSignInCode(file = signInCodePath()): string {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.rmSync(file, { force: true });
  const code = randomBytes(CODE_BYTES).toString("base64url");
  fs.writeFileSync(file, code, { mode: 0o600, flag: "wx" });
  return code;
}

export function redeemSignInCode(
  candidate: string | null | undefined,
  file = signInCodePath(),
): boolean {
  const code = readCode(file);
  return code !== null && matchesSecret(candidate, code) && claim(file);
}

export function signInLink(code: string): string {
  return `${APP_ORIGIN}/?code=${code}`;
}
