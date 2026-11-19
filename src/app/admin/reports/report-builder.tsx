"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { formatDH } from "@/lib/format";
import { Card, selectCls } from "@/components/ui";

const COLS = [
  { key: "groups", label: "Matières / Niveaux" },
  { key: "phone", label: "Téléphone / Parent" },
  { key: "status", label: "Statut" },
];

export type ReportPreview = {
  title: string;
  subtitle: string | null;
  head: string[];
  rows: (string | number)[][];
  total: number;
  money: number[];
};

export function ReportBuilder({
  type,
  withCols,
  firstCol,
  schoolName,
  defaultSince,
  initial,
}: {
  type: string;
  withCols: boolean;
  firstCol: string;
  schoolName: string;
  defaultSince?: string;
  initial: ReportPreview;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [since, setSince] = useState(defaultSince ?? "");
  const [status, setStatus] = useState("");
  const [cols, setCols] = useState<Record<string, boolean>>({ groups: true, phone: true, status: true });
  const [preview, setPreview] = useState<ReportPreview>(initial);
  const [pending, setPending] = useState(false);
  const firstRun = useRef(true);

  const isInvoices = type === "invoices";
  const isUnpaid = type === "unpaid";
  const colsParam = COLS.filter((c) => cols[c.key]).map((c) => c.key).join(",");

  const todayInput = new Date().toISOString().slice(0, 10);
  const presetSince = (days: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    setSince(d.toISOString().slice(0, 10));
  };

  const buildParams = useCallback(() => {
    const sp = new URLSearchParams({ type });
    if (isUnpaid) {
      if (since) sp.set("since", since);
    } else {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    }
    if (isInvoices && status) sp.set("status", status);
    if (withCols) sp.set("cols", colsParam);
    return sp;
  }, [type, isUnpaid, since, from, to, isInvoices, status, withCols, colsParam]);

  const href = (format: "pdf" | "xlsx", extra?: Record<string, string>) => {
    const sp = buildParams();
    sp.set("format", format);
    for (const [k, v] of Object.entries(extra ?? {})) sp.set(k, v);
    return `/api/reports?${sp}`;
  };

  // keep the preview in sync with the period / columns / status picked below
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const sp = buildParams();

    const ctrl = new AbortController();
    setPending(true);
    const id = setTimeout(() => {
      fetch(`/api/reports/preview?${sp}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<ReportPreview>) : null))
        .then((data) => {
          if (data) setPreview(data);
        })
        .catch(() => {})
        .finally(() => {
          if (!ctrl.signal.aborted) setPending(false);
        });
    }, 250);

    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [buildParams]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-5 font-semibold">{preview.title}</h2>

        <div className="space-y-6">
          {isUnpaid ? (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Date de début</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={since}
                    max={todayInput}
                    onChange={(e) => setSince(e.target.value)}
                    aria-label="Depuis le"
                    className={selectCls}
                  />
                  <span className="text-xs text-muted">jusqu&apos;aujourd&apos;hui ({todayInput})</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted">Raccourcis :</span>
                  <button type="button" onClick={() => presetSince(0)} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
                    Aujourd&apos;hui
                  </button>
                  <button type="button" onClick={() => presetSince(30)} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
                    30 derniers jours
                  </button>
                  <button type="button" onClick={() => presetSince(90)} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
                    90 derniers jours
                  </button>
                  {defaultSince && (
                    <button type="button" onClick={() => setSince(defaultSince)} className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 hover:bg-slate-200">
                      1er du mois
                    </button>
                  )}
                  {since && (
                    <button type="button" onClick={() => setSince("")} className="font-medium text-brand-600 hover:underline">
                      Tout afficher
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100">
                <p className="text-sm font-semibold text-rose-700">Tous les impayés, avec toutes les dates</p>
                <p className="mt-0.5 text-xs leading-relaxed text-rose-600/80">
                  Liste des élèves dont la facture n&apos;est pas totalement réglée depuis la date choisie. Chaque ligne affiche : élève, téléphone, matières, début et fin du cycle, échéance, retard, montants, statut et date du dernier paiement. Rien n&apos;est masqué.
                </p>
              </div>
            </>
          ) : (
            <div>
              <p className="mb-2 text-sm font-medium">Période (optionnel)</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Du" className={selectCls} />
                <span className="text-muted">→</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Au" className={selectCls} />
                {(from || to) && (
                  <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-xs font-medium text-brand-600 hover:underline">
                    Effacer la période
                  </button>
                )}
              </div>
            </div>
          )}

          {isInvoices && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Statut des factures</p>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectCls} w-full`} aria-label="Statut des factures">
                  <option value="">Toutes les factures</option>
                  <option value="UNPAID">Non payées</option>
                  <option value="PARTIAL">Partiellement payées</option>
                  <option value="PAID">Payées</option>
                </select>
              </div>

              <div className="rounded-xl bg-rose-50 p-4 ring-1 ring-rose-100">
                <p className="text-sm font-semibold text-rose-700">Liste des impayés</p>
                <p className="mt-0.5 text-xs text-rose-600/80">Toutes les factures non totalement payées (non payées + partielles), sur la période choisie.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={href("xlsx", { unpaid: "1" })} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700">
                    <FileSpreadsheet size={14} /> Impayés — Excel
                  </a>
                  <a href={href("pdf", { unpaid: "1" })} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
                    <FileText size={14} /> Impayés — PDF
                  </a>
                </div>
              </div>
            </>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Format</p>
            <div className="flex gap-3">
              <a href={href("pdf")} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700">
                <FileText size={16} /> PDF
              </a>
              <a href={href("xlsx")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                <FileSpreadsheet size={16} /> Excel
              </a>
            </div>
          </div>

          {withCols && (
            <div>
              <p className="mb-2 text-sm font-medium">Informations incluses :</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-muted">
                  <Check size={16} className="text-brand-600" /> {firstCol}
                </li>
                {COLS.map((c) => (
                  <li key={c.key}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cols[c.key]}
                        onChange={(e) => setCols((s) => ({ ...s, [c.key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-line accent-brand-600"
                      />
                      {c.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Aperçu</h2>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <LoaderCircle size={13} className="animate-spin" /> Mise à jour…
            </span>
          )}
        </div>
        <div className="rounded-lg border border-line bg-slate-50 p-5" aria-busy={pending}>
          <div className="mx-auto w-full rounded-md bg-white p-5 shadow-sm ring-1 ring-line">
            <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-navy-900 text-white">
                <BookOpen size={14} />
              </span>
              <span className="text-sm font-semibold">{schoolName}</span>
            </div>
            <p className="mb-1 text-xs font-semibold">{preview.title}</p>
            {preview.subtitle && <p className="mb-2 text-[10px] text-muted">{preview.subtitle}</p>}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-[10px]">
                <thead>
                  <tr className="bg-navy-900 text-white">
                    {preview.head.map((h) => (
                      <th key={h} className="truncate px-1.5 py-1 text-left font-medium" title={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50" : ""}>
                      {r.map((v, j) => (
                        <td key={j} className={`truncate px-1.5 py-1 ${pending ? "opacity-50" : ""}`} title={String(v)}>
                          {preview.money.includes(j) ? formatDH(Number(v)) : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!preview.rows.length && (
                    <tr>
                      <td colSpan={Math.max(preview.head.length, 1)} className="px-1.5 py-3 text-center text-muted">
                        Aucune donnée pour ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-right text-[10px] text-muted">{preview.total} ligne(s) au total</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
