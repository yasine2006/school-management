"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { btnPrimary, Card, Field, inputCls } from "@/components/ui";
import { createGroup, type GroupFormState } from "./actions";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

export function GroupForm({
  specialties,
  levels,
  teachers,
}: {
  specialties: { id: number; name: string }[];
  levels: { id: number; name: string }[];
  teachers: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<GroupFormState, FormData>(createGroup, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = (k: string) => state.errors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Nouveau groupe</h2>
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Nom du groupe" error={e("name")}>
          <input name="name" placeholder="ex. Maths · Collège" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Matière">
            <select name="specialtyId" defaultValue={specialties[0]?.id ?? ""} className={inputCls}>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Niveau">
            <select name="levelId" defaultValue={levels[0]?.id ?? ""} className={inputCls}>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Enseignant">
          <select name="teacherId" defaultValue="" className={inputCls}>
            <option value="">— Aucun —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select name="kind" defaultValue="REGULAR" className={inputCls}>
              <option value="REGULAR">Soutien</option>
              <option value="CONCOURS">Concours</option>
            </select>
          </Field>
          <Field label="Mensualité (DH)" error={e("monthlyFee")}>
            <input name="monthlyFee" type="number" min="1" step="1" placeholder="450" className={inputCls} />
          </Field>
        </div>
        <Field label="Capacité (optionnel)">
          <input name="capacity" type="number" min="1" step="1" placeholder="18" className={inputCls} />
        </Field>

        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm font-medium">Créneaux hebdomadaires (optionnel)</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
              <select name={`day_${i}`} defaultValue={i === 0 ? 1 : ""} className={inputCls} aria-label="Jour">
                <option value="">— Jour —</option>
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input name={`start_${i}`} type="time" className={inputCls} aria-label="Début" />
              <input name={`end_${i}`} type="time" className={inputCls} aria-label="Fin" />
            </div>
          ))}
        </div>

        {state.ok && <p className="text-sm text-emerald-600">Groupe créé.</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          <Plus size={16} /> {pending ? "Création…" : "Créer le groupe"}
        </button>
      </form>
    </Card>
  );
}
