import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";

/** A STUDENT session must be linked to exactly one Student profile (admin links it). */
export async function requireStudent(session: SessionPayload) {
  const student = await db.student.findFirst({
    where: { userId: session.userId, schoolId: session.schoolId },
  });
  if (!student) notFound();
  return student;
}
