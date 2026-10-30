import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Wallet } from "lucide-react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { invoiceStatus, invoiceTotals, statusMeta } from "@/lib/fees";
import { formatDate, formatDH, formatMonth } from "@/lib/format";
import { Avatar, Badge, Card, PageHeader, td, th } from "@/components/ui";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Encaisser un paiement" };

const dec = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v.toString());

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const invoiceId = Number((await params).invoiceId);
  if (!Number.isInteger(invoiceId)) notFound();
  const lineParam = Number((await searchParams).line) || null;

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, student: { schoolId } },
    include: { lines: true, payments: { orderBy: { paidAt: "desc" }, include: { line: true } }, student: true },
  });
  if (!invoice) notFound();

  const t = invoiceTotals(invoice);
  const meta = statusMeta[invoiceStatus(invoice)];
  const name = `${invoice.student.firstName} ${invoice.student.lastName}`;

  const attributed = new Map<number, Prisma.Decimal>();
  let free = new Prisma.Decimal(0);
  for (const p of invoice.payments) {
    if (p.lineId === null) free = free.plus(dec(p.amount));
    else attributed.set(p.lineId, (attributed.get(p.lineId) ?? new Prisma.Decimal(0)).plus(dec(p.amount)));
  }

  const rows = invoice.lines.map((line) => {
    const due = dec(line.amount);
    const paid = attributed.get(line.id) ?? new Prisma.Decimal(0);
    const remaining = due.minus(paid);
    return { line, due: due.toNumber(), paid: paid.toNumber(), remaining: remaining.greaterThan(0) ? remaining.toNumber() : 0 };
  });

  const selected = lineParam ? rows.find((r) => r.line.id === lineParam) : null;
  const formRemaining = selected ? selected.remaining : t.remaining;

  return (
    <>
      <Link href="/admin/invoices" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Retour aux factures
      </Link>
      <PageHeader title="Facture mensuelle" subtitle={<span className="capitalize">{formatMonth(invoice.month)}</span>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={name} photo={invoice.student.photo} size={44} />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/students/${invoice.studentId}`} className="font-semibold hover:text-brand-600">
                  {name}
                </Link>
                <p className="text-sm text-muted">{invoice.lines.length} matière(s)</p>
              </div>
              <Badge tone={meta.tone}>{meta.label}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["Dû", t.due],
                ["Payé", t.paid],
                ["Reste", t.remaining],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-1 font-semibold">{formatDH(v as number)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="p-5 pb-3 font-semibold">Matières de la facture</h2>
            <p className="px-5 pb-3 text-sm text-muted">
              Chaque matière peut être encaissée séparément grâce au bouton <b>Encaisser</b>.
            </p>
            <table className="w-full">
              <thead className="border-y border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Matière / Groupe</th>
                  <th className={`${th} text-right`}>Dû</th>
                  <th className={`${th} text-right`}>Payé</th>
                  <th className={`${th} text-right`}>Reste</th>
                  <th className={`${th} text-right`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ line, due, paid, remaining }) => (
                  <tr key={line.id} className={selected?.line.id === line.id ? "bg-brand-50" : undefined}>
                    <td className={td}>{line.label}</td>
                    <td className={`${td} text-right`}>{formatDH(due)}</td>
                    <td className={`${td} text-right`}>{formatDH(paid)}</td>
                    <td className={`${td} text-right font-medium`}>{formatDH(remaining)}</td>
                    <td className={`${td} text-right`}>
                      {remaining > 0 ? (
                        <Link href={`/admin/invoices/${invoice.id}?line=${line.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                          Encaisser
                        </Link>
                      ) : (
                        <Badge tone="green">Réglé</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td className={`${td} font-semibold`}>Total</td>
                  <td className={`${td} text-right font-semibold`}>{formatDH(t.due)}</td>
                  <td className={`${td} text-right font-semibold`}>{formatDH(t.paid)}</td>
                  <td className={`${td} text-right font-semibold`}>{formatDH(t.remaining)}</td>
                  <td className={td} />
                </tr>
              </tbody>
            </table>
            {free.greaterThan(0) && (
              <p className="border-t border-line px-5 py-3 text-sm text-muted">
                Dont {formatDH(free.toNumber())} en versements libres (sans matière attribuée).
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Versements</h2>
            <ul className="divide-y divide-line text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span>
                    {formatDate(p.paidAt)} · {p.method === "CASH" ? "Cash" : "Virement"}
                    {p.line && <span className="font-medium"> · {p.line.label}</span>}
                    {p.reference && <span className="text-muted"> · {p.reference}</span>}
                  </span>
                  <span className="flex items-center gap-3 font-medium">
                    {formatDH(Number(p.amount.toString()))}
                    <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer" aria-label="Reçu PDF" title="Reçu PDF" className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                      <FileText size={14} />
                    </a>
                  </span>
                </li>
              ))}
              {!invoice.payments.length && <li className="py-4 text-center text-muted">Aucun versement.</li>}
            </ul>
          </Card>
        </div>

        <Card className="h-fit p-6">
          <h2 className="mb-1 font-semibold">{selected ? "Encaisser une matière" : "Nouveau versement"}</h2>
          {selected && (
            <Link href={`/admin/invoices/${invoice.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline">
              <Wallet size={14} /> Encaisser la facture entière
            </Link>
          )}
          <div className={selected ? "" : "mt-3"}>
            {formRemaining > 0 ? (
              <PayForm
                invoiceId={invoiceId}
                remaining={formRemaining}
                lineId={selected?.line.id}
                lineLabel={selected?.line.label}
              />
            ) : (
              <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                {selected ? `La matière ${selected.line.label} est réglée.` : "Cette facture est entièrement payée."}
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
