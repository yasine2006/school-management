import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { AttendanceView } from "@/components/attendance-view";

export const metadata: Metadata = { title: "Présences" };

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; date?: string; saved?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  return <AttendanceView basePath="/admin/attendance" schoolId={schoolId} searchParams={await searchParams} />;
}
