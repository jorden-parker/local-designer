import { NextResponse, type NextRequest } from "next/server";
import { loadAccessToken } from "@/lib/access-token";
import { createSession, isValidSession, SESSION_MAX_AGE_SECONDS } from "@/lib/session-cookie";
import { redeemSignInCode } from "@/lib/sign-in-code";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const TOKEN_COOKIE = "local-designer-token";
const CODE_PARAM = "code";

function hostName(host: string | null): string | null {
  if (!host) return null;
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
}

function isLoopback(host: string | null): boolean {
  const name = hostName(host);
  return name !== null && LOOPBACK_HOSTS.has(name);
}

function originHost(origin: string | null): string | null {
  if (!origin || !URL.canParse(origin)) return null;
  return new URL(origin).host;
}

function isSameOriginJson(request: NextRequest): boolean {
  const host = request.headers.get("host");
  const sameOrigin = isLoopback(host) && originHost(request.headers.get("origin")) === host;
  const json = request.headers.get("content-type")?.startsWith("application/json") ?? false;
  return sameOrigin && json;
}

function signInFromLink(request: NextRequest, token: string): NextResponse | null {
  if (!redeemSignInCode(request.nextUrl.searchParams.get(CODE_PARAM))) return null;
  const destination = new URL(request.url);
  destination.searchParams.delete(CODE_PARAM);
  destination.host = request.headers.get("host") ?? destination.host;
  const response = NextResponse.redirect(destination.toString());
  response.cookies.set(TOKEN_COOKIE, createSession(token), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

const PREVIEW_PATH = "/preview/";
const SIGN_IN_HELP =
  "Open the local-designer link printed in the terminal. Each link works once; " +
  "restart local-designer for a new one.";

function isPreviewAsset(request: NextRequest): boolean {
  return request.method === "GET" && request.nextUrl.pathname.startsWith(PREVIEW_PATH);
}

function guard(request: NextRequest, token: string): NextResponse {
  if (!isLoopback(request.headers.get("host"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (isPreviewAsset(request)) return NextResponse.next();
  const signedIn = signInFromLink(request, token);
  if (signedIn) return signedIn;
  if (!isValidSession(request.cookies.get(TOKEN_COOKIE)?.value, token)) {
    return new NextResponse(SIGN_IN_HELP, {
      status: 401,
    });
  }
  if (request.method !== "GET" && request.method !== "HEAD" && !isSameOriginJson(request)) {
    return new NextResponse("Cross-site request refused", { status: 403 });
  }
  return NextResponse.next();
}

function previewPolicy(origin: string): string {
  return [
    "default-src 'none'",
    `script-src ${origin} 'unsafe-eval'`,
    "style-src 'unsafe-inline'",
    "img-src data:",
    "form-action 'none'",
    `frame-ancestors ${origin}`,
  ].join("; ");
}

function requestOrigin(request: NextRequest): string {
  return `${request.nextUrl.protocol}//${request.headers.get("host")}`;
}

function limitFraming(response: NextResponse, request: NextRequest): NextResponse {
  const isPreview = request.nextUrl.pathname.startsWith(PREVIEW_PATH);
  response.headers.set("X-Frame-Options", isPreview ? "SAMEORIGIN" : "DENY");
  response.headers.set(
    "Content-Security-Policy",
    isPreview ? previewPolicy(requestOrigin(request)) : "frame-ancestors 'none'",
  );
  return response;
}

export function proxy(request: NextRequest) {
  return limitFraming(guard(request, loadAccessToken()), request);
}
