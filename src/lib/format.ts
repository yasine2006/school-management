const nbsp = /[  ]/g; // keep plain spaces so PDFs render correctly

export const formatDH = (n: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n).replace(nbsp, " ")} DH`;

export const formatDate = (d: Date | string, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(d).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric", ...opts });

export const formatMonth = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" });

export const formatLongDate = (d = new Date()) => {
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase());
};

export const timeAgo = (d: Date | string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (mins < 60) return `Il y a ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Il y a ${h} h`;
  const days = Math.round(h / 24);
  return `Il y a ${days} j`;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** yyyy-mm-dd for <input type="date"> */
export const toInputDate = (d: Date) => d.toISOString().slice(0, 10);
