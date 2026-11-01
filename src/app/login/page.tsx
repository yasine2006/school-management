import type { Metadata } from "next";
import { BookOpen, HeartHandshake, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// the school name comes from the database: never prerender at build time
export const dynamic = "force-dynamic";

const features = [
  { icon: MonitorSmartphone, title: "Simple", text: "à utiliser" },
  { icon: ShieldCheck, title: "Sécurisé", text: "et fiable" },
  { icon: HeartHandshake, title: "Toujours", text: "avec vous" },
];

function SchoolLogo({ school, size = 44 }: { school: { name: string; logo: string | null }; size?: number }) {
  if (school.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={school.logo} alt={school.name} style={{ width: size, height: size }} className="shrink-0 rounded-xl bg-white object-contain p-1" />;
  }
  return (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20">
      <BookOpen size={size * 0.5} />
    </span>
  );
}

export default async function LoginPage() {
  const school = await db.school.findFirst({ select: { name: true, logo: true } }).catch(() => null);
  const name = school?.name ?? "Centre de soutien";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Hero */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(47,107,255,.45), transparent 45%), radial-gradient(circle at 85% 80%, rgba(56,189,248,.25), transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <SchoolLogo school={{ name, logo: school?.logo ?? null }} size={44} />
          <div className="leading-tight">
            <p className="font-semibold">{name}</p>
            <p className="text-xs text-slate-300">Centre de soutien</p>
          </div>
        </div>

        <div className="relative max-w-lg space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Un centre de soutien mieux organisé, pour un avenir plus serein
          </h1>
          <p className="text-slate-300">
            Gestion des élèves, des matières, des groupes, des paiements et accès en ligne pour les élèves.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
                <Icon size={22} className="mb-3 text-sky-300" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-sm text-slate-400">
          {name} © {new Date().getFullYear()}
        </p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            {school?.logo ? (
              <img src={school.logo} alt={name} className="mb-4 h-16 w-16 rounded-2xl bg-white object-contain ring-1 ring-line p-1" />
            ) : (
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <BookOpen size={28} />
              </span>
            )}
            <h2 className="text-xl font-bold">{name}</h2>
            <p className="text-sm text-muted">Centre de soutien</p>
            <p className="mt-6 text-lg font-semibold">Connectez-vous</p>
            <p className="text-sm text-muted">Accédez à votre espace</p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-xs text-muted">
            Mot de passe oublié ? Contactez l&apos;administration du centre.
          </p>

          {process.env.NODE_ENV !== "production" && (
            <div className="mt-8 rounded-lg border border-dashed border-line bg-slate-50 p-3 text-xs text-muted">
              <p className="mb-1 font-medium text-ink">Comptes de démo (mot de passe : password123)</p>
              <p>admin@school.ma (admin) · prof@school.ma (enseignant) · ahmed.benali@school.ma (élève)</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
