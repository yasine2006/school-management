"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-ink">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted">
          Réessayez. Si le problème persiste, contactez l&apos;administrateur.
        </p>
        {error.digest && <p className="mt-3 text-xs text-muted">Référence : {error.digest}</p>}
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Réessayer
        </button>
      </div>
    </main>
  );
}
