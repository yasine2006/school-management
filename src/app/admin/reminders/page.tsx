import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileWarning,
  Filter,
  MessageCircle,
  Send,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/session";
import { firstOfMonth, statusMeta } from "@/lib/fees";
import { addMonths, monthKey, parseMonthKey } from "@/lib/invoicing";
import { reminderSummary } from "@/lib/reminders";
import { formatDate, formatDH, formatMonth } from "@/lib/format";
import { AutoForm } from "@/components/auto-form";
import { Avatar, Badge, btnGhost, btnPrimary, Card, PageHeader, selectCls, td, th } from "@/components/ui";
import { generateMonthlyInvoices } from "../invoices/actions";
import { remindAll, remindDueToday, remindStudent } from "./actions";

export const metadata: Metadata = { title: "Relances & impayés" };

const fmtDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(d);

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; sent?: string; filter?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const sp = await searchParams;
  const month = parseMonthKey(sp.month ?? "") ?? firstOfMonth();
  const key = monthKey(month);
  const previous = addMonths(month, -1);
  const sent = Number(sp.sent ?? 0);
  const [s, prev] = await Promise.all([
    reminderSummary(schoolId, month),
    reminderSummary(schoolId, previous),
  ]);

  const now = new Date();
  const isCurrentMonth = monthKey(month) === monthKey(now);
  const todayDay = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const dayLimit = isCurrentMonth ? todayDay : (month.getTime() < now.getTime() ? daysInMonth : 0);

  const overdue = (r: (typeof s.rows)[number]) =>
    r.invoiceId !== null && r.userId !== null && r.remaining > 0 && r.daysLate > 0;
  const relaunchable = s.rows.filter(overdue).length + prev.rows.filter(overdue).length;

  const currentFilter = sp.filter ?? "due_today";

  const monthLast = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const unpaidExport = `/api/reports?type=invoices&format=xlsx&unpaid=1&from=${key}-01&to=${monthLast}`;

  const allRowsSorted = [...s.rows].sort((a, b) => {
    const aPaid = a.status === "PAID" ? 1 : 0;
    const bPaid = b.status === "PAID" ? 1 : 0;
    if (aPaid !== bPaid) return aPaid - bPaid;
    return b.remaining - a.remaining;
  });

  const displayedRows = allRowsSorted.filter((r) => {
    if (currentFilter === "due_today") {
      return r.remaining > 0 && r.isDueAsOfToday;
    }
    if (currentFilter === "late") {
      return r.remaining > 0 && r.daysLate > 0;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Relances & impayés"
        subtitle={
          <>
            Suivi des paiements de <b className="capitalize text-ink">{formatMonth(month)}</b> — {s.upToDate} élève(s) à jour,{" "}
            <b className="text-amber-700">{s.dueAsOfTodayCount} échu(s) à ce jour (1 au {dayLimit})</b>.
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AutoForm>
              <input type="month" name="month" defaultValue={key} className={selectCls} aria-label="Mois" />
            </AutoForm>

            {s.dueAsOfTodaySendable > 0 && (
              <form action={remindDueToday.bind(null, key)}>
                <button
                  className={btnPrimary}
                  title={`Relancer uniquement les impayés du 1er au ${dayLimit} ${formatMonth(month)} (uniquement ce mois)`}
                >
                  <CalendarClock size={15} /> Relancer échéances du jour ({s.dueAsOfTodaySendable})
                </button>
              </form>
            )}

            {relaunchable > 0 && (
              <form action={remindAll.bind(null, key)}>
                <button className={btnGhost} title="Impayés du mois affiché et du mois précédent">
                  <BellRing size={15} /> Tous les retardataires ({relaunchable})
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
          {
            label: "Encaissé ce mois",
            value: formatDH(s.paid),
            hint: `sur ${formatDH(s.due)}`,
            tone: "text-emerald-600",
          },
          {
            label: `Échus à ce jour (1 au ${dayLimit})`,
            value: formatDH(s.dueAsOfTodayRemaining),
            hint: `${s.dueAsOfTodayCount} élève(s) redevable(s)`,
            tone: "text-amber-600",
          },
          {
            label: "Reste total du mois",
            value: formatDH(s.remaining),
            hint: `${s.rows.filter((r) => r.remaining > 0).length} élève(s)`,
            tone: "text-rose-600",
          },
          {
            label: "À jour",
            value: String(s.upToDate),
            hint: "factures soldées",
            tone: "text-emerald-600",
          },
        ].map((c) => (
          <Card key={c.label} className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
            <p className="text-xs text-muted">{c.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        {/* Barre de filtres dynamiques (updatable chaque jour) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/reminders?month=${key}&filter=due_today`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentFilter === "due_today"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-line bg-white text-slate-700 hover:bg-slate-100"
              }`}
              title="Élèves dont le cycle mensuel est échu au jour d'aujourd'hui dans ce mois"
            >
              <Clock size={14} />
              Échéances à ce jour (1 au {dayLimit})
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                  currentFilter === "due_today" ? "bg-white/20 text-white" : "bg-amber-100 font-bold text-amber-800"
                }`}
              >
                {s.dueAsOfTodayCount}
              </span>
            </Link>

            <Link
              href={`/admin/reminders?month=${key}&filter=all`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentFilter === "all"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-line bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Users size={14} />
              Tous les élèves
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                  currentFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {s.rows.length}
              </span>
            </Link>

            <Link
              href={`/admin/reminders?month=${key}&filter=late`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                currentFilter === "late"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-line bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Filter size={14} />
              En retard strict
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                  currentFilter === "late" ? "bg-white/20 text-white" : "bg-rose-100 font-bold text-rose-800"
                }`}
              >
                {s.late}
              </span>
            </Link>
          </div>

          <div className="text-xs text-muted">
            {currentFilter === "due_today" && (
              <span>
                Filtre actif : <b className="text-ink">impayés échus du 1er au {dayLimit} {formatMonth(month)}</b>
              </span>
            )}
            {currentFilter === "all" && <span>Affichage de tous les élèves</span>}
            {currentFilter === "late" && <span>Filtre actif : retardataires uniquement (&gt; 0 jour)</span>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50/70">
              <tr>
                <th className={th}>Élève</th>
                <th className={th}>Échéance mensuelle</th>
                <th className={th}>Statut</th>
                <th className={`${th} text-right`}>Dû</th>
                <th className={`${th} text-right`}>Reste</th>
                <th className={th}>Retard</th>
                <th className={th}>Dernier rappel</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {displayedRows.map((r) => {
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
                      {r.dueDate ? (
                        <div>
                          <span className="font-medium text-ink">{fmtDay(r.dueDate)}</span>
                          {r.enrollmentStart && (
                            <span className="block text-[11px] text-muted">
                              Inscrit le {fmtDay(r.enrollmentStart)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className={td}>
                      {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="gray">Sans facture</Badge>}
                    </td>
                    <td className={`${td} text-right`}>{formatDH(r.due)}</td>
                    <td className={`${td} text-right font-medium`}>{r.remaining > 0 ? formatDH(r.remaining) : "—"}</td>
                    <td className={td}>
                      {r.remaining > 0 ? (
                        r.daysLate > 0 ? (
                          <span className="text-xs font-semibold text-rose-600">{r.daysLate} j</span>
                        ) : r.isDueAsOfToday ? (
                          <span className="text-xs font-medium text-amber-600">Échéance aujourd&apos;hui</span>
                        ) : (
                          <span className="text-xs text-muted">Échéance le {r.dueDate ? fmtDay(r.dueDate) : "—"}</span>
                        )
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">Réglé</span>
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
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                                  title={r.remindedToday ? "Relancer à nouveau" : "Envoyer une notification"}
                                >
                                  <Send size={13} /> {r.remindedToday ? "Relancer" : "Notifier"}
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
              {!displayedRows.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                    {currentFilter === "due_today"
                      ? `Aucun élève en attente de paiement pour les échéances du 1er au ${dayLimit} ${formatMonth(month)}.`
                      : currentFilter === "late"
                        ? `Aucun élève en retard pour ${formatMonth(month)}.`
                        : `Aucun élève actif pour ${formatMonth(month)}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-xs text-muted">
        Les rappels partent en <b>notification in-app</b> (élèves avec compte) et en <b>lien WhatsApp</b> au parent. Le cycle mensuel
        est basé sur le jour d&apos;inscription de l&apos;élève (<b>fin de mois d&apos;inscription</b>). Le bouton « Relancer échéances du jour »
        cible <b>uniquement le mois affiché</b> pour les élèves dont l&apos;échéance est atteinte jusqu&apos;à aujourd&apos;hui (du 1er au {dayLimit}).
      </p>
    </>
  );
}
