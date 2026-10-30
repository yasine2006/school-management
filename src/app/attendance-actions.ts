"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const STATUSES = ["PRESENT", "ABSENT", "LATE"] as const;
type Status = (typeof STATUSES)[number];
const BASES = new Set(["/admin/attendance", "/teacher/attendance"]);

/** Shared by the admin and teacher attendance pages. Teachers can only touch their own groups. */
export async function saveAttendance(groupId: number, day: string, basePath: string, formData: FormData) {
  const session = await requireRole("ADMIN", "TEACHER");
  if (!BASES.has(basePath) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;

  const group = await db.group.findFirst({
    where: {
      id: groupId,
      schoolId: session.schoolId,
      ...(session.role === "TEACHER" ? { teacherId: session.userId } : {}),
    },
    include: { enrollments: { where: { status: "ACTIVE" }, include: { student: true } } },
  });
  if (!group) return;

  const date = new Date(`${day}T00:00:00.000Z`);
  const students = group.enrollments.map((e) => e.student);
  const previous = await db.attendance.findMany({ where: { groupId, date, studentId: { in: students.map((s) => s.id) } } });
  const before = new Map(previous.map((a) => [a.studentId, a.status as string]));

  let absences = 0;
  for (const s of students) {
    const raw = formData.get(`s_${s.id}`);
    const status: Status = STATUSES.includes(raw as Status) ? (raw as Status) : "PRESENT";
    const note = typeof formData.get(`n_${s.id}`) === "string" ? (formData.get(`n_${s.id}`) as string).trim() || null : null;

    await db.attendance.upsert({
      where: { groupId_studentId_date: { groupId, studentId: s.id, date } },
      update: { status, note },
      create: { groupId, studentId: s.id, date, status, note },
    });

    // notify the student account once, the first time they are marked absent
    if (status === "ABSENT" && before.get(s.id) !== "ABSENT") {
      absences++;
      if (s.userId) {
        await db.notification.create({
          data: { userId: s.userId, title: "Absence non justifiée", body: `${group.name}${note ? ` — ${note}` : ""}` },
        });
      }
    }
  }

  await audit(session, "UPDATE", "Attendance", group.id, { day, newAbsences: absences });
  redirect(`${basePath}?groupId=${groupId}&date=${day}&saved=1`);
}
