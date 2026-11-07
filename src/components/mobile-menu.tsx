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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white"
      >
        <Menu size={18} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-navy-900 shadow-xl">
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="h-full">{children}</div>
          </div>
          <button type="button" aria-label="Fermer" className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
