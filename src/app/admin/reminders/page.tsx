import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCircle2, FileSpreadsheet, FileWarning, MessageCircle, Send } from "lucide-react";
import { requireRole } from "@/lib/session";
import { firstOfMonth, statusMeta } from "@/lib/fees";
import { monthKey, parseMonthKey } from "@/lib/invoicing";
import { reminderSummary } from "@/lib/reminders";
import { formatDate, formatDH, formatMonth } from "@/lib/format";
import { AutoForm } from "@/components/auto-form";
import { Avatar, Badge, btnGhost, btnPrimary, Card, PageHeader, selectCls, td, th } from "@/components/ui";
import { generateMonthlyInvoices } from "../invoices/actions";
import { remindAll, remindStudent } from "./actions";

export const metadata: Metadata = { title: "Relances & impayés" };

const fmtDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(d);

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; sent?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const sp = await searchParams;
  const month = parseMonthKey(sp.month ?? "") ?? firstOfMonth();
  const key = monthKey(month);
  const sent = Number(sp.sent ?? 0);
  const s = await reminderSummary(schoolId, month);

  const monthLast = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const unpaidExport = `/api/reports?type=invoices&format=xlsx&unpaid=1&from=${key}-01&to=${monthLast}`;

  const rows = [...s.rows].sort((a, b) => {
    const aPaid = a.status === "PAID" ? 1 : 0;
    const bPaid = b.status === "PAID" ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return b.remaining - a.remaining;
  });

  return (
    <>
      <PageHeader
        title="Relances & impayés"
        subtitle={
          <>
            Suivi des paiements de <b className="capitalize text-ink">{formatMonth(month)}</b> — {s.upToDate} élève(s) à jour, {s.late} en retard.
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AutoForm>
              <input type="month" name="month" defaultValue={key} className={selectCls} aria-label="Mois" />
            </AutoForm>
            {s.sendable > 0 && (
              <form action={remindAll.bind(null, key)}>
                <button className={btnPrimary}>
                  <BellRing size={15} /> Relancer les retardataires ({s.sendable})
                </button>
              </form>
            )}
            {s.missing > 0 && (
              <form action={generateMonthlyInvoices}>
                <button className={btnGhost}>
                  <FileWarning size={15} /> Factures manquantes ({s.missing})
                </button>
              </form>
            )}
            <a href={unpaidExport} className={btnGhost}>
              <FileSpreadsheet size={15} /> Impayés Excel
            </a>
          </div>
        }
      />

      {sent > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {sent} rappel(s) envoyé(s) en notification.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Encaissé ce mois", value: formatDH(s.paid), hint: `sur ${formatDH(s.due)}`, tone: "text-emerald-600" },
          { label: "Reste à encaisser", value: formatDH(s.remaining), hint: `${s.rows.filter((r) => r.remaining > 0).length} élève(s)`, tone: "text-rose-600" },
          { label: "À jour", value: String(s.upToDate), hint: "factures soldées", tone: "text-emerald-600" },
          { label: "En retard", value: String(s.late), hint: `dont ${s.missing} sans facture`, tone: "text-amber-600" },
        ].map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
            <p className="text-xs text-muted">{c.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50/70">
              <tr>
                <th className={th}>Élève</th>
                <th className={th}>Statut</th>
                <th className={`${th} text-right`}>Dû</th>
                <th className={`${th} text-right`}>Reste</th>
                <th className={th}>Retard</th>
                <th className={th}>Dernier rappel</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const meta = r.status === "MISSING" ? null : statusMeta[r.status];
                const full = `${r.firstName} ${r.lastName}`;
                return (
                  <tr key={r.studentId} className="transition hover:bg-slate-50/60">
                    <td className={td}>
                      <span className="flex items-center gap-2.5 font-medium">
                        <Avatar name={full} size={30} />
                        <span>
                          <Link href={`/admin/students/${r.studentId}`} className="hover:text-brand-600">
                            {full}
                          </Link>
                          <span className="block text-xs font-normal text-muted">
                            {r.parentName ?? "—"}
                            {r.phone ? ` · ${r.phone}` : ""}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={td}>
                      {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="gray">Sans facture</Badge>}
                    </td>
                    <td className={`${td} text-right`}>{formatDH(r.due)}</td>
                    <td className={`${td} text-right font-medium`}>{r.remaining > 0 ? formatDH(r.remaining) : "—"}</td>
                    <td className={td}>
                      {r.remaining > 0 ? (
                        r.daysLate > 0 ? (
                          <span className="text-xs font-medium text-rose-600">{r.daysLate} j</span>
                        ) : (
                          <span className="text-xs text-muted">À échéance</span>
                        )
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className={td}>
                      {r.remindedToday ? (
                        <span className="text-xs font-medium text-emerald-600">Aujourd&apos;hui</span>
                      ) : r.remindedAt ? (
                        <span className="text-xs text-muted">{formatDate(r.remindedAt)}</span>
                      ) : (
                        <span className="text-xs text-muted">Jamais</span>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-2">
                        {r.status === "MISSING" ? (
                          <Link href={`/admin/students/${r.studentId}`} className="text-xs font-medium text-brand-600 hover:underline">
                            Voir la fiche
                          </Link>
                        ) : (
                          <>
                            {r.remaining > 0 && r.userId && (
                              <form action={remindStudent.bind(null, r.studentId, key)}>
                                <button
                                  disabled={r.remindedToday}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                                  title={r.remindedToday ? "Déjà relancé aujourd'hui" : "Envoyer une notification"}
                                >
                                  <Send size={13} /> {r.remindedToday ? "Relancé" : "Notifier"}
                                </button>
                              </form>
                            )}
                            {r.remaining > 0 && !r.userId && (
                              <span className="text-xs text-muted" title="Aucun compte de connexion pour cet élève">
                                Pas de compte
                              </span>
                            )}
                            {r.waHref && r.remaining > 0 && (
                              <a
                                href={r.waHref}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                                title={`WhatsApp ${r.parentName ?? ""}`}
                              >
                                <MessageCircle size={13} /> WhatsApp
                              </a>
                            )}
                            {r.invoiceId && (
                              <Link
                                href={`/admin/invoices/${r.invoiceId}`}
                                className="text-xs font-medium text-brand-600 hover:underline"
                              >
                                Encaisser
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    Aucun élève actif pour {formatMonth(month)}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-xs text-muted">
        Les rappels partent en <b>notification in-app</b> (élèves avec compte) et en <b>WhatsApp</b> au parent, une seule fois par
        jour et par facture. Échéance : le <b>5</b> de chaque mois. Le cron <code>POST /api/cron/payment-reminders</code> relance
        automatiquement les retards ({fmtDay(month)}).
      </p>
    </>
  );
}
