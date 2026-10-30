"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { monthKey, parseMonthKey } from "@/lib/invoicing";
import { sendReminders } from "@/lib/reminders";

export async function remindStudent(studentId: number, key: string) {
  const session = await requireRole("ADMIN");
  const month = parseMonthKey(key);
  if (!month) return;

  const sent = await sendReminders(session.schoolId, month, { studentIds: [studentId] });
  revalidatePath("/admin", "layout");
  redirect(`/admin/reminders?month=${monthKey(month)}&sent=${sent}`);
}

export async function remindAll(key: string) {
  const session = await requireRole("ADMIN");
  const month = parseMonthKey(key);
  if (!month) return;

  const sent = await sendReminders(session.schoolId, month, { onlyOverdue: true });
  revalidatePath("/admin", "layout");
  redirect(`/admin/reminders?month=${monthKey(month)}&sent=${sent}`);
}
