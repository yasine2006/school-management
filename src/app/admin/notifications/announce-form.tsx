"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { btnPrimary, Card, Field, inputCls } from "@/components/ui";
import { sendAnnouncement, type AnnounceState } from "./actions";

export function AnnounceForm({ groups }: { groups: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<AnnounceState, FormData>(sendAnnouncement, {});

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Envoyer une annonce aux élèves</h2>
      <form action={action} className="space-y-4">
        <Field label="Destinataires">
          <select name="groupId" className={inputCls}>
            <option value="">Tous les élèves</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                Élèves de {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Titre" error={state.errors?.title?.[0]}>
          <input name="title" className={inputCls} placeholder="Réunion de rentrée" />
        </Field>
        <Field label="Message" error={state.errors?.body?.[0]}>
          <textarea name="body" rows={4} className={inputCls} />
        </Field>
        <button disabled={pending} className={btnPrimary}>
          <Send size={15} /> {pending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </Card>
  );
}
