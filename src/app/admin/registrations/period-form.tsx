"use client";

import { useActionState } from "react";
import { CalendarDays } from "lucide-react";
import { btnPrimary, Field, inputCls } from "@/components/ui";
import { savePeriod, type PeriodState } from "./actions";

export function PeriodForm({ start, end }: { start: string; end: string }) {
  const [state, action, pending] = useActionState<PeriodState, FormData>(savePeriod, {});
  const e = (k: string) => state.errors?.[k]?.[0];

  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <Field label="Date de début" error={e("startDate")} className="w-48">
        <span className="relative block">
          <input name="startDate" type="date" defaultValue={start} required className={inputCls} />
        </span>
      </Field>
      <Field label="Date de fin" error={e("endDate")} className="w-48">
        <input name="endDate" type="date" defaultValue={end} required className={inputCls} />
      </Field>
      <button disabled={pending} className={btnPrimary}>
        <CalendarDays size={16} /> {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {state.ok && <p className="pb-2 text-sm text-emerald-600">Période enregistrée.</p>}
    </form>
  );
}
