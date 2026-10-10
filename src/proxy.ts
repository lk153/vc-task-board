import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect for signed-out visitors. It only checks that a session
 * cookie exists — real authentication and permission checks happen on the
 * server for every page and API request (see src/server/http.ts).
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const signIn = new URL("/sign-in", request.url);
  if (pathname !== "/") signIn.searchParams.set("next", pathname + search);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Only app pages; sign-in, sign-up, invites, APIs and assets pass straight through.
  matcher: ["/", "/b/:path*"],
};
