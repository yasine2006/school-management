import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, FileSpreadsheet, FileText, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { buildDataset } from "@/lib/reports";
import { formatDate, formatDH, toInputDate } from "@/lib/format";
import { Card, PageHeader, td, th } from "@/components/ui";
import { ReportBuilder } from "./report-builder";

export const metadata: Metadata = { title: "Rapports & Impayés — Centre Excellence" };

type TabItem = {
  key: string;
  label: string;
  icon: typeof AlertCircle;
  badge?: string;
};

const TABS: TabItem[] = [
  { key: "unpaid", label: "Élèves non payés (Impayés)", icon: AlertCircle, badge: "Prioritaire" },
  { key: "invoices", label: "État des paiements", icon: FileText },
  { key: "students", label: "Élèves", icon: Users },
  { key: "enrollments", label: "Inscriptions", icon: FileSpreadsheet },
  { key: "receipts", label: "Reçus & Encaissements", icon: CheckCircle2 },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];
  const today = new Date();
  const todayInput = toInputDate(today);

  const [school, groups, preview, recent] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, logo: true } }),
    db.group.findMany({
      where: { schoolId, active: true },
      select: {
        id: true,
        name: true,
        specialty: { select: { name: true } },
        level: { select: { name: true, order: true } },
      },
      orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
    }),
    buildDataset(
      schoolId,
      new URLSearchParams(
        tab.key === "unpaid" ? { type: tab.key, asOf: todayInput } : { type: tab.key },
      ),
    ),
    tab.key === "receipts"
      ? db.payment.findMany({
          where: { invoice: { student: { schoolId } } },
          include: { invoice: { include: { student: true, lines: true } } },
          orderBy: { paidAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Centre d'Analyses & Rapports"
        subtitle="Générez, filtrez avec précision et exportez vos états financiers et listes d'élèves en PDF ou Excel."
      />

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5 shadow-sm">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={`/admin/reports?tab=${t.key}`}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
            >
              <Icon size={16} className={isActive ? "text-white" : "text-slate-400"} />
              <span>{t.label}</span>
              {t.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <ReportBuilder
        key={tab.key}
        type={tab.key}
        withCols={tab.key === "students"}
        firstCol="Nom complet"
        schoolName={school.name}
        todayInput={todayInput}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          levelName: g.level.name,
          specialtyName: g.specialty.name,
        }))}
        initial={{
          title: preview.title,
          subtitle: preview.subtitle ?? null,
          head: preview.head,
          rows: preview.rows.slice(0, 10),
          total: preview.rows.length,
          money: preview.money,
          summary: preview.summary ?? null,
        }}
      />

      {tab.key === "receipts" && (
        <Card className="mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="border-b border-line p-5">
            <h2 className="text-base font-bold text-ink">Derniers reçus encaissés</h2>
            <p className="mt-0.5 text-xs text-muted">
              Historique des 10 derniers encaissements récents dans l&apos;établissement.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>N° reçu</th>
                  <th className={th}>Date encaissement</th>
                  <th className={th}>Élève</th>
                  <th className={th}>Matières / Groupe</th>
                  <th className={th}>Montant</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className={`${td} font-mono font-medium text-brand-600`}>
                      {p.receiptNo ?? `#${p.id}`}
                    </td>
                    <td className={td}>{formatDate(p.paidAt)}</td>
                    <td className={`${td} font-medium`}>
                      {p.invoice.student.lastName} {p.invoice.student.firstName}
                    </td>
                    <td className={`${td} text-xs text-slate-500`}>
                      {p.invoice.lines.map((l) => l.label).join(", ") || "—"}
                    </td>
                    <td className={`${td} font-semibold text-emerald-600`}>
                      {formatDH(Number(p.amount.toString()))}
                    </td>
                    <td className={`${td} text-right`}>
                      <a
                        href={`/api/receipts/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
                      >
                        <FileText size={13} /> Reçu PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
