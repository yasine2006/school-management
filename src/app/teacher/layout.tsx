import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { AppShell } from "@/components/shell";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("TEACHER");

  const [school, user] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: session.schoolId }, select: { name: true, logo: true } }),
    db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true, email: true } }),
  ]);

  return (
    <AppShell role="TEACHER" school={school} user={user}>
      {children}
    </AppShell>
  );
}
