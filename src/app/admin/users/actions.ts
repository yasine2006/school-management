"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  phone: z.string().trim().optional(),
  role: z.enum(["ADMIN", "TEACHER"]),
  password: z.string().min(8, "8 caractères minimum"),
});

export type UserFormState = { errors?: Record<string, string[] | undefined>; ok?: boolean };

export async function createUser(_: UserFormState, formData: FormData): Promise<UserFormState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  if (await db.user.findUnique({ where: { email: d.email } })) return { errors: { email: ["Cet email est déjà utilisé"] } };

  const user = await db.user.create({
    data: { schoolId: session.schoolId, name: d.name, email: d.email, phone: d.phone || null, role: d.role, password: await bcrypt.hash(d.password, 10) },
  });
  await audit(session, "CREATE", "User", user.id, { email: d.email, role: d.role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function toggleActive(id: number) {
  const session = await requireRole("ADMIN");
  if (id === session.userId) return; // never lock yourself out

  const user = await db.user.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!user) return;

  await db.user.update({ where: { id }, data: { active: !user.active } });
  await audit(session, "UPDATE", "User", id, { active: !user.active });
  revalidatePath("/admin/users");
}
