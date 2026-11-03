import type { Metadata } from "next";
import { BookOpen, HeartHandshake, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion — Centre Excellence" };

// The school name comes from the database: never prerender at build time
export const dynamic = "force-dynamic";

const features = [
  {
    icon: MonitorSmartphone,
    title: "Simple",
    text: "à utiliser",
    accent: "from-sky-400 to-blue-500",
  },
  {
    icon: ShieldCheck,
    title: "Sécurisé",
    text: "et fiable",
    accent: "from-blue-400 to-indigo-500",
  },
  {
    icon: HeartHandshake,
    title: "Toujours",
    text: "avec vous",
    accent: "from-cyan-400 to-sky-500",
  },
];

function ModernNLogo({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 via-brand-600 to-sky-500 text-white shadow-lg shadow-brand-500/30 ring-1 ring-white/30 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 drop-shadow"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 4.5v15" />
        <path d="M5 5.5l14 13" />
        <path d="M19 4.5v15" />
      </svg>
    </div>
  );
}

function TechDataOverlay() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden opacity-35 mix-blend-screen">
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="tech-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
            <circle cx="0" cy="0" r="1.5" fill="rgba(56, 189, 248, 0.4)" />
          </pattern>
          <linearGradient id="line-glow-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="80%" stopColor="#2f6bff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1f5af0" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#tech-grid)" />
        {/* Abstract glowing data overlay lines */}
        <line x1="5%" y1="25%" x2="75%" y2="80%" stroke="url(#line-glow-blue)" strokeWidth="1.5" strokeDasharray="6 10" />
        <line x1="25%" y1="10%" x2="95%" y2="65%" stroke="url(#line-glow-blue)" strokeWidth="1.2" strokeDasharray="4 8" />
        <line x1="60%" y1="5%" x2="95%" y2="35%" stroke="url(#line-glow-blue)" strokeWidth="1" strokeDasharray="3 6" />
        {/* Subtle glowing digital particles */}
        <circle cx="22%" cy="38%" r="3" fill="#38bdf8" className="animate-pulse" />
        <circle cx="48%" cy="58%" r="2" fill="#60a5fa" />
        <circle cx="75%" cy="80%" r="3.5" fill="#38bdf8" className="animate-pulse" />
        <circle cx="88%" cy="28%" r="2.5" fill="#93c5fd" />
      </svg>
    </div>
  );
}

export default async function LoginPage() {
  const school = await db.school.findFirst({ select: { name: true, logo: true } }).catch(() => null);
  const schoolName = school?.name ?? "Centre Excellence";

  return (
    <main className="grid min-h-screen lg:grid-cols-2 bg-slate-50">
      {/* ── Left section: Cinematic Brand & Study Atmosphere ── */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-10 xl:p-14 text-white lg:flex">
        {/* Background photo: candid students in modern study library environment */}
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1920&q=80"
            alt="Étudiants en session d'étude collaborative"
            className="h-full w-full object-cover object-[center_right] scale-105"
          />
          {/* Heavy color-grading: deep navy, royal blue, midnight blue with dark left side for contrast */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/92 to-navy-900/70"
            style={{
              background:
                "linear-gradient(90deg, #071432 0%, #071432 35%, rgba(11,27,59,0.92) 65%, rgba(18,39,90,0.65) 100%)",
            }}
          />
          {/* Subtle radial royal blue glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 25% 30%, rgba(47,107,255,0.45) 0%, transparent 60%), radial-gradient(ellipse at 80% 85%, rgba(56,189,248,0.2) 0%, transparent 50%)",
            }}
          />
        </div>

        {/* Abstract data lines & glowing particles */}
        <TechDataOverlay />

        {/* Top: Branding */}
        <div className="relative z-10 flex items-center gap-3.5">
          {school?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={school.logo}
              alt={schoolName}
              className="h-11 w-11 shrink-0 rounded-2xl bg-white/10 p-1 object-contain ring-1 ring-white/20 backdrop-blur"
            />
          ) : (
            <ModernNLogo className="h-11 w-11" />
          )}
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-white">{schoolName}</p>
            <p className="text-xs font-medium text-slate-300">Centre de soutien</p>
          </div>
        </div>

        {/* Middle: Headline, Subtext & Glassmorphic Feature Cards */}
        <div className="relative z-10 max-w-xl space-y-7 my-auto py-10">
          <div className="space-y-4">
            <h1 className="text-4xl xl:text-[42px] font-extrabold leading-[1.18] tracking-tight text-white drop-shadow-md">
              Un centre de soutien mieux organisé, pour un avenir plus serein
            </h1>
            <p className="text-base leading-relaxed text-slate-200/95 font-normal drop-shadow-sm max-w-lg">
              Gestion des élèves, des matières, des groupes, des paiements et accès en ligne pour les élèves.
            </p>
          </div>

          {/* 3 Dark Translucent Glassmorphic Cards with Glowing Blue Accents */}
          <div className="grid grid-cols-3 gap-3.5 pt-3">
            {features.map(({ icon: Icon, title, text, accent }) => (
              <div
                key={title}
                className="group relative rounded-2xl bg-white/[0.07] p-4.5 border border-white/15 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.35)] transition-all duration-300 hover:bg-white/[0.12] hover:border-sky-400/40 hover:shadow-[0_8px_32px_0_rgba(47,107,255,0.25)]"
              >
                <div
                  className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr ${accent} text-white shadow-[0_0_15px_rgba(56,189,248,0.3)] ring-1 ring-white/30`}
                >
                  <Icon size={19} />
                </div>
                <p className="text-sm font-semibold text-white tracking-tight">{title}</p>
                <p className="text-xs text-slate-300 group-hover:text-slate-200 transition-colors mt-0.5">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom-left: Copyright */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/80">
          <p>{schoolName} © 2026</p>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400">Plateforme active</span>
          </span>
        </div>
      </section>

      {/* ── Right section: Modern White Login Card ── */}
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
        <div className="w-full max-w-md">
          {/* Card container */}
          <div className="rounded-3xl bg-white p-8 sm:p-10 shadow-xl shadow-slate-200/60 border border-slate-100">
            {/* Top Branding on Card */}
            <div className="mb-7 flex flex-col items-center text-center">
              <ModernNLogo className="h-12 w-12 mb-3.5" />
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{schoolName}</h2>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-0.5">Centre de soutien</p>

              <div className="mt-6 w-full border-t border-slate-100 pt-5">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900">Connectez-vous</h3>
                <p className="mt-1 text-sm text-slate-400">Accédez à votre espace</p>
              </div>
            </div>

            {/* Login Form */}
            <LoginForm />

            {/* Forgot password link */}
            <p className="mt-5 text-center text-xs text-slate-500 leading-relaxed">
              Mot de passe oublié ?{" "}
              <span className="text-slate-600 font-medium hover:underline cursor-pointer">
                Contactez l&apos;administration du centre.
              </span>
            </p>
          </div>

          {/* Demo accounts hint (in dev) */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 p-4 text-xs text-slate-600">
              <p className="mb-1.5 font-semibold text-slate-800 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                Comptes de démo (mot de passe : <code className="font-mono text-brand-700 font-bold">password123</code>)
              </p>
              <div className="space-y-0.5 text-slate-500 font-mono text-[11px]">
                <p>• admin@school.ma (admin)</p>
                <p>• prof@school.ma (enseignant)</p>
                <p>• ahmed.benali@school.ma (élève)</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
