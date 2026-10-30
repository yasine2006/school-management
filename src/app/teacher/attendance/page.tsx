import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { AttendanceView } from "@/components/attendance-view";

export const metadata: Metadata = { title: "Présences" };

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; date?: string; saved?: string }>;
}) {
  const { schoolId, userId } = await requireRole("TEACHER");
  return <AttendanceView basePath="/teacher/attendance" schoolId={schoolId} teacherId={userId} searchParams={await searchParams} />;
}
