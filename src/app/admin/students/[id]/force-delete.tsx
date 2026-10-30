"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { btnGhost } from "@/components/ui";
import { forceDeleteStudent } from "../actions";

export function ForceDeleteStudent({ studentId, fullName, maxDaysLate }: { studentId: number; fullName: string; maxDaysLate: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const res = await forceDeleteStudent(studentId, confirm);
    if (res?.ok === false) {
      setMsg(res.message);
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100">
        <Trash2 size={15} /> Supprimer définitivement
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 text-rose-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-900">Suppression irréversible</p>
          <p className="mt-1 text-sm text-rose-800">
            Impayé depuis <b>{maxDaysLate} jour(s)</b>. Cette action supprime l&apos;élève, ses inscriptions, factures, paiements, présences
            et son compte. <b>Les écritures de journal restent conservées.</b>
          </p>
          <form onSubmit={onSubmit} className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-rose-900">
                Tapez <b>{fullName.toUpperCase()}</b> pour confirmer
              </label>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" placeholder={fullName.toUpperCase()} />
            </div>
            {msg && <p className="text-xs text-rose-700">{msg}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60">
                <Trash2 size={15} /> {pending ? "Suppression…" : "Supprimer définitivement"}
              </button>
              <button type="button" onClick={() => { setOpen(false); setConfirm(""); setMsg(null); }} className={btnGhost}>Annuler</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

