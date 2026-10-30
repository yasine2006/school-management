"use client";

import Link from "next/link";
import { useActionState } from "react";
import { btnGhost, btnPrimary, Card, Field, inputCls } from "@/components/ui";
import type { StudentFormState } from "./actions";

type Props = {
  action: (state: StudentFormState, formData: FormData) => Promise<StudentFormState>;
  backHref?: string;
  hasAccount?: boolean;
  defaults?: {
    firstName?: string;
    lastName?: string;
    status?: string;
    photo?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
    accountEmail?: string | null;
  };
  submitLabel: string;
};

export function StudentForm({ action, backHref = "/admin/students", hasAccount = false, defaults = {}, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<StudentFormState, FormData>(action, {});
  const e = (k: string) => state.errors?.[k]?.[0];

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.message && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.message}</p>}

      <Card className="p-6">
        <h2 className="mb-4 font-semibold">Élève</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" error={e("firstName")}>
            <input name="firstName" defaultValue={defaults.firstName} className={inputCls} />
          </Field>
          <Field label="Nom" error={e("lastName")}>
            <input name="lastName" defaultValue={defaults.lastName} className={inputCls} />
          </Field>
          <Field label="Statut">
            <select name="status" defaultValue={defaults.status ?? "ACTIVE"} className={inputCls}>
              <option value="ACTIVE">Actif</option>
              <option value="PENDING">En attente</option>
              <option value="INACTIVE">Inactif</option>
            </select>
          </Field>
          <Field label="Photo (URL, optionnel)" error={e("photo")}>
            <input name="photo" defaultValue={defaults.photo ?? ""} placeholder="https://…" className={inputCls} />
          </Field>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-muted">
          Les matières (inscriptions) se gèrent depuis la page <b className="text-ink">Inscriptions</b>.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 font-semibold">Compte élève</h2>
        <p className="mb-4 text-xs text-muted">
          Donne à l&apos;élève un accès en lecture seule à ses présences, cours, horaires et factures.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email de connexion" error={e("accountEmail")}>
            <input name="accountEmail" type="email" defaultValue={defaults.accountEmail ?? ""} placeholder="prenom.nom@school.ma" className={inputCls} />
          </Field>
          <Field
            label={hasAccount ? "Réinitialiser le mot de passe" : "Mot de passe"}
            error={e("accountPassword")}
            hint={hasAccount ? "Laisser vide pour conserver le mot de passe actuel." : "8 caractères minimum."}
          >
            <input name="accountPassword" type="text" autoComplete="off" className={inputCls} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 font-semibold">Parent / tuteur</h2>
        <p className="mb-4 text-xs text-muted">Coordonnées de contact (optionnel).</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du parent" className="sm:col-span-2">
            <input name="parentName" defaultValue={defaults.parentName ?? ""} className={inputCls} />
          </Field>
          <Field label="Téléphone / WhatsApp">
            <input name="parentPhone" defaultValue={defaults.parentPhone ?? ""} className={inputCls} />
          </Field>
          <Field label="Email" error={e("parentEmail")}>
            <input name="parentEmail" type="email" defaultValue={defaults.parentEmail ?? ""} className={inputCls} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        <Link href={backHref} className={btnGhost}>
          Annuler
        </Link>
      </div>
    </form>
  );
}
