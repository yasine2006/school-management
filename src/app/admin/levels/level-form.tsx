"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { btnPrimary, Card, Field, inputCls } from "@/components/ui";
import { createLevel, type LevelFormState } from "./actions";

export function LevelForm() {
  const [state, action, pending] = useActionState<LevelFormState, FormData>(createLevel, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = (k: string) => state.errors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Nouveau niveau</h2>
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Nom" error={e("name")}>
          <input name="name" placeholder="ex. Collège" className={inputCls} />
        </Field>
        <Field label="Ordre d'affichage" error={e("order")}>
          <input name="order" type="number" min="0" step="1" defaultValue={0} className={inputCls} />
        </Field>
        {state.ok && <p className="text-sm text-emerald-600">Niveau ajouté.</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          <Plus size={16} /> {pending ? "Ajout…" : "Ajouter"}
        </button>
      </form>
    </Card>
  );
}
