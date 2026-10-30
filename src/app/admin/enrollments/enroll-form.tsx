"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { btnPrimary, Card, Field, inputCls } from "@/components/ui";
import { createEnrollment, type EnrollFormState } from "./actions";

export function EnrollForm({
  students,
  groups,
}: {
  students: { id: number; name: string }[];
  groups: { id: number; name: string; fee: number; level: string }[];
}) {
  const [state, action, pending] = useActionState<EnrollFormState, FormData>(createEnrollment, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = (k: string) => state.errors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Nouvelle inscription</h2>
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Élève" error={e("studentId")}>
          <select name="studentId" defaultValue="" className={inputCls}>
            <option value="">Choisir…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Groupe (matière × niveau)" error={e("groupId")}>
          <select name="groupId" defaultValue="" className={inputCls}>
            <option value="">Choisir…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.fee} DH
              </option>
            ))}
          </select>
        </Field>
        {state.message && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.message}</p>}
        {state.ok && <p className="text-sm text-emerald-600">Élève inscrit.</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          <UserPlus size={16} /> {pending ? "Inscription…" : "Inscrire l'élève"}
        </button>
      </form>
    </Card>
  );
}
