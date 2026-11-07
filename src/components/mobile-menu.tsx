"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Hamburger + slide-over drawer. Rendered via portal to avoid header backdrop-filter/stacking issues. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink shadow-sm"
      >
        <Menu size={20} />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex lg:hidden" role="dialog" aria-modal="true">
            <div className="relative flex h-[100dvh] w-[min(18rem,85vw)] flex-col bg-brand-700 shadow-2xl">
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25"
              >
                <X size={18} />
              </button>
              <div className="h-full min-h-0">{children}</div>
            </div>
            <button type="button" aria-label="Fermer" className="h-full flex-1 bg-black/40" onClick={() => setOpen(false)} />
          </div>,
          document.body,
        )}
    </div>
  );
}
