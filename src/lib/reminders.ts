import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { invoiceTotals } from "@/lib/fees";
import { formatDH, formatMonth } from "@/lib/format";
import { billableEnrollments, monthKey, monthStart } from "@/lib/invoicing";

export const REMINDER_TITLE = "Rappel de paiement";

export type ReminderStatus = "PAID" | "PARTIAL" | "UNPAID" | "MISSING";

export type ReminderRow = {
  studentId: number;
  firstName: string;
  lastName: string;
  parentName: string | null;
  phone: string | null;
  userId: number | null;
  invoiceId: number | null;
  status: ReminderStatus;
  due: number;
  paid: number;
  remaining: number;
  daysLate: number;
  remindedAt: Date | null;
  remindedToday: boolean;
  waHref: string | null;
};

const DAY = 86_400_000;
const startOfDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function normalizePhone(raw: string | null) {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  return /^\d{9,15}$/.test(digits) ? digits : null;
}

export function reminderText(row: Pick<ReminderRow, "firstName" | "remaining" | "daysLate">, month: Date) {
  const late = row.daysLate > 0 ? ` (retard de ${row.daysLate} jour${row.daysLate > 1 ? "s" : ""})` : "";
  return `Bonjour ${row.firstName}, la facture de ${formatMonth(month)} n'est pas encore réglée${late}. Reste à payer : ${formatDH(row.remaining)}. Merci de régulariser.`;
}

export async function reminderRows(schoolId: number, month: Date): Promise<ReminderRow[]> {
  const students = await db.student.findMany({
    where: { schoolId, archived: false, status: "ACTIVE", enrollments: { some: { status: "ACTIVE" } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentName: true,
      parentPhone: true,
      userId: true,
      enrollments: { where: { status: "ACTIVE" }, select: { startedAt: true, monthlyFee: true } },
      invoices: {
        where: { month },
        select: {
          id: true,
          dueDate: true,
          lines: { select: { amount: true } },
          payments: { select: { amount: true } },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  if (!students.length) return [];

  const invoiceIds = students.flatMap((s) => s.invoices.map((i) => i.id));
  const logs = invoiceIds.length
    ? await db.auditLog.findMany({
        where: { schoolId, action: "REMINDER", entity: "Invoice", entityId: { in: invoiceIds } },
        orderBy: { createdAt: "desc" },
        select: { entityId: true, createdAt: true },
      })
    : [];

  const lastReminder = new Map<number, Date>();
  const today = new Set<number>();
  const sod = startOfDay();
  for (const log of logs) {
    if (log.entityId === null) continue;
    if (!lastReminder.has(log.entityId)) lastReminder.set(log.entityId, log.createdAt);
    if (log.createdAt >= sod) today.add(log.entityId);
  }

  const fallbackDue = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 5));
  const now = new Date();

  return students.map((s) => {
    const invoice = s.invoices[0] ?? null;
    const expected = billableEnrollments(s.enrollments, month)
      .reduce((sum, e) => sum.plus(new Prisma.Decimal(e.monthlyFee.toString())), new Prisma.Decimal(0))
      .toNumber();
    const totals = invoice ? invoiceTotals(invoice) : null;
    const due = totals ? totals.due : expected;
    const paid = totals ? totals.paid : 0;
    const remaining = totals ? totals.remaining : expected;
    const status: ReminderStatus = !invoice
      ? "MISSING"
      : remaining <= 0
        ? "PAID"
        : paid > 0
          ? "PARTIAL"
          : "UNPAID";
    const dueDate = invoice?.dueDate ?? fallbackDue;
    const daysLate = remaining > 0 ? Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / DAY)) : 0;
    const remindedAt = invoice ? (lastReminder.get(invoice.id) ?? null) : null;
    const phone = normalizePhone(s.parentPhone);

    const row: Omit<ReminderRow, "waHref"> = {
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      parentName: s.parentName,
      phone,
      userId: s.userId,
      invoiceId: invoice?.id ?? null,
      status,
      due,
      paid,
      remaining: remaining > 0 ? remaining : 0,
      daysLate,
      remindedAt,
      remindedToday: invoice ? today.has(invoice.id) : false,
    };

    return {
      ...row,
      waHref: phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(reminderText(row, month))}`
        : null,
    };
  });
}

export type RemindOptions = { studentIds?: number[]; onlyOverdue?: boolean };

export async function sendReminders(schoolId: number, month: Date, opts: RemindOptions = {}) {
  const rows = (await reminderRows(schoolId, month)).filter(
    (r) =>
      r.invoiceId !== null &&
      r.remaining > 0 &&
      r.userId !== null &&
      !r.remindedToday &&
      (!opts.studentIds || opts.studentIds.includes(r.studentId)) &&
      (!opts.onlyOverdue || r.daysLate > 0),
  );
  if (!rows.length) return 0;

  const actor = await db.user.findFirst({ where: { schoolId }, orderBy: { id: "asc" }, select: { id: true } });
  if (!actor) return 0;

  await db.$transaction(
    rows.map((r) =>
      db.notification.create({
        data: { userId: r.userId!, title: REMINDER_TITLE, body: reminderText(r, month) },
      }),
    ),
  );

  await db.auditLog.createMany({
    data: rows.map((r) => ({
      schoolId,
      userId: actor.id,
      action: "REMINDER",
      entity: "Invoice",
      entityId: r.invoiceId,
      details: { studentId: r.studentId, month: monthKey(month), remaining: r.remaining },
    })),
  });

  return rows.length;
}

export async function reminderSummary(schoolId: number, month = monthStart(new Date())) {
  const rows = await reminderRows(schoolId, month);
  const unpaid = rows.filter((r) => r.remaining > 0);
  return {
    month,
    rows,
    due: rows.reduce((s, r) => s + r.due, 0),
    paid: rows.reduce((s, r) => s + r.paid, 0),
    remaining: unpaid.reduce((s, r) => s + r.remaining, 0),
    upToDate: rows.filter((r) => r.status === "PAID").length,
    late: unpaid.filter((r) => r.daysLate > 0).length,
    missing: rows.filter((r) => r.status === "MISSING").length,
    sendable: unpaid.filter((r) => r.invoiceId !== null && r.userId !== null && !r.remindedToday).length,
  };
}
