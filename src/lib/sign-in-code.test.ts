import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueSignInCode, redeemSignInCode, signInLink } from "./sign-in-code";

describe("sign-in code", () => {
  let file: string;

  beforeEach(() => {
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sign-in-code-")), "nested", "code");
  });

  afterEach(() => fs.rmSync(path.dirname(path.dirname(file)), { recursive: true, force: true }));

  it("issues a private random code and replaces the previous one", () => {
    const first = issueSignInCode(file);
    expect(first).toMatch(/^[\w-]{43}$/);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const second = issueSignInCode(file);
    expect(second).not.toBe(first);
    expect(redeemSignInCode(first, file)).toBe(false);
  });

  it("redeems the code only once", () => {
    const code = issueSignInCode(file);
    expect(redeemSignInCode("wrong", file)).toBe(false);
    expect(redeemSignInCode(code, file)).toBe(true);
    expect(redeemSignInCode(code, file)).toBe(false);
  });

  it("redeems nothing before a code is issued", () => {
    expect(redeemSignInCode("anything", file)).toBe(false);
    expect(redeemSignInCode(null, file)).toBe(false);
  });

  it("builds the link that signs the browser in", () => {
    expect(signInLink("abc")).toBe("http://127.0.0.1:4490/?code=abc");
  });
});
