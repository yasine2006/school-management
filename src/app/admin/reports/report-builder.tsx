"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  LoaderCircle,
  Percent,
  RefreshCw,
  Search,
} from "lucide-react";
import { formatDH } from "@/lib/format";
import { Card, selectCls } from "@/components/ui";

const COLS = [
  { key: "groups", label: "Matières / Niveaux" },
  { key: "phone", label: "Téléphone / Parent" },
  { key: "status", label: "Statut d'inscription" },
];

export type ReportSummary = {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  recoveryRate: number;
  totalCount: number;
  lateCount?: number;
  uniqueStudents?: number;
};

export type ReportPreview = {
  title: string;
  subtitle: string | null;
  head: string[];
  rows: (string | number)[][];
  total: number;
  money: number[];
  summary?: ReportSummary | null;
};

type GroupOption = {
  id: number;
  name: string;
  levelName: string;
  specialtyName: string;
};

export function ReportBuilder({
  type,
  withCols,
  firstCol,
  schoolName,
  todayInput,
  groups,
  initial,
}: {
  type: string;
  withCols: boolean;
  firstCol: string;
  schoolName: string;
  todayInput: string;
  groups: GroupOption[];
  initial: ReportPreview;
}) {
  const isUnpaid = type === "unpaid";
  const isInvoices = type === "invoices";

  // Filter States
  const [asOf, setAsOf] = useState(isUnpaid ? todayInput : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [months, setMonths] = useState("1"); // default: current month only (aligned with Relances)
  const [groupId, setGroupId] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [cols, setCols] = useState<Record<string, boolean>>({
    groups: true,
    phone: true,
    status: true,
  });

  const [preview, setPreview] = useState<ReportPreview>(initial);
  const [pending, setPending] = useState(false);
  const firstRun = useRef(true);

  const colsParam = COLS.filter((c) => cols[c.key]).map((c) => c.key).join(",");

  // Helper date presets
  const presetAsOf = (mode: "today" | "endOfMonth") => {
    const d = new Date();
    if (mode === "endOfMonth") {
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      setAsOf(lastDay.toISOString().slice(0, 10));
    } else {
      setAsOf(todayInput);
    }
  };

  const presetPeriod = (mode: "thisMonth" | "lastMonth" | "clear") => {
    if (mode === "clear") {
      setFrom("");
      setTo("");
      return;
    }
    const d = new Date();
    if (mode === "thisMonth") {
      const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      setFrom(f.toISOString().slice(0, 10));
      setTo(t.toISOString().slice(0, 10));
    } else if (mode === "lastMonth") {
      const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      setFrom(f.toISOString().slice(0, 10));
      setTo(t.toISOString().slice(0, 10));
    }
  };

  // Build query string
  const buildParams = useCallback(() => {
    const sp = new URLSearchParams({ type });
    if (isUnpaid) {
      if (asOf) sp.set("asOf", asOf);
      if (from) sp.set("from", from);
      if (months) sp.set("months", months);
    } else {
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
    }
    if (groupId) sp.set("groupId", groupId);
    if (isInvoices && status) sp.set("status", status);
    if (query.trim()) sp.set("q", query.trim());
    if (withCols) sp.set("cols", colsParam);
    return sp;
  }, [type, isUnpaid, asOf, from, months, to, groupId, isInvoices, status, query, withCols, colsParam]);

  const href = (format: "pdf" | "xlsx", extra?: Record<string, string>) => {
    const sp = buildParams();
    sp.set("format", format);
    for (const [k, v] of Object.entries(extra ?? {})) sp.set(k, v);
    return `/api/reports?${sp}`;
  };

  // Debounced preview sync
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const sp = buildParams();
    const ctrl = new AbortController();
    setPending(true);

    const timer = setTimeout(() => {
      fetch(`/api/reports/preview?${sp}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<ReportPreview>) : null))
        .then((data) => {
          if (data) setPreview(data);
        })
        .catch(() => {})
        .finally(() => {
          if (!ctrl.signal.aborted) setPending(false);
        });
    }, 280);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [buildParams]);

  const sum = preview.summary;

  return (
    <div className="space-y-6">
      {/* ── Summary KPI Cards (Clear Financial & Operational Intelligence) ── */}
      {sum && (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex items-center gap-4 p-4 border border-slate-200/80 bg-white shadow-xs">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-600">
              <DollarSign size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Total Facturé (Dû)
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-tight text-ink">
                {formatDH(sum.totalDue)}
              </p>
              <p className="text-[11px] text-muted">{sum.totalCount} facture(s) sur la période</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-4 border border-emerald-100 bg-white shadow-xs">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Total Déjà Payé (Encaissé)
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-tight text-emerald-600">
                {formatDH(sum.totalPaid)}
              </p>
              <p className="text-[11px] text-muted">Règlements reçus</p>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-4 border border-rose-200 bg-rose-50/40 shadow-xs">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                Total Impayé (Non Payé)
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-tight text-rose-700">
                {formatDH(sum.totalRemaining)}
              </p>
              <p className="text-[11px] text-rose-600/80">
                {sum.uniqueStudents ? `${sum.uniqueStudents} élève(s) avec reste à payer` : "Solde restant dû"}
              </p>
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-4 border border-slate-200/80 bg-white shadow-xs">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Percent size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Taux de Paiement
              </p>
              <p className="mt-0.5 text-xl font-bold tracking-tight text-ink">
                {sum.recoveryRate}% réglé
              </p>
              <p className="text-[11px] font-medium text-rose-600">
                {sum.lateCount ? `${sum.lateCount} échéance(s) en retard` : "Toutes les échéances à jour"}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Main Layout: Filters Panel & Live Preview Table ── */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Filter Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5 border border-line bg-white shadow-sm space-y-5 rounded-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Filter size={15} />
                </span>
                <h3 className="text-sm font-bold text-ink">Filtres du rapport</h3>
              </div>
              {(groupId || asOf !== todayInput || months !== "1" || from || to || status || query) && (
                <button
                  type="button"
                  onClick={() => {
                    setGroupId("");
                    setAsOf(isUnpaid ? todayInput : "");
                    setMonths("1");
                    setFrom("");
                    setTo("");
                    setStatus("");
                    setQuery("");
                  }}
                  className="text-xs font-medium text-brand-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Réinitialiser
                </button>
              )}
            </div>

            {/* 1. Filter by Group / Class */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-brand-600" />
                <span>Groupe / Classe</span>
              </label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className={`${selectCls} w-full text-sm font-medium`}
                aria-label="Filtrer par groupe"
              >
                <option value="">Tous les groupes (global)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} — {g.levelName} ({g.specialtyName})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Fast Search Input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                <Search size={13} className="text-brand-600" />
                <span>Recherche élève / contact</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nom, prénom, tél parent..."
                  className="w-full rounded-xl border border-line bg-slate-50/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand-500/15"
                />
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            {/* 3. Date & Window Filtering */}
            {isUnpaid ? (
              <div className="space-y-3.5 rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/80">
                {/* As of Date */}
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1 flex items-center gap-1.5">
                    <Calendar size={14} className="text-rose-600" />
                    <span>Arrêté à la date du (Date limite)</span>
                  </label>
                  <input
                    type="date"
                    value={asOf}
                    onChange={(e) => setAsOf(e.target.value)}
                    className={`${selectCls} w-full bg-white font-medium`}
                  />
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => presetAsOf("today")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        asOf === todayInput ? "bg-brand-600 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Aujourd&apos;hui
                    </button>
                    <button
                      type="button"
                      onClick={() => presetAsOf("endOfMonth")}
                      className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100"
                    >
                      Fin du mois
                    </button>
                  </div>
                </div>

                {/* Unpaid History Window — current month by default (aligned with Relances) */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Historique des impayés (Plage) :
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setMonths("1"); setFrom(""); }}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition text-left border ${
                        months === "1" && !from
                          ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Ce mois (par défaut)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMonths("2"); setFrom(""); }}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium transition text-left border ${
                        months === "2" && !from
                          ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      2 derniers mois
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMonths("3"); setFrom(""); }}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium transition text-left border ${
                        months === "3" && !from
                          ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      3 derniers mois
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMonths("all"); setFrom(""); }}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium transition text-left border ${
                        months === "all" && !from
                          ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Tout l&apos;historique
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                    {months === "1"
                      ? "Uniquement les impayés du mois sélectionné (comme la page Relances)."
                      : months === "2"
                        ? "Mois sélectionné + le mois d'avant uniquement."
                        : months === "3"
                          ? "Prend les 3 derniers mois jusqu'à la date sélectionnée."
                          : "Prend l'ensemble des mois sans limite d'historique."}
                  </p>
                </div>

                {/* Optional Custom Start Date */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-[11px] font-medium text-muted mb-1">
                    Date de début personnalisée (optionnel) :
                  </label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className={`${selectCls} w-full text-xs bg-white`}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-brand-600" />
                  <span>Période (Optionnel)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-muted mb-0.5 block">Du</span>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className={`${selectCls} w-full text-xs`}
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted mb-0.5 block">Au</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className={`${selectCls} w-full text-xs`}
                    />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => presetPeriod("thisMonth")}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    Ce mois
                  </button>
                  <button
                    type="button"
                    onClick={() => presetPeriod("lastMonth")}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    Mois dernier
                  </button>
                  {(from || to) && (
                    <button
                      type="button"
                      onClick={() => presetPeriod("clear")}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4. Invoice Status */}
            {isInvoices && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                  Statut de la facture
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`${selectCls} w-full text-sm font-medium`}
                >
                  <option value="">Tous les statuts</option>
                  <option value="UNPAID">Non payées (impayées)</option>
                  <option value="PARTIAL">Partiellement payées</option>
                  <option value="PAID">Payées intégralement</option>
                </select>
              </div>
            )}

            {/* 5. Column selection for Students tab */}
            {withCols && (
              <div className="rounded-xl bg-slate-50 p-3.5 border border-line">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  Colonnes à afficher
                </p>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center gap-2 text-muted font-medium">
                    <Check size={14} className="text-brand-600" /> {firstCol}
                  </li>
                  {COLS.map((c) => (
                    <li key={c.key}>
                      <label className="flex cursor-pointer items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={cols[c.key]}
                          onChange={(e) => setCols((s) => ({ ...s, [c.key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-line accent-brand-600"
                        />
                        {c.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 6. Export Buttons */}
            <div className="pt-2 border-t border-line space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Télécharger le rapport
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={href("pdf")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition"
                >
                  <FileText size={15} /> Exporter PDF
                </a>
                <a
                  href={href("xlsx")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  <FileSpreadsheet size={15} /> Exporter Excel
                </a>
              </div>

              {isInvoices && (
                <div className="mt-2 pt-2 border-t border-line">
                  <p className="mb-1 text-[11px] text-muted">Raccourci spécial :</p>
                  <a
                    href={href("xlsx", { unpaid: "1" })}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                  >
                    <AlertTriangle size={13} /> Exporter uniquement les impayés (Excel)
                  </a>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Live Data Preview & Smart Table (8 cols) */}
        <div className="lg:col-span-8">
          <Card className="p-5 border border-line bg-white shadow-sm rounded-2xl">
            {/* Header banner */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-white">
                    <BookOpen size={14} />
                  </span>
                  <h2 className="text-base font-bold text-ink">{preview.title}</h2>
                </div>
                {preview.subtitle && (
                  <p className="mt-1 text-xs text-muted">{preview.subtitle}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {pending && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full font-medium">
                    <LoaderCircle size={13} className="animate-spin" /> Calcul en direct…
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {preview.total} ligne(s)
                </span>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-hidden rounded-xl border border-line bg-slate-50/50">
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-navy-950 text-white">
                      {preview.head.map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2.5 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-white">
                    {preview.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`hover:bg-blue-50/40 transition-colors ${
                          rIdx % 2 === 1 ? "bg-slate-50/40" : ""
                        }`}
                      >
                        {row.map((val, cIdx) => {
                          const isMoney = preview.money.includes(cIdx);
                          const strVal = String(val);

                          // Check if cell is "Retard"
                          const isRetard =
                            preview.head[cIdx]?.toLowerCase().includes("retard") &&
                            strVal.includes("j") &&
                            !strVal.startsWith("0") &&
                            !strVal.includes("Non échu");

                          // Check if cell is "Statut"
                          const isStatus = preview.head[cIdx]?.toLowerCase().includes("statut");

                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-2.5 whitespace-nowrap ${
                                pending ? "opacity-60" : ""
                              } ${isMoney ? "font-mono font-semibold" : ""}`}
                            >
                              {isRetard ? (
                                <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-700">
                                  {strVal}
                                </span>
                              ) : isStatus ? (
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                    strVal.includes("Non payé") || strVal.includes("Inactif")
                                      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                      : strVal.includes("Partiel") || strVal.includes("En attente")
                                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  }`}
                                >
                                  {strVal}
                                </span>
                              ) : isMoney ? (
                                <span
                                  className={
                                    preview.head[cIdx]?.toLowerCase().includes("reste") &&
                                    Number(val) > 0
                                      ? "text-rose-600 font-bold"
                                      : preview.head[cIdx]?.toLowerCase().includes("payé")
                                        ? "text-emerald-600 font-medium"
                                        : "text-ink"
                                  }
                                >
                                  {formatDH(Number(val))}
                                </span>
                              ) : (
                                <span className="text-slate-800">{strVal}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {!preview.rows.length && (
                      <tr>
                        <td
                          colSpan={Math.max(preview.head.length, 1)}
                          className="px-4 py-8 text-center text-sm text-muted"
                        >
                          Aucun enregistrement ne correspond aux critères de recherche.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {preview.total > preview.rows.length && (
                <div className="border-t border-line bg-slate-50 px-4 py-2.5 text-center text-xs text-muted">
                  Aperçu des {preview.rows.length} premiers résultats sur {preview.total} au total. Le fichier PDF ou Excel complet contiendra l&apos;intégralité des données.
                </div>
              )}
            </div>

            {/* Bottom info */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
              <span>Établissement : {schoolName}</span>
              <span>Calcul en temps réel selon les inscriptions et règlements actifs</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
