import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type SessionPayload = {
  userId: number;
  schoolId: number;
  role: Role;
  name: string;
};

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
};

export const homeFor = (role: Role) =>
  ({ ADMIN: "/admin", TEACHER: "/teacher", STUDENT: "/student" })[role];

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Use at the top of every protected page / server action. */
export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect(homeFor(session.role));

  // A signed JWT can outlive a database reset: make sure the account still
  // exists (and still belongs to the same school) before touching any data.
  const user = await db.user.findFirst({
    where: { id: session.userId, schoolId: session.schoolId, role: session.role },
    select: { id: true },
  });
  if (!user) redirect("/logout");

  return session;
}
