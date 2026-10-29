import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE, isAuthBypassed, verifyAuthToken } from "@/lib/auth";

/**
 * Přihlašovací brána: bez platné cookie `digitry-auth` vede každá stránka na `/login`
 * (s návratem `?next=`), API odpoví 401. Statické soubory, ikony a manifest PWA vyřazuje matcher.
 */
export async function proxy(request: NextRequest) {
  if (isAuthBypassed()) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const session = await verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nepřihlášeno – přihlaste se na /login." }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt).*)"],
};
