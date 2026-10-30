"use client";

import type { ReactNode } from "react";

/** Submit button that asks for confirmation first (use inside a <form action={serverAction}>). */
export function ConfirmButton({
  message,
  className,
  label,
  children,
}: {
  message: string;
  className?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
