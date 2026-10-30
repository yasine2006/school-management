"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { btnPrimary, Field, selectCls } from "@/components/ui";
import { createEnrollment, type EnrollFormState } from "../../enrollments/actions";

export function GroupEnrollForm({ groupId, students }: { groupId: number; students: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<EnrollFormState, FormData>(createEnrollment, {});
  const ref = useRef<HTMLFormElement>(null);
  const error = state.errors?.studentId?.[0] ?? state.errors?.groupId?.[0];

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <Field label="Inscrire un élève" error={error}>
        <select name="studentId" defaultValue="" className={selectCls}>
          <option value="">— Choisir un élève —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <button disabled={pending || !students.length} className={`${btnPrimary} w-full`}>
        <UserPlus size={15} /> {pending ? "Ajout…" : "Inscrire dans ce groupe"}
      </button>
      {state.ok && <p className="text-sm text-emerald-600">Élève inscrit.</p>}
      {!students.length && <p className="text-xs text-muted">Tous les élèves sont déjà inscrits dans ce groupe.</p>}
    </form>
  );
}
