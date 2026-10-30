import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

export const selectCls = inputCls.replace("w-full ", "w-auto ");

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,27,51,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  red: "bg-rose-50 text-rose-600 ring-rose-100",
  blue: "bg-brand-50 text-brand-700 ring-brand-100",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-100",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

const avatarColors = ["bg-brand-100 text-brand-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700"];

export function Avatar({ name, photo, size = 36 }: { name: string; photo?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} style={style} className="shrink-0 rounded-full object-cover" />;
  }
  const color = avatarColors[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarColors.length];
  return (
    <span style={style} className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${color}`}>
      {initials(name)}
    </span>
  );
}

export function Field({ label, error, hint, children, className = "" }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm font-medium text-ink ${className}`}>
      <span className="mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export const th = "px-4 py-3 text-left text-xs font-semibold text-muted";
export const td = "px-4 py-3.5 text-sm";
