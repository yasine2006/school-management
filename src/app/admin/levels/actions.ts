"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  order: z.coerce.number().int().min(0).default(0),
});

export type LevelFormState = { errors?: Record<string, string[] | undefined>; message?: string; ok?: boolean };

export async function createLevel(_: LevelFormState, formData: FormData): Promise<LevelFormState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  if (await db.level.findFirst({ where: { schoolId: session.schoolId, name: parsed.data.name } })) {
    return { errors: { name: ["Ce niveau existe déjà"] } };
  }

  const l = await db.level.create({ data: { schoolId: session.schoolId, name: parsed.data.name, order: parsed.data.order } });
  await audit(session, "CREATE", "Level", l.id, { name: l.name });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteLevel(id: number) {
  const session = await requireRole("ADMIN");
  const l = await db.level.findFirst({ where: { id, schoolId: session.schoolId }, include: { _count: { select: { groups: true } } } });
  if (!l || l._count.groups > 0) return; // keep levels that are used by a group

  await db.level.delete({ where: { id } });
  await audit(session, "DELETE", "Level", id, { name: l.name });
  revalidatePath("/admin/levels");
}
