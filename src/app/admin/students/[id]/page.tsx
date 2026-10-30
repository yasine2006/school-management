import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, RotateCcw, UserMinus, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { invoiceStatus, invoiceTotals, firstOfMonth, statusMeta } from "@/lib/fees";
import { monthDue, monthKey, monthsBetween } from "@/lib/invoicing";
import { formatDate, formatDH, formatMonth } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { Avatar, Badge, btnGhost, btnPrimary, Card, td, th } from "@/components/ui";
import { ensureMonthlyInvoice, openInvoiceForMonth } from "../../invoices/actions";
import { reactivateEnrollment, stopEnrollment } from "../../enrollments/actions";

export const metadata: Metadata = { title: "Fiche élève" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const student = await db.student.findFirst({
    where: { id, schoolId },
    include: {
      enrollments: { include: { group: { include: { specialty: true, level: true, teacher: true } } }, orderBy: { status: "asc" } },
      invoices: { orderBy: { month: "desc" }, include: { lines: true, payments: { orderBy: { paidAt: "desc" } } } },
      attendance: { orderBy: { date: "desc" }, take: 30 },
      user: true,
    },
  });
  if (!student) notFound();

  const absences = student.attendance.filter((a) => a.status === "ABSENT").length;
  const lates = student.attendance.filter((a) => a.status === "LATE").length;
  const full = `${student.firstName} ${student.lastName}`;

  const info: [string, string][] = [
    ["Compte élève", student.user?.email ?? "Aucun compte"],
    ["Parent / tuteur", student.parentName ?? "—"],
    ["Téléphone", student.parentPhone ?? "—"],
    ["Email parent", student.parentEmail ?? "—"],
    ["Inscrit le", formatDate(student.registeredAt)],
    ["Statut", student.status === "ACTIVE" ? "Actif" : student.status === "PENDING" ? "En attente" : "Inactif"],
  ];

  const activeEnrollments = student.enrollments.filter((e) => e.status === "ACTIVE");
  const currentMonth = firstOfMonth();
  const invoiceByMonth = new Map(student.invoices.map((f) => [monthKey(f.month), f]));
  const earliest = activeEnrollments.reduce<Date | null>(
    (min, e) => (min === null || e.startedAt < min ? e.startedAt : min),
    null,
  );
  const monthMap = new Map<string, Date>();
  for (const m of monthsBetween(earliest ?? currentMonth, currentMonth)) monthMap.set(monthKey(m), m);
  for (const f of student.invoices) monthMap.set(monthKey(f.month), f.month);
  const monthRows = [...monthMap.entries()]
    .map(([key, month]) => ({
      key,
      month,
      invoice: invoiceByMonth.get(key) ?? null,
      due: monthDue(activeEnrollments, month).toNumber(),
    }))
    .filter((r) => r.invoice || r.due > 0)
    .sort((a, b) => b.month.getTime() - a.month.getTime());

  return (
    <>
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Retour aux élèves
      </Link>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar name={full} photo={student.photo} size={56} />
          <div>
            <h1 className="text-xl font-bold">{full}</h1>
            <p className="text-sm text-muted">{student.enrollments.length} matière(s)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={ensureMonthlyInvoice.bind(null, id)}>
            <button className={btnPrimary}>
              <Wallet size={15} /> Encaisser le mois
            </button>
          </form>
          <Link href={`/admin/students/${id}/edit`} className={btnGhost}>
            <Pencil size={15} /> Modifier
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Informations</h2>
          <dl className="divide-y divide-line text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-muted">
            30 derniers jours de présence : <b className="text-ink">{absences}</b> absence(s), <b className="text-ink">{lates}</b> retard(s).
          </p>
        </Card>

        <Card className="overflow-hidden">
          <h2 className="p-5 pb-3 font-semibold">Matières</h2>
          <ul className="divide-y divide-line text-sm">
            {student.enrollments.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: e.group.specialty.color ?? "#94a3b8" }} />
                    {e.group.specialty.name}
                  </p>
                  <p className="text-xs text-muted">
                    {e.group.level.name} · {e.group.teacher?.name ?? "Sans enseignant"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatDH(Number(e.monthlyFee.toString()))}</p>
                  <Badge tone={e.status === "ACTIVE" ? "green" : "gray"}>{e.status === "ACTIVE" ? "Active" : "Arrêtée"}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {e.status === "ACTIVE" ? (
                    <form action={stopEnrollment.bind(null, e.id)}>
                      <ConfirmButton
                        label="Retirer cette matière ?"
                        message={`Retirer ${e.group.specialty.name} ? L'élève ne sera plus facturé et sera retiré du groupe.`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <UserMinus size={14} />
                      </ConfirmButton>
                    </form>
                  ) : (
                    <form action={reactivateEnrollment.bind(null, e.id)}>
                      <button className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Réactiver la matière">
                        <RotateCcw size={14} />
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
            {!student.enrollments.length && <li className="px-5 py-6 text-center text-muted">Aucune matière.</li>}
          </ul>
          <div className="border-t border-line p-3 text-center">
            <Link href={`/admin/enrollments?studentId=${id}`} className="text-sm font-medium text-brand-600 hover:underline">
              Gérer les inscriptions
            </Link>
          </div>
        </Card>

        <Card className="overflow-hidden lg:col-span-3">
          <h2 className="p-5 pb-3 font-semibold">Factures</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-y border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Mois</th>
                  <th className={th}>Matières</th>
                  <th className={th}>Dû</th>
                  <th className={th}>Payé</th>
                  <th className={th}>Statut</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {monthRows.map(({ key, month, invoice, due }) => {
                  const t = invoice ? invoiceTotals(invoice) : null;
                  const meta = invoice ? statusMeta[invoiceStatus(invoice)] : null;
                  const labels = (invoice?.lines.map((l) => l.label) ?? activeEnrollments.map((e) => e.group.name)).join(", ");
                  return (
                    <tr key={key}>
                      <td className={`${td} whitespace-nowrap capitalize`}>{formatMonth(month)}</td>
                      <td className={`${td} max-w-56 truncate`}>{labels}</td>
                      <td className={td}>{formatDH(t ? t.due : due)}</td>
                      <td className={td}>{t ? formatDH(t.paid) : "—"}</td>
                      <td className={td}>
                        {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="amber">À encaisser</Badge>}
                      </td>
                      <td className={`${td} text-right`}>
                        {invoice ? (
                          <Link
                            href={`/admin/invoices/${invoice.id}`}
                            className={`text-sm font-medium hover:underline ${t && t.remaining > 0 ? "text-brand-600" : "text-muted"}`}
                          >
                            {t && t.remaining > 0 ? "Encaisser" : "Voir"}
                          </Link>
                        ) : (
                          <form action={openInvoiceForMonth.bind(null, id, key)}>
                            <button className="text-sm font-medium text-brand-600 hover:underline">Encaisser</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!monthRows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                      Aucune facture.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
