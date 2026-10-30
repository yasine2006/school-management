"use client";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f6fb", color: "#0f1b33" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              border: "1px solid #e6ebf3",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 20 }}>Une erreur est survenue</h1>
            <p style={{ marginTop: 8, fontSize: 14, color: "#6b7a93" }}>
              Réessayez. Si le problème persiste, contactez l&apos;administrateur.
            </p>
            {error.digest && <p style={{ marginTop: 12, fontSize: 12, color: "#6b7a93" }}>Référence : {error.digest}</p>}
            <button
              type="button"
              onClick={() => retry()}
              style={{
                marginTop: 24,
                border: 0,
                borderRadius: 8,
                background: "#1f5af0",
                color: "#fff",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
