"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const optionalNum = z.coerce.number().int().positive().optional().or(z.literal(""));

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  specialtyId: z.coerce.number().int().positive("Matière requise"),
  levelId: z.coerce.number().int().positive("Niveau requis"),
  teacherId: optionalNum,
  kind: z.enum(["REGULAR", "CONCOURS"]).default("REGULAR"),
  monthlyFee: z.coerce.number().positive("Montant invalide"),
  capacity: optionalNum,
});

export type GroupFormState = { errors?: Record<string, string[] | undefined>; message?: string; ok?: boolean };

const MAX_SESSIONS = 3;

/** Reads the up-to-3 optional weekly slots (day + start + end + room). */
function readSessions(formData: FormData) {
  const out: { dayOfWeek: number; startTime: string; endTime: string; room: string | null }[] = [];
  for (let i = 0; i < MAX_SESSIONS; i++) {
    const day = Number(formData.get(`day_${i}`));
    const start = String(formData.get(`start_${i}`) ?? "");
    const end = String(formData.get(`end_${i}`) ?? "");
    if (!day || !start || !end) continue;
    out.push({ dayOfWeek: day, startTime: start, endTime: end, room: String(formData.get(`room_${i}`) ?? "").trim() || null });
  }
  return out;
}

export async function createGroup(_: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  if (await db.group.findFirst({ where: { schoolId: session.schoolId, name: d.name } })) {
    return { errors: { name: ["Ce groupe existe déjà"] } };
  }

  // multi-tenant guards
  const [specialty, level, teacher] = await Promise.all([
    db.specialty.findFirst({ where: { id: d.specialtyId, schoolId: session.schoolId } }),
    db.level.findFirst({ where: { id: d.levelId, schoolId: session.schoolId } }),
    d.teacherId ? db.user.findFirst({ where: { id: Number(d.teacherId), schoolId: session.schoolId, role: "TEACHER" } }) : null,
  ]);
  if (!specialty || !level) return { message: "Matière ou niveau introuvable." };
  if (d.teacherId && !teacher) return { message: "Enseignant introuvable." };

  const group = await db.group.create({
    data: {
      schoolId: session.schoolId,
      specialtyId: specialty.id,
      levelId: level.id,
      teacherId: teacher?.id ?? null,
      name: d.name,
      kind: d.kind,
      monthlyFee: d.monthlyFee,
      capacity: d.capacity ? Number(d.capacity) : null,
      sessions: { create: readSessions(formData) },
    },
  });

  await audit(session, "CREATE", "Group", group.id, { name: group.name });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteGroup(id: number) {
  const session = await requireRole("ADMIN");
  const group = await db.group.findFirst({ where: { id, schoolId: session.schoolId }, include: { _count: { select: { enrollments: true } } } });
  if (!group || group._count.enrollments > 0) return; // never delete a group that still has enrollments

  await db.group.delete({ where: { id } });
  await audit(session, "DELETE", "Group", id, { name: group.name });
  revalidatePath("/admin", "layout");
}

/** One teacher per group in this MVP; empty value = unassign. */
export async function assignTeacher(groupId: number, formData: FormData) {
  const session = await requireRole("ADMIN");
  const teacherId = Number(formData.get("teacherId")) || null;

  const group = await db.group.findFirst({ where: { id: groupId, schoolId: session.schoolId } });
  if (!group) return;
  if (teacherId) {
    const teacher = await db.user.findFirst({ where: { id: teacherId, schoolId: session.schoolId, role: "TEACHER" } });
    if (!teacher) return;
  }

  await db.group.update({ where: { id: groupId }, data: { teacherId } });
  await audit(session, "UPDATE", "Group", groupId, { teacherId });
  revalidatePath("/admin", "layout");
}
