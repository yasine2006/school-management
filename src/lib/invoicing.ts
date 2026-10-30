import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const MAX_BILLING_MONTHS = 12;

export type EnrollmentForBilling = {
  id: number;
  startedAt: Date;
  monthlyFee: Prisma.Decimal;
  group: { name: string };
};

export const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
export const monthEnd = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
export const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
export const monthKey = (d: Date) => d.toISOString().slice(0, 7);
export const parseMonthKey = (key: string) => (/^\d{4}-\d{2}$/.test(key) ? new Date(`${key}-01T00:00:00.000Z`) : null);

export function monthsBetween(from: Date, to: Date, max = MAX_BILLING_MONTHS) {
  const out: Date[] = [];
  let cur = monthStart(from);
  const last = monthStart(to);
  while (cur.getTime() <= last.getTime() && out.length < max) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out.reverse();
}

export const billableEnrollments = <T extends { startedAt: Date }>(enrollments: T[], month: Date) => {
  const end = monthEnd(month);
  return enrollments.filter((e) => e.startedAt.getTime() <= end.getTime());
};

export const monthDue = (enrollments: EnrollmentForBilling[], month: Date) =>
  billableEnrollments(enrollments, month).reduce((sum, e) => sum.plus(new Prisma.Decimal(e.monthlyFee.toString())), new Prisma.Decimal(0));

type Tx = Prisma.TransactionClient;

export async function ensureInvoiceForMonth(
  tx: Tx,
  studentId: number,
  month: Date,
  enrollments: EnrollmentForBilling[],
) {
  const existing = await tx.invoice.findUnique({ where: { studentId_month: { studentId, month } } });
  if (existing) return existing;

  const active = billableEnrollments(enrollments, month);
  if (!active.length) return null;

  return tx.invoice
    .create({
      data: {
        studentId,
        month,
        dueDate: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 5)),
        lines: { create: active.map((e) => ({ enrollmentId: e.id, label: e.group.name, amount: e.monthlyFee })) },
      },
    })
    .catch(async (error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return tx.invoice.findUnique({ where: { studentId_month: { studentId, month } } });
      }
      throw error;
    });
}

type Planned = { studentId: number; month: Date; enrollments: EnrollmentForBilling[] };

async function planMissing(schoolId: number | undefined, upTo: Date): Promise<Planned[]> {
  const last = monthStart(upTo);
  const earliestMonth = addMonths(last, -(MAX_BILLING_MONTHS - 1));

  const students = await db.student.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      archived: false,
      status: "ACTIVE",
      enrollments: { some: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      enrollments: {
        where: { status: "ACTIVE" },
        select: { id: true, startedAt: true, monthlyFee: true, group: { select: { name: true } } },
      },
    },
  });
  if (!students.length) return [];

  const existing = await db.invoice.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, month: { gte: earliestMonth, lte: last } },
    select: { studentId: true, month: true },
  });
  const taken = new Set(existing.map((i) => `${i.studentId}:${monthKey(i.month)}`));

  const plan: Planned[] = [];
  for (const s of students) {
    const first = s.enrollments.reduce<Date | null>(
      (min, e) => (min === null || e.startedAt < min ? e.startedAt : min),
      null,
    );
    const from = first && monthStart(first).getTime() > earliestMonth.getTime() ? monthStart(first) : earliestMonth;
    for (const month of monthsBetween(from, last)) {
      if (taken.has(`${s.id}:${monthKey(month)}`)) continue;
      if (!billableEnrollments(s.enrollments, month).length) continue;
      plan.push({ studentId: s.id, month, enrollments: s.enrollments });
    }
  }
  return plan;
}

export async function countMissingInvoices(schoolId: number, upTo = new Date()) {
  return (await planMissing(schoolId, upTo)).length;
}

export async function generateMissingInvoices(schoolId?: number, upTo = new Date()) {
  const plan = await planMissing(schoolId, upTo);
  if (!plan.length) return 0;

  let created = 0;
  await db.$transaction(
    async (tx) => {
      for (const item of plan) {
        const invoice = await ensureInvoiceForMonth(tx, item.studentId, item.month, item.enrollments);
        if (invoice) created++;
      }
    },
    { maxWait: 5000, timeout: 60_000 },
  );
  return created;
}
