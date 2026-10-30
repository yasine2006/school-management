import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { AppShell } from "@/components/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("ADMIN");

  const [school, user, unread] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: session.schoolId }, select: { name: true, logo: true } }),
    db.user.findUniqueOrThrow({ where: { id: session.userId }, select: { name: true, email: true } }),
    db.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  return (
    <AppShell role="ADMIN" school={school} user={user} unread={unread}>
      {children}
    </AppShell>
  );
}
