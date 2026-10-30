"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Hamburger + slide-over drawer. The navigation itself is rendered on the server and passed as children. */
export function MobileMenu({ children }: { children: ReactNode }) {
  // The drawer is tied to the pathname it was opened on, so it closes by itself after navigating.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white"
      >
        <Menu size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex w-72 max-w-[85%] flex-col bg-navy-900">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-50 rounded-lg p-2 text-white/80 sm:hidden"
            >
              <X size={18} />
            </button>
            {children}
          </div>
          <button type="button" aria-label="Fermer" className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
