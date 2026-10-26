import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { loadAccessToken } from "@/lib/access-token";
import { proxy } from "./proxy";

const tokenDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-token-"));
process.env.LOCAL_DESIGNER_TOKEN_FILE = path.join(tokenDirectory, "access-token");
const TOKEN = loadAccessToken();

const API = "http://127.0.0.1:4490/api/designs";
const SIGNED_IN = { cookie: `local-designer-token=${TOKEN}` };

function requestFor(headers: Record<string, string>, method = "POST", url = API): NextRequest {
  return new NextRequest(url, { method, headers: { host: "127.0.0.1:4490", ...headers } });
}

const SAME_ORIGIN_JSON = { origin: "http://127.0.0.1:4490", "content-type": "application/json" };
const JSON_HEADERS = { ...SIGNED_IN, ...SAME_ORIGIN_JSON };

describe("proxy", () => {
  afterAll(() => fs.rmSync(tokenDirectory, { recursive: true, force: true }));

  it("allows signed-in same-origin JSON posts and plain reads on loopback", () => {
    expect(proxy(requestFor(JSON_HEADERS)).status).toBe(200);
    expect(proxy(requestFor(SIGNED_IN, "GET")).status).toBe(200);
    expect(proxy(requestFor({ ...SIGNED_IN, host: "localhost:4477" }, "GET")).status).toBe(200);
    expect(proxy(requestFor({ ...SIGNED_IN, host: "[::1]:4477" }, "GET")).status).toBe(200);
  });

  it("refuses other hosts, so DNS rebinding cannot reach it", () => {
    expect(proxy(requestFor({ ...SIGNED_IN, host: "evil.example:4477" }, "GET")).status).toBe(403);
    expect(proxy(new NextRequest(API, { headers: {} })).status).toBe(403);
  });

  it("refuses posts from other sites or without a JSON body", () => {
    expect(proxy(requestFor({ ...JSON_HEADERS, origin: "https://evil.example" })).status).toBe(403);
    expect(proxy(requestFor({ ...JSON_HEADERS, "content-type": "text/plain" })).status).toBe(403);
    expect(proxy(requestFor({ ...SIGNED_IN, "content-type": "application/json" })).status).toBe(
      403,
    );
    expect(proxy(requestFor({ ...JSON_HEADERS, origin: "null" })).status).toBe(403);
  });

  it("refuses any request without the access cookie, even with forged same-origin headers", () => {
    expect(proxy(requestFor(SAME_ORIGIN_JSON)).status).toBe(401);
    expect(proxy(requestFor({}, "GET")).status).toBe(401);
    expect(proxy(requestFor({ cookie: "local-designer-token=wrong" }, "GET")).status).toBe(401);
  });

  it("signs the browser in from the token link and strips the token from the URL", () => {
    const response = proxy(
      requestFor({}, "GET", `http://127.0.0.1:4490/d/abc?token=${TOKEN}&tab=notes`),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:4490/d/abc?tab=notes");
    const cookie = response.cookies.get("local-designer-token");
    expect(cookie).toMatchObject({ value: TOKEN, httpOnly: true, sameSite: "strict", path: "/" });
  });

  it("serves the static preview without the cookie, because its sandbox has no origin", () => {
    const preview = "http://127.0.0.1:4490/preview/main.js";
    expect(proxy(requestFor({}, "GET", preview)).status).toBe(200);
    expect(proxy(requestFor({ host: "evil.example:4490" }, "GET", preview)).status).toBe(403);
    expect(proxy(requestFor({}, "POST", preview)).status).toBe(401);
    expect(proxy(requestFor({}, "GET", "http://127.0.0.1:4490/previews")).status).toBe(401);
  });

  it("lets only this app frame the preview page and limits it to this app's scripts", () => {
    const preview = proxy(requestFor({}, "GET", "http://127.0.0.1:4490/preview/index.html"));
    expect(preview.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(preview.headers.get("content-security-policy")).toBe(
      "default-src 'none'; script-src http://127.0.0.1:4490 'unsafe-eval'; " +
        "style-src 'unsafe-inline'; img-src data:; form-action 'none'; " +
        "frame-ancestors http://127.0.0.1:4490",
    );
  });

  it("forbids framing on every other response", () => {
    for (const response of [proxy(requestFor(SIGNED_IN, "GET")), proxy(requestFor({}, "GET"))]) {
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
    }
  });
});
