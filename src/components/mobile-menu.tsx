"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Hamburger + slide-over drawer. Rendered via portal to avoid header backdrop-filter/stacking issues. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  useEffect(() => setMounted(true), []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[60] flex lg:hidden" role="dialog" aria-modal="true">
            <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-brand-700 shadow-2xl">
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
              >
                <X size={18} />
              </button>
              <div className="h-full">{children}</div>
            </div>
            <button type="button" aria-label="Fermer" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink"
      >
        <Menu size={18} />
      </button>
      {drawer}
    </div>
  );
}
