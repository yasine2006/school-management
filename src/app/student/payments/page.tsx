import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { invoiceStatus, invoiceTotals, statusMeta } from "@/lib/fees";
import { formatDH, formatMonth } from "@/lib/format";
import { Avatar, Badge } from "@/components/ui";
import { requireStudent } from "../queries";

export const metadata: Metadata = { title: "Mes factures" };

export default async function StudentPayments() {
  const session = await requireRole("STUDENT");
  const me = await requireStudent(session);

  const student = await db.student.findUniqueOrThrow({
    where: { id: me.id },
    include: {
      invoices: { orderBy: { month: "desc" }, include: { lines: true, payments: { orderBy: { paidAt: "desc" } } } },
    },
  });

  const name = `${student.firstName} ${student.lastName}`;
  const due = student.invoices.reduce((s, f) => s + invoiceTotals(f).remaining, 0);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={name} photo={student.photo} size={40} />
        <div className="leading-tight">
          <h1 className="text-base font-bold">Mes factures</h1>
          <p className="text-sm text-muted">Suivi des paiements</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm text-muted">Reste à payer</p>
          <p className={`text-2xl font-bold ${due > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatDH(due)}</p>
        </div>

        <ul className="space-y-2.5">
          {student.invoices.map((f) => {
            const t = invoiceTotals(f);
            const meta = statusMeta[invoiceStatus(f)];
            const last = f.payments[0];
            return (
              <li key={f.id} className="rounded-xl border border-line p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{formatMonth(f.month)}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{f.lines.map((l) => l.label).join(", ")}</p>
                <div className="mt-1.5 flex items-center justify-between text-sm text-muted">
                  <span>
                    {formatDH(t.paid)} / {formatDH(t.due)}
                  </span>
                  {last && (
                    <a href={`/api/receipts/${last.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600">
                      <FileText size={14} /> Reçu
                    </a>
                  )}
                </div>
              </li>
            );
          })}
          {!student.invoices.length && <li className="rounded-xl bg-slate-50 p-5 text-center text-sm text-muted">Aucune facture.</li>}
        </ul>
      </div>
    </>
  );
}
