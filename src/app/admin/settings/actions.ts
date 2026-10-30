"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const MAX_LOGO = 400 * 1024; // stored as a data URL in the database

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
});

export type SettingsState = { errors?: Record<string, string[] | undefined>; message?: string };

export async function updateSchool(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  let logo: string | null | undefined; // undefined = keep current
  if (formData.get("removeLogo") === "on") logo = null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!["image/png", "image/jpeg"].includes(file.type)) return { errors: { logo: ["PNG ou JPG uniquement"] } };
    if (file.size > MAX_LOGO) return { errors: { logo: ["400 Ko maximum"] } };
    logo = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  }

  await db.school.update({
    where: { id: session.schoolId },
    data: { name: d.name, address: d.address || null, phone: d.phone || null, email: d.email || null, ...(logo !== undefined ? { logo } : {}) },
  });
  await audit(session, "UPDATE", "School", session.schoolId, { name: d.name });
  redirect("/admin/settings?saved=1");
}

const pwSchema = z
  .object({
    current: z.string().min(1, "Requis"),
    next: z.string().min(8, "8 caractères minimum"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });

export async function changePassword(_: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await requireRole("ADMIN");
  const parsed = pwSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await bcrypt.compare(parsed.data.current, user.password))) {
    return { errors: { current: ["Mot de passe actuel incorrect"] } };
  }

  await db.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(parsed.data.next, 10) } });
  await audit(session, "UPDATE", "User", user.id, { password: "changed" });
  redirect("/admin/settings?tab=security&saved=1");
}
