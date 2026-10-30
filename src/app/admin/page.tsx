import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowRight, CircleCheck, GraduationCap, LayoutGrid, TrendingUp, UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { invoiceStatus, firstOfMonth, isOverdue } from "@/lib/fees";
import { formatLongDate, timeAgo } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { EnrollmentChart, LevelDonut, type Slice } from "@/components/charts";

export const metadata: Metadata = { title: "Dashboard" };

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function Kpi({
  icon: Icon,
  tint,
  label,
  value,
  children,
}: {
  icon: typeof UserCheck;
  tint: string;
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tint}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-0.5 text-3xl font-bold tracking-tight">{value}</p>
        {children}
      </div>
    </Card>
  );
}

function Progress({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}

export default async function AdminDashboard() {
  const { schoolId, userId } = await requireRole("ADMIN");
  const now = new Date();
  const month = firstOfMonth(now);

  const [students, enrollments, invoices, notifications] = await Promise.all([
    db.student.findMany({ where: { schoolId, archived: false }, select: { registeredAt: true } }),
    db.enrollment.findMany({
      where: { status: "ACTIVE", student: { schoolId, archived: false } },
      include: { group: { include: { specialty: true } } },
    }),
    db.invoice.findMany({
      where: { month, student: { schoolId, archived: false } },
      include: { payments: true, lines: { include: { enrollment: { include: { group: true } } } } },
    }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);

  // KPIs
  const total = students.length;
  const newThisMonth = students.filter((s) => s.registeredAt >= month).length;
  const paid = invoices.filter((f) => invoiceStatus(f) === "PAID").length;
  const late = invoices.filter((f) => isOverdue(f, now)).length;
  const pct = (n: number) => (invoices.length ? Math.round((n / invoices.length) * 100) : 0);

  // Groups whose invoices are mostly overdue (min. 3)
  const perGroup = new Map<number, { name: string; total: number; late: number }>();
  for (const f of invoices) {
    for (const line of f.lines) {
      const g = line.enrollment?.group;
      if (!g) continue;
      const row = perGroup.get(g.id) ?? { name: g.name, total: 0, late: 0 };
      row.total++;
      if (isOverdue(f, now)) row.late++;
      perGroup.set(g.id, row);
    }
  }
  const problemGroups = [...perGroup.values()].filter((g) => g.total >= 3 && g.late / g.total >= 0.5);

  // Enrollment curve (current year, Jan → current month)
  const curve = MONTHS.slice(0, now.getUTCMonth() + 1).map((m, i) => ({
    month: m,
    count: students.filter((s) => s.registeredAt.getUTCFullYear() === now.getUTCFullYear() && s.registeredAt.getUTCMonth() === i).length,
  }));

  // Split by subject
  const bySubject = new Map<string, { name: string; color: string | null; value: number }>();
  for (const e of enrollments) {
    const s = e.group.specialty;
    const row = bySubject.get(s.name) ?? { name: s.name, color: s.color, value: 0 };
    row.value++;
    bySubject.set(s.name, row);
  }
  const slices: Slice[] = [...bySubject.values()]
    .sort((a, b) => b.value - a.value)
    .map((s) => ({ name: s.name, value: s.value, color: s.color ?? "#94a3b8" }));
  const enrolled = enrollments.length;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble de votre centre"
        action={<p className="text-sm font-medium text-ink">{formatLongDate(now)}</p>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={GraduationCap} tint="bg-brand-50 text-brand-600" label="Total élèves" value={total}>
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUp size={13} /> +{newThisMonth} ce mois
          </p>
        </Kpi>
        <Kpi icon={CircleCheck} tint="bg-emerald-50 text-emerald-600" label="Factures payées" value={paid}>
          <Progress pct={pct(paid)} color="bg-emerald-500" label={`${pct(paid)}%`} />
        </Kpi>
        <Kpi icon={AlertCircle} tint="bg-rose-50 text-rose-500" label="En retard de paiement" value={late}>
          <Progress pct={pct(late)} color="bg-rose-500" label={`${pct(late)}%`} />
        </Kpi>
        <Kpi icon={LayoutGrid} tint="bg-violet-50 text-violet-600" label="Inscriptions actives" value={enrolled}>
          <Link href="/admin/enrollments" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline">
            {problemGroups.length} groupe(s) à relancer <ArrowRight size={12} />
          </Link>
        </Kpi>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Évolution des inscriptions</h2>
            <span className="text-xs text-muted">Cette année</span>
          </div>
          <EnrollmentChart data={curve} />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Répartition par matière</h2>
            <span className="text-xs text-muted">{enrolled} inscription(s) · {total} élève(s)</span>
          </div>
          <LevelDonut data={slices} total={enrolled} />
          <ul className="mt-4 space-y-2 text-sm">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-medium text-muted">{enrolled ? Math.round((s.value / enrolled) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col p-5">
          <h2 className="mb-2 font-semibold">Dernières notifications</h2>
          <ul className="flex-1 divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.title.startsWith("Paiement") ? "bg-emerald-50 text-emerald-600" : n.title.startsWith("Absence") || n.title.startsWith("Retard") ? "bg-rose-50 text-rose-500" : n.title.toLowerCase().includes("rappel") ? "bg-amber-50 text-amber-600" : n.title.toLowerCase().includes("annonce") ? "bg-brand-50 text-brand-600" : "bg-amber-50 text-amber-600"}`}>
                  {n.title.startsWith("Paiement") ? <CircleCheck size={16} /> : n.title.startsWith("Absence") || n.title.startsWith("Retard") ? <AlertCircle size={16} /> : <UserCheck size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
              </li>
            ))}
            {!notifications.length && <li className="py-6 text-center text-sm text-muted">Aucune notification.</li>}
          </ul>
          <Link href="/admin/notifications" className="mt-2 inline-flex items-center justify-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            Voir toutes les notifications <ArrowRight size={14} />
          </Link>
        </Card>
      </section>
    </>
  );
}
