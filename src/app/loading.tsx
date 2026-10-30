export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div
        role="status"
        aria-label="Chargement"
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-600"
      />
    </div>
  );
}
