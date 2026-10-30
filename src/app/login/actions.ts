"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, destroySession, homeFor } from "@/lib/session";
import { clientIp, consumeAttempt, resetAttempts } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginState = { error?: string };

// constant-time-ish: always run bcrypt, even for unknown emails
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const email = parsed.success ? parsed.data.email.toLowerCase() : "invalid";
  const ip = await clientIp();
  const limits = [
    { key: `ip:${ip}`, max: 30 },
    { key: `login:${ip}:${email}`, max: 5 },
  ];

  for (const { key, max } of limits) {
    const { blocked, retryAfterSeconds } = consumeAttempt(key, max);
    if (blocked) {
      const minutes = Math.ceil(retryAfterSeconds / 60);
      return { error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
    }
  }

  if (!parsed.success) return { error: "Email ou mot de passe invalide." };

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(parsed.data.password, user?.password ?? DUMMY_HASH);

  if (!user || !user.active || !ok) return { error: "Email ou mot de passe incorrect." };

  resetAttempts(limits.map((limit) => limit.key));
  const session = { userId: user.id, schoolId: user.schoolId, role: user.role, name: user.name };
  await createSession(session);
  await audit(session, "LOGIN", "User", user.id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
