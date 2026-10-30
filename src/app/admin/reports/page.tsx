import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { buildDataset } from "@/lib/reports";
import { formatDate, formatDH } from "@/lib/format";
import { Card, PageHeader, td, th } from "@/components/ui";
import { ReportBuilder } from "./report-builder";

export const metadata: Metadata = { title: "Rapports" };

const TABS = [
  { key: "students", label: "Élèves" },
  { key: "enrollments", label: "Inscriptions" },
  { key: "invoices", label: "État des paiements" },
  { key: "receipts", label: "Factures / Reçus" },
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const { tab: tabParam } = await searchParams;
  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  const [school, preview, recent] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { name: true, logo: true } }),
    buildDataset(schoolId, new URLSearchParams({ type: tab.key })),
    tab.key === "receipts"
      ? db.payment.findMany({
          where: { invoice: { student: { schoolId } } },
          include: { invoice: { include: { student: true } } },
          orderBy: { paidAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Rapports" subtitle="Générez et téléchargez vos rapports en PDF ou Excel" />

      <div className="mb-5 flex gap-1 rounded-lg border border-line bg-white p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reports?tab=${t.key}`}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${t.key === tab.key ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:bg-slate-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ReportBuilder
        key={tab.key}
        type={tab.key}
        withCols={tab.key === "students"}
        firstCol="Liste des élèves"
        schoolName={school.name}
        initial={{
          title: preview.title,
          subtitle: preview.subtitle ?? null,
          head: preview.head,
          rows: preview.rows.slice(0, 8),
          total: preview.rows.length,
          money: preview.money,
        }}
      />

      {tab.key === "receipts" && (
        <Card className="mt-6 overflow-hidden">
          <h2 className="p-5 pb-3 font-semibold">Derniers reçus encaissés</h2>
          <p className="-mt-2 px-5 pb-3 text-xs text-muted">Les 10 derniers reçus, quels que soient les filtres choisis ci-dessus.</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-line bg-slate-50/70">
                <tr>
                  <th className={th}>N° reçu</th>
                  <th className={th}>Date</th>
                  <th className={th}>Élève</th>
                  <th className={th}>Montant</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} font-medium`}>{p.receiptNo ?? `#${p.id}`}</td>
                    <td className={td}>{formatDate(p.paidAt)}</td>
                    <td className={td}>
                      {p.invoice.student.firstName} {p.invoice.student.lastName}
                    </td>
                    <td className={td}>{formatDH(Number(p.amount.toString()))}</td>
                    <td className={`${td} text-right`}>
                      <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
                        <FileText size={14} /> Reçu PDF
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
