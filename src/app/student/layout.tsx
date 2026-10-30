import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { StudentNav } from "./student-nav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("STUDENT");
  const unread = await db.notification.count({ where: { userId: session.userId, readAt: null } });

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white sm:border-x sm:border-line sm:shadow-xl">
      <main className="pb-24">{children}</main>
      <StudentNav unread={unread} />
    </div>
  );
}
