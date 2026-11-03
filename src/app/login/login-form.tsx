"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { login, type LoginState } from "./actions";

const inputClasses =
  "w-full rounded-xl border border-slate-200/90 bg-[#f0f4f9] py-3 pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/15";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        <span className="mb-1.5 block">Email</span>
        <span className="relative block">
          <Mail
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors"
          />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="admin@school.ma"
            className={inputClasses}
          />
        </span>
      </label>

      <label className="block text-sm font-medium text-slate-700">
        <span className="mb-1.5 block">Mot de passe</span>
        <span className="relative block">
          <Lock
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors"
          />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClasses}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all duration-200 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-500/35 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
      >
        {pending ? "Connexion en cours…" : "Se connecter"}
      </button>
    </form>
  );
}
