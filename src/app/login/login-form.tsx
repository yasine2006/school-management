"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login, type LoginState } from "./actions";

const field =
  "w-full rounded-lg border border-line bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        <span className="mb-1.5 block">Email</span>
        <span className="relative block">
          <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="email" type="email" required autoComplete="email" placeholder="vous@ecole.ma" className={field} />
        </span>
      </label>

      <label className="block text-sm font-medium">
        <span className="mb-1.5 block">Mot de passe</span>
        <span className="relative block">
          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={field}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
