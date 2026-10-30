import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, current - 1, current, current + 1, total]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  noun: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const base = "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
      <span>
        Affichage de {from} à {to} sur {total} {noun}
      </span>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        {page > 1 && (
          <Link href={href(page - 1)} aria-label="Page précédente" className={`${base} border-line bg-white hover:bg-slate-50`}>
            <ChevronLeft size={16} />
          </Link>
        )}
        {pageList(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${base} ${p === page ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-slate-50"}`}
            >
              {p}
            </Link>
          ),
        )}
        {page < pages && (
          <Link href={href(page + 1)} aria-label="Page suivante" className={`${base} border-line bg-white hover:bg-slate-50`}>
            <ChevronRight size={16} />
          </Link>
        )}
      </nav>
    </div>
  );
}
