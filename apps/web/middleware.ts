import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/offline", "/login/magic"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") ?? "";
  const baseDomain = process.env.BASE_DOMAIN;
  let tenantSlug: string | null = null;
  if (baseDomain && host.endsWith(baseDomain)) {
    tenantSlug = host.slice(0, -(baseDomain.length + 1)).split(".")[0] ?? null;
  } else if (host.endsWith(".localhost")) {
    tenantSlug = host.split(".")[0] ?? null;
  }

  const response = NextResponse.next();
  if (tenantSlug) {
    response.headers.set("x-tenant-slug", tenantSlug);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)"],
};
