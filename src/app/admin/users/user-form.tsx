"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { btnPrimary, Card, Field, inputCls } from "@/components/ui";
import { createUser, type UserFormState } from "./actions";

export function UserForm() {
  const [state, action, pending] = useActionState<UserFormState, FormData>(createUser, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = (k: string) => state.errors?.[k]?.[0];

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Nouvel utilisateur</h2>
      <form ref={ref} action={action} className="space-y-4">
        <Field label="Nom complet" error={e("name")}>
          <input name="name" className={inputCls} />
        </Field>
        <Field label="Email" error={e("email")}>
          <input name="email" type="email" className={inputCls} />
        </Field>
        <Field label="Téléphone">
          <input name="phone" className={inputCls} />
        </Field>
        <Field label="Rôle" hint="Les comptes élèves se créent depuis la fiche de l'élève.">
          <select name="role" defaultValue="TEACHER" className={inputCls}>
            <option value="TEACHER">Enseignant</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </Field>
        <Field label="Mot de passe provisoire" error={e("password")}>
          <input name="password" type="text" autoComplete="off" className={inputCls} />
        </Field>
        {state.ok && <p className="text-sm text-emerald-600">Utilisateur créé.</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          <UserPlus size={16} /> {pending ? "Création…" : "Créer le compte"}
        </button>
      </form>
    </Card>
  );
}
