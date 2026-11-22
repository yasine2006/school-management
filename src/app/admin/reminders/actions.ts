"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { addMonths, monthKey, parseMonthKey } from "@/lib/invoicing";
import { sendReminders, type RemindOptions } from "@/lib/reminders";

/**
 * Relance manuelle : le mois affiché ET le mois précédent (échéance dépassée),
 * et ce autant de fois que nécessaire dans la journée.
 */
async function relance(schoolId: number, month: Date, opts: RemindOptions = {}) {
  const previous = addMonths(month, -1);
  const [current, lastMonth] = await Promise.all([
    sendReminders(schoolId, month, { ...opts, allowRepeat: true }),
    sendReminders(schoolId, previous, { ...opts, allowRepeat: true }),
  ]);
  return current + lastMonth;
}

export async function remindStudent(studentId: number, key: string) {
  const session = await requireRole("ADMIN");
  const month = parseMonthKey(key);
  if (!month) return;

  const sent = await relance(session.schoolId, month, { studentIds: [studentId] });
  revalidatePath("/admin", "layout");
  redirect(`/admin/reminders?month=${monthKey(month)}&sent=${sent}`);
}

export async function remindAll(key: string) {
  const session = await requireRole("ADMIN");
  const month = parseMonthKey(key);
  if (!month) return;

  const sent = await relance(session.schoolId, month, { onlyOverdue: true });
  revalidatePath("/admin", "layout");
  redirect(`/admin/reminders?month=${monthKey(month)}&sent=${sent}`);
}
