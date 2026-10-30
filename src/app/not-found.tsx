import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-1 text-xl font-bold text-ink">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted">La page demandée n&apos;existe pas ou a été déplacée.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
