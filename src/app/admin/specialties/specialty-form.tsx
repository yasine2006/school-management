"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { btnPrimary, Card, Field, inputCls } from "@/components/ui";
import { createSpecialty, type SpecialtyFormState } from "./actions";

export function SpecialtyForm() {
  const [state, action, pending] = useActionState<SpecialtyFormState, FormData>(createSpecialty, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = (k: string) => state.errors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Nouvelle matière</h2>
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Nom" error={e("name")}>
          <input name="name" placeholder="ex. Mathématiques" className={inputCls} />
        </Field>
        <Field label="Couleur" error={e("color")}>
          <input name="color" type="color" defaultValue="#2f6bff" className="h-10 w-20 cursor-pointer rounded-lg border border-line bg-white p-1" />
        </Field>
        {state.ok && <p className="text-sm text-emerald-600">Matière ajoutée.</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          <Plus size={16} /> {pending ? "Ajout…" : "Ajouter"}
        </button>
      </form>
    </Card>
  );
}
