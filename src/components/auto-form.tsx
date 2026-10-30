"use client";

import type { FormHTMLAttributes } from "react";

/** GET form that re-submits itself when a <select> or date input changes (filters). */
export function AutoForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      method="get"
      {...props}
      onChange={(e) => {
        const t = e.target as HTMLElement;
        const type = (t as HTMLInputElement).type;
        if (t.tagName === "SELECT" || type === "date" || type === "month") e.currentTarget.requestSubmit();
      }}
    />
  );
}
