import { NextRequest, NextResponse } from "next/server";

const ADMIN_CANONICAL_HOST = "www.yooreru.com";
const ADMIN_REDIRECT_HOST = "yooreru.com";

export function proxy(request: NextRequest) {
  if (requestHost(request) === ADMIN_REDIRECT_HOST && isAdminPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.hostname = ADMIN_CANONICAL_HOST;
    return NextResponse.redirect(url);
  }

  const pathname = decodeURIComponent(request.nextUrl.pathname);

  if (pathname === "/그네에게" || pathname === "/그네에게/") {
    const url = request.nextUrl.clone();
    url.pathname = "/geuneege";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function requestHost(request: NextRequest) {
  return request.headers.get("host")?.split(":")[0] ?? request.nextUrl.hostname;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
