import { Prisma } from "@prisma/client";

export type InvoiceStatus = "PAID" | "PARTIAL" | "UNPAID";

type Num = { toString(): string } | number;
type InvoiceLike = { lines: { amount: Num }[]; payments: { amount: Num }[] };

const ZERO = new Prisma.Decimal(0);
const dec = (v: Num) => new Prisma.Decimal(v.toString());

/** The amount due is the sum of the invoice lines (one per enrollment). */
export function invoiceTotals(invoice: InvoiceLike) {
  const dueDecimal = invoice.lines.reduce((sum, line) => sum.plus(dec(line.amount)), ZERO);
  const paidDecimal = invoice.payments.reduce((sum, payment) => sum.plus(dec(payment.amount)), ZERO);
  const remainingDecimal = dueDecimal.minus(paidDecimal);
  const remaining = remainingDecimal.greaterThan(0) ? remainingDecimal : ZERO;
  return {
    due: dueDecimal.toNumber(),
    paid: paidDecimal.toNumber(),
    remaining: remaining.toNumber(),
    dueDecimal,
    paidDecimal,
    remainingDecimal: remaining,
  };
}

/** Computed, never stored: sum(payments) = 0 → UNPAID, < due → PARTIAL, ≥ due → PAID */
export function invoiceStatus(invoice: InvoiceLike): InvoiceStatus {
  const { dueDecimal, paidDecimal } = invoiceTotals(invoice);
  if (paidDecimal.lessThanOrEqualTo(0)) return "UNPAID";
  if (paidDecimal.lessThan(dueDecimal)) return "PARTIAL";
  return "PAID";
}

export const isOverdue = (invoice: InvoiceLike & { dueDate: Date }, now = new Date()) =>
  invoiceStatus(invoice) !== "PAID" && invoice.dueDate < now;

export const firstOfMonth = (d = new Date(), offset = 0) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));

export type PeriodLike = { startDate: Date; endDate: Date; closedAt: Date | null };

/** Open iff now ∈ [start, end] and not closed early. Computed on read: no cron job. */
export function registrationState(p: PeriodLike | null | undefined, now = new Date()) {
  if (!p) return "NONE" as const;
  if (p.closedAt || now > p.endDate) return "CLOSED" as const;
  if (now < p.startDate) return "UPCOMING" as const;
  return "OPEN" as const;
}

export const statusMeta = {
  PAID: { label: "Payé", tone: "green" },
  PARTIAL: { label: "Partiel", tone: "amber" },
  UNPAID: { label: "Non payé", tone: "red" },
} as const;

export const kindMeta = {
  REGULAR: { label: "Soutien", tone: "blue" },
  CONCOURS: { label: "Concours", tone: "purple" },
} as const;
