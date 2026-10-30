"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const STATUSES = ["PRESENT", "ABSENT", "LATE"] as const;
type Status = (typeof STATUSES)[number];

export async function saveTeacherAttendance(day: string, formData: FormData) {
  const session = await requireRole("ADMIN");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;

  const teachers = await db.user.findMany({
    where: { schoolId: session.schoolId, role: "TEACHER", active: true },
    select: { id: true },
  });

  const date = new Date(`${day}T00:00:00.000Z`);

  for (const t of teachers) {
    const raw = formData.get(`t_${t.id}`);
    const status: Status = STATUSES.includes(raw as Status) ? (raw as Status) : "PRESENT";
    const note = typeof formData.get(`tn_${t.id}`) === "string" ? (formData.get(`tn_${t.id}`) as string).trim() || null : null;

    await db.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId: t.id, date } },
      update: { status, note, recordedById: session.userId },
      create: { schoolId: session.schoolId, teacherId: t.id, date, status, note, recordedById: session.userId },
    });
  }

  await audit(session, "UPDATE", "TeacherAttendance", undefined, { day, count: teachers.length });
  revalidatePath("/admin", "layout");
  redirect(`/admin/teachers-attendance?date=${day}&saved=1`);
}
