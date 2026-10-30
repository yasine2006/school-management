"use client";

import Link from "next/link";
import { useActionState } from "react";
import { btnGhost, btnPrimary, Field, inputCls } from "@/components/ui";
import { formatDH } from "@/lib/format";
import { recordPayment, type PayState } from "../actions";

export function PayForm({
  invoiceId,
  remaining,
  lineId,
  lineLabel,
}: {
  invoiceId: number;
  remaining: number;
  lineId?: number;
  lineLabel?: string;
}) {
  const [state, action, pending] = useActionState<PayState, FormData>(recordPayment.bind(null, invoiceId), {});

  return (
    <form action={action} className="space-y-4">
      {lineId && <input type="hidden" name="lineId" value={lineId} />}
      {lineLabel && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          Matière : <b>{lineLabel}</b> — reste <b>{formatDH(remaining)}</b>
        </p>
      )}
      {state.message && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.message}</p>}
      <Field label={`Montant (DH)${lineLabel ? ` — ${lineLabel}` : ""}`} error={state.errors?.amount?.[0]}>
        <input name="amount" type="number" step="0.01" min="0.01" max={remaining} defaultValue={remaining} className={inputCls} />
      </Field>
      <Field label="Mode de paiement">
        <select name="method" className={inputCls}>
          <option value="CASH">Cash</option>
          <option value="TRANSFER">Virement</option>
        </select>
      </Field>
      <Field label="Référence (optionnel)">
        <input name="reference" placeholder="N° de virement, remarque…" className={inputCls} />
      </Field>
      <div className="flex gap-3">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Enregistrement…" : lineLabel ? "Enregistrer pour cette matière" : "Enregistrer le paiement"}
        </button>
        <Link href="/admin/invoices" className={btnGhost}>
          Annuler
        </Link>
      </div>
    </form>
  );
}
