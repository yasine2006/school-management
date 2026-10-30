import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BookOpen, CalendarX2, LogOut, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { invoiceTotals } from "@/lib/fees";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { requireStudent } from "./queries";

export const metadata: Metadata = { title: "Mon espace élève" };

export default async function StudentHome() {
  const session = await requireRole("STUDENT");
  const student = await requireStudent(session);

  const [full, unread] = await Promise.all([
    db.student.findUniqueOrThrow({
      where: { id: student.id },
      include: {
        enrollments: { where: { status: "ACTIVE" }, include: { group: { include: { specialty: true, level: true } } } },
        invoices: { orderBy: { month: "desc" }, include: { lines: true, payments: true }, take: 6 },
        attendance: { orderBy: { date: "desc" }, take: 60 },
        user: { include: { notifications: { orderBy: { createdAt: "desc" }, take: 4 } } },
      },
    }),
    db.notification.count({ where: { userId: session.userId, readAt: null } }),
  ]);

  const notes = full.user?.notifications ?? [];
  const since30 = new Date(new Date().getTime() - 30 * 86_400_000);
  const absences = full.attendance.filter((a) => a.status === "ABSENT" && a.date >= since30).length;
  const remaining = full.invoices.reduce((s, f) => s + invoiceTotals(f).remaining, 0);
  const subjects = [...new Set(full.enrollments.map((e) => e.group.specialty.name))];
  const name = `${full.firstName} ${full.lastName}`;

  const stats: { icon: typeof Wallet; tint: string; label: string; value: string | number }[] = [
    { icon: Wallet, tint: "bg-brand-50 text-brand-600", label: "Reste à payer", value: `${remaining} DH` },
    { icon: BookOpen, tint: "bg-violet-50 text-violet-600", label: "Matières suivies", value: subjects.length },
    { icon: CalendarX2, tint: "bg-rose-50 text-rose-500", label: "Absences (30 j)", value: absences },
  ];

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Avatar name={name} photo={full.photo} size={44} />
          <div className="leading-tight">
            <p className="text-lg font-bold">{name}</p>
            <p className="text-sm text-muted">Élève · {subjects.join(", ") || "—"}</p>
          </div>
        </div>
        <a href="/logout" aria-label="Déconnexion" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <LogOut size={19} />
        </a>
      </header>

      <div className="space-y-5 p-5">
        <section className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-line p-3 text-center">
              <span className={`mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full ${s.tint}`}>
                <s.icon size={16} />
              </span>
              <p className="text-base font-bold">{s.value}</p>
              <p className="text-[11px] text-muted">{s.label}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">Notifications{unread > 0 ? ` (${unread} non lues)` : ""}</h2>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 p-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
              </li>
            ))}
            {!notes.length && <li className="p-5 text-center text-sm text-muted">Aucune notification.</li>}
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {[
            { href: "/student/enrollments", label: "Mes cours & dates d'inscription" },
            { href: "/student/schedule", label: "Mon emploi du temps" },
            { href: "/student/attendance", label: "Mes présences" },
            { href: "/student/payments", label: "Mes factures" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-xl border border-line p-3.5 text-sm font-medium hover:bg-slate-50">
              {l.label} →
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
