import { NextResponse } from "next/server";
import { parseCookieHeader, verifySessionCookie, adminCookieName } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const token = parseCookieHeader(request.headers.get("cookie"));
  const session = verifySessionCookie(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    cookieName: adminCookieName(),
  });
}
