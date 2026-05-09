import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = decodeURIComponent(request.nextUrl.pathname);

  if (pathname === "/그네에게" || pathname === "/그네에게/") {
    const url = request.nextUrl.clone();
    url.pathname = "/geuneege";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
