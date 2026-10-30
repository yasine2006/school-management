"use client";

import { useActionState } from "react";
import { btnPrimary, Field, inputCls } from "@/components/ui";
import { changePassword, updateSchool, type SettingsState } from "./actions";

export function SchoolForm({ school }: { school: { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null } }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSchool, {});
  const e = (k: string) => state.errors?.[k]?.[0];

  return (
    <form action={action} className="max-w-xl space-y-4">
      <Field label="Nom du centre" error={e("name")}>
        <input name="name" defaultValue={school.name} className={inputCls} />
      </Field>
      <Field label="Adresse">
        <input name="address" defaultValue={school.address ?? ""} className={inputCls} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone">
          <input name="phone" defaultValue={school.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Email" error={e("email")}>
          <input name="email" type="email" defaultValue={school.email ?? ""} className={inputCls} />
        </Field>
      </div>

      <Field label="Logo (PNG ou JPG, 400 Ko max — utilisé sur les reçus PDF)" error={e("logo")}>
        <div className="flex items-center gap-4">
          {school.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo} alt="Logo actuel" className="h-14 w-14 rounded-lg border border-line object-contain p-1" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">Aucun</span>
          )}
          <input name="logo" type="file" accept="image/png,image/jpeg" className="text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-50" />
        </div>
      </Field>
      {school.logo && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="removeLogo" className="accent-brand-600" /> Supprimer le logo actuel
        </label>
      )}

      <button disabled={pending} className={btnPrimary}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(changePassword, {});
  const e = (k: string) => state.errors?.[k]?.[0];

  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label="Mot de passe actuel" error={e("current")}>
        <input name="current" type="password" autoComplete="current-password" className={inputCls} />
      </Field>
      <Field label="Nouveau mot de passe" error={e("next")}>
        <input name="next" type="password" autoComplete="new-password" className={inputCls} />
      </Field>
      <Field label="Confirmer le mot de passe" error={e("confirm")}>
        <input name="confirm" type="password" autoComplete="new-password" className={inputCls} />
      </Field>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
