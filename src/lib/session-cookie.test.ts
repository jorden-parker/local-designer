import { describe, expect, it } from "vitest";
import { createSession, isValidSession, SESSION_MAX_AGE_SECONDS } from "./session-cookie";

const TOKEN = "server-secret";
const NOW = Date.UTC(2026, 9, 27);

describe("session cookie", () => {
  it("accepts a session it created and does not contain the token", () => {
    const session = createSession(TOKEN, NOW);
    expect(session).not.toContain(TOKEN);
    expect(isValidSession(session, TOKEN, NOW)).toBe(true);
  });

  it("rejects a session once it expires", () => {
    const session = createSession(TOKEN, NOW);
    const expiry = NOW + SESSION_MAX_AGE_SECONDS * 1000;
    expect(isValidSession(session, TOKEN, expiry - 1)).toBe(true);
    expect(isValidSession(session, TOKEN, expiry)).toBe(false);
  });

  it("rejects a session signed with another token, so a new token revokes it", () => {
    expect(isValidSession(createSession("old-secret", NOW), TOKEN, NOW)).toBe(false);
  });

  it("rejects a session whose expiry was pushed out", () => {
    const [, signature] = createSession(TOKEN, NOW).split(".");
    const later = Math.floor(NOW / 1000) + SESSION_MAX_AGE_SECONDS * 10;
    expect(isValidSession(`${later}.${signature}`, TOKEN, NOW)).toBe(false);
  });

  it("rejects missing and malformed values", () => {
    for (const value of [undefined, "", "abc", ".", "x.y", TOKEN]) {
      expect(isValidSession(value, TOKEN, NOW)).toBe(false);
    }
  });
});
