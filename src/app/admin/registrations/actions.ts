"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

const schema = z.object({
  startDate: z.iso.date("Date de début invalide"),
  endDate: z.iso.date("Date de fin invalide"),
});

export type PeriodState = { errors?: Record<string, string[] | undefined>; message?: string; ok?: boolean };

export async function savePeriod(_: PeriodState, formData: FormData): Promise<PeriodState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const startDate = new Date(`${parsed.data.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${parsed.data.endDate}T23:59:59.999Z`); // the end day is included
  if (endDate <= startDate) return { errors: { endDate: ["La date de fin doit être après la date de début"] } };

  const current = await db.registrationPeriod.findFirst({ where: { schoolId: session.schoolId }, orderBy: { startDate: "desc" } });
  const year = startDate.getUTCFullYear();

  if (current) {
    await db.registrationPeriod.update({ where: { id: current.id }, data: { startDate, endDate, closedAt: null } });
  } else {
    await db.registrationPeriod.create({
      data: { schoolId: session.schoolId, name: `Inscriptions ${year}/${year + 1}`, startDate, endDate },
    });
  }

  await audit(session, "UPDATE", "RegistrationPeriod", current?.id, { startDate, endDate });
  revalidatePath("/admin/registrations");
  return { ok: true };
}

/** Admin can end the registration period before its end date. */
export async function closePeriod() {
  const session = await requireRole("ADMIN");
  const current = await db.registrationPeriod.findFirst({ where: { schoolId: session.schoolId }, orderBy: { startDate: "desc" } });
  if (!current) return;

  await db.registrationPeriod.update({ where: { id: current.id }, data: { closedAt: new Date() } });
  await audit(session, "UPDATE", "RegistrationPeriod", current.id, { closed: true });
  revalidatePath("/admin/registrations");
}

export async function validateStudent(id: number) {
  const session = await requireRole("ADMIN");
  const s = await db.student.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!s) return;

  await db.student.update({ where: { id }, data: { status: "ACTIVE" } });
  await audit(session, "UPDATE", "Student", id, { status: "ACTIVE" });
  revalidatePath("/admin", "layout");
}
