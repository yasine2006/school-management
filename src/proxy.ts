import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const HOME = { ADMIN: "/admin", TEACHER: "/teacher", STUDENT: "/student" } as const;
type Role = keyof typeof HOME;

async function roleFrom(req: NextRequest): Promise<Role | null> {
  const token = req.cookies.get("session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.role as Role;
  } catch {
    return null;
  }
}

// First line of defence (redirects). Real authorization is enforced again
// in every page / action with requireRole() — never rely on the proxy alone.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = await roleFrom(req);

  if (pathname === "/login") {
    return role ? NextResponse.redirect(new URL(HOME[role], req.url)) : NextResponse.next();
  }

  const area = (Object.keys(HOME) as Role[]).find((r) => pathname.startsWith(HOME[r]));
  if (!area) return NextResponse.next();

  if (!role) return NextResponse.redirect(new URL("/login", req.url));
  if (role !== area) return NextResponse.redirect(new URL(HOME[role], req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/teacher/:path*", "/student/:path*"],
};
