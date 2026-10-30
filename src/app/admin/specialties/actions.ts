"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide").default("#2f6bff"),
});

export type SpecialtyFormState = { errors?: Record<string, string[] | undefined>; message?: string; ok?: boolean };

export async function createSpecialty(_: SpecialtyFormState, formData: FormData): Promise<SpecialtyFormState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  if (await db.specialty.findFirst({ where: { schoolId: session.schoolId, name: parsed.data.name } })) {
    return { errors: { name: ["Cette matière existe déjà"] } };
  }

  const s = await db.specialty.create({ data: { schoolId: session.schoolId, name: parsed.data.name, color: parsed.data.color } });
  await audit(session, "CREATE", "Specialty", s.id, { name: s.name });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteSpecialty(id: number) {
  const session = await requireRole("ADMIN");
  const s = await db.specialty.findFirst({ where: { id, schoolId: session.schoolId }, include: { _count: { select: { groups: true } } } });
  if (!s || s._count.groups > 0) return; // keep specialties that are used by a group

  await db.specialty.delete({ where: { id } });
  await audit(session, "DELETE", "Specialty", id, { name: s.name });
  revalidatePath("/admin/specialties");
}
