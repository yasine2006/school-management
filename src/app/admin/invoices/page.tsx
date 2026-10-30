import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, FilePlus2, FileText } from "lucide-react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { invoiceStatus, invoiceTotals, statusMeta } from "@/lib/fees";
import { countMissingInvoices } from "@/lib/invoicing";
import { formatDate, formatDH } from "@/lib/format";
import { AutoForm } from "@/components/auto-form";
import { Pagination } from "@/components/pagination";
import { Avatar, Badge, Card, inputCls, PageHeader, selectCls, td, th } from "@/components/ui";
import { generateMonthlyInvoices } from "./actions";

export const metadata: Metadata = { title: "Factures" };

const PAGE_SIZE = 10;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; specialtyId?: string; method?: string; status?: string; page?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const { q, specialtyId, method, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const nameFilter = q
    ? Prisma.sql`AND (s."firstName" ILIKE ${`%${q}%`} OR s."lastName" ILIKE ${`%${q}%`})`
    : Prisma.empty;
  const specialtyFilter = specialtyId
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Enrollment" e JOIN "Group" g ON g.id = e."groupId" WHERE e."studentId" = s.id AND g."specialtyId" = ${Number(specialtyId)})`
    : Prisma.empty;
  const methodFilter =
    method === "CASH" || method === "TRANSFER"
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Payment" pm WHERE pm."invoiceId" = i.id AND pm.method = ${method}::"PayMethod")`
      : Prisma.empty;
  const paid = Prisma.sql`COALESCE(p.paid, 0)`;
  const due = Prisma.sql`COALESCE(l.due, 0)`;
  const statusFilter =
    status === "PAID"
      ? Prisma.sql`AND ${paid} >= ${due} AND ${paid} > 0`
      : status === "PARTIAL"
        ? Prisma.sql`AND ${paid} > 0 AND ${paid} < ${due}`
        : status === "UNPAID"
          ? Prisma.sql`AND ${paid} <= 0`
          : Prisma.empty;

  const source = Prisma.sql`
    FROM "Invoice" i
    JOIN "Student" s ON s.id = i."studentId"
    LEFT JOIN (SELECT "invoiceId", SUM(amount) AS paid, MAX("paidAt") AS last_paid FROM "Payment" GROUP BY "invoiceId") p ON p."invoiceId" = i.id
    LEFT JOIN (SELECT "invoiceId", SUM(amount) AS due FROM "InvoiceLine" GROUP BY "invoiceId") l ON l."invoiceId" = i.id
    WHERE s."schoolId" = ${schoolId} AND s.archived = false
    ${nameFilter} ${specialtyFilter} ${methodFilter} ${statusFilter}
  `;

  const [idRows, countRows, specialties, missing] = await Promise.all([
    db.$queryRaw<{ id: number }[]>(
      Prisma.sql`SELECT i.id ${source} ORDER BY COALESCE(p.last_paid, i."dueDate") DESC, i.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    ),
    db.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS count ${source}`),
    db.specialty.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    countMissingInvoices(schoolId),
  ]);

  const ids = idRows.map((r) => r.id);
  const found = ids.length
    ? await db.invoice.findMany({
        where: { id: { in: ids } },
        include: { lines: true, payments: { orderBy: { paidAt: "desc" } }, student: true },
      })
    : [];
  const byId = new Map(found.map((f) => [f.id, f]));
  const pageRows = ids.flatMap((id) => {
    const f = byId.get(id);
    if (!f) return [];
    const t = invoiceTotals(f);
    const last = f.payments[0];
    return [{ invoice: f, t, status: invoiceStatus(f), last, date: last?.paidAt ?? f.dueDate }];
  });
  const total = countRows[0]?.count ?? 0;
  const exportQs = new URLSearchParams({ type: "invoices", format: "xlsx", ...Object.fromEntries(Object.entries({ q, specialtyId, method, status }).filter(([, v]) => v) as [string, string][]) });

  return (
    <>
      <PageHeader
        title="Factures"
        action={
          <div className="flex flex-wrap gap-2">
            <form action={generateMonthlyInvoices}>
              <button
                disabled={missing === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-default disabled:text-muted disabled:hover:bg-white"
              >
                <FilePlus2 size={16} />
                {missing > 0 ? `Générer les factures manquantes (${missing})` : "Toutes les factures sont générées"}
              </button>
            </form>
            <a href={`/api/reports?${exportQs}`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
              <Download size={16} /> Exporter
            </a>
          </div>
        }
      />

      <Card>
        <AutoForm className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <label className="min-w-48 flex-1 text-xs font-medium text-muted">
            Élève
            <input name="q" defaultValue={q} placeholder="Nom de l'élève" className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-medium text-muted">
            Matière
            <select name="specialtyId" defaultValue={specialtyId ?? ""} className={`${selectCls} mt-1 block`}>
              <option value="">Toutes</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Statut
            <select name="status" defaultValue={status ?? ""} className={`${selectCls} mt-1 block`}>
              <option value="">Tous</option>
              <option value="PAID">Payé</option>
              <option value="PARTIAL">Partiel</option>
              <option value="UNPAID">Non payé</option>
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Mode de paiement
            <select name="method" defaultValue={method ?? ""} className={`${selectCls} mt-1 block`}>
              <option value="">Tous</option>
              <option value="CASH">Cash</option>
              <option value="TRANSFER">Virement</option>
            </select>
          </label>
          <button className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Filtrer</button>
        </AutoForm>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50/70">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Élève</th>
                <th className={th}>Matières</th>
                <th className={th}>Statut</th>
                <th className={th}>Montant</th>
                <th className={th}>Mode</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageRows.map(({ invoice: f, t, status: st, last, date }) => {
                const meta = statusMeta[st];
                const name = `${f.student.firstName} ${f.student.lastName}`;
                return (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className={`${td} whitespace-nowrap`}>{formatDate(date)}</td>
                    <td className={td}>
                      <span className="flex items-center gap-2.5 font-medium">
                        <Avatar name={name} photo={f.student.photo} size={28} />
                        {name}
                      </span>
                    </td>
                    <td className={`${td} max-w-56 truncate`}>{f.lines.map((l) => l.label).join(", ")}</td>
                    <td className={td}>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap font-medium`}>
                      {t.paid > 0 ? formatDH(t.paid) : <span className="text-muted">{formatDH(t.due)}</span>}
                      {st === "PARTIAL" && <span className="ml-1 text-xs font-normal text-muted">/ {formatDH(t.due)}</span>}
                    </td>
                    <td className={td}>{last ? (last.method === "CASH" ? "Cash" : "Virement") : "—"}</td>
                    <td className={td}>
                      <div className="flex justify-end gap-1.5">
                        {last && (
                          <a href={`/api/receipts/${last.id}`} target="_blank" rel="noreferrer" aria-label="Reçu PDF" title="Reçu PDF" className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                            <FileText size={15} />
                          </a>
                        )}
                        <Link href={`/admin/invoices/${f.id}`} aria-label={t.remaining > 0 ? "Encaisser" : "Détails"} title={t.remaining > 0 ? "Encaisser" : "Détails"} className="rounded-md bg-brand-50 p-1.5 text-brand-600 hover:bg-brand-100">
                          <Eye size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    Aucune facture trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/invoices" params={{ q, specialtyId, method, status }} noun="lignes" />
      </Card>
    </>
  );
}
