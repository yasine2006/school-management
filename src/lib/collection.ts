import "server-only";
import { db } from "@/lib/db";
import { invoiceTotals } from "@/lib/fees";

const DAY = 86_400_000;

export async function canForceDeleteStudent(studentId: number, schoolId: number) {
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      invoices: {
        include: { lines: true, payments: true },
        orderBy: { month: "desc" },
      },
    },
  });
  if (!student) return { ok: false as const, reason: "Introuvable" };

  const now = new Date();
  let maxDaysLate = 0;
  let unpaid = 0;

  for (const invoice of student.invoices) {
    const t = invoiceTotals(invoice);
    if (t.remaining <= 0) continue;
    unpaid += t.remaining;
    const due = invoice.dueDate.getTime();
    const days = Math.max(0, Math.floor((now.getTime() - due) / DAY));
    if (days > maxDaysLate) maxDaysLate = days;
  }

  if (unpaid <= 0) return { ok: false as const, reason: "Aucun impayé" };
  if (maxDaysLate <= 30) return { ok: false as const, reason: "Délai < 31 jours" };

  return { ok: true as const, maxDaysLate, unpaid };
}

