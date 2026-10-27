import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAccessToken, matchesSecret } from "./access-token";

describe("access token", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "access-token-"));
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it("creates a private random token once and reuses it", () => {
    const file = path.join(directory, "nested", "access-token");
    const token = loadAccessToken(file);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(loadAccessToken(file)).toBe(token);
  });

  it("matches only the exact token", () => {
    expect(matchesSecret("secret-token", "secret-token")).toBe(true);
    expect(matchesSecret("secret-tokem", "secret-token")).toBe(false);
    expect(matchesSecret("secret", "secret-token")).toBe(false);
    expect(matchesSecret(null, "secret-token")).toBe(false);
  });
});
