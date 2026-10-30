import { NextResponse, type NextRequest } from "next/server";

/** Clears the session cookie and sends the visitor back to the login page. */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete("session");
  return res;
}
