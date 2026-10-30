"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

export async function updateAbsenceNote(attendanceId: number, date: string, formData: FormData) {
  const session = await requireRole("ADMIN");
  const note = typeof formData.get("note") === "string" ? (formData.get("note") as string).trim() || null : null;

  const att = await db.attendance.findFirst({
    where: { id: attendanceId, group: { schoolId: session.schoolId } },
  });
  if (!att) return;

  await db.attendance.update({
    where: { id: attendanceId },
    data: { note },
  });

  await audit(session, "UPDATE", "Attendance", att.id, { note: note ? "set" : "cleared", date });
  revalidatePath("/admin", "layout");
  redirect(`/admin/absences?date=${date}`);
}
