"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";
import { canForceDeleteStudent } from "@/lib/collection";

const optional = z.string().trim().optional();

const schema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).default("ACTIVE"),
  photo: z.string().trim().url("URL invalide").optional().or(z.literal("")),
  parentName: optional,
  parentPhone: optional,
  parentEmail: z.string().trim().email("Email invalide").optional().or(z.literal("")),
  accountEmail: z.string().trim().toLowerCase().email("Email invalide").optional().or(z.literal("")),
  accountPassword: optional,
});

export type StudentFormState = { errors?: Record<string, string[] | undefined>; message?: string };

const clean = (v?: string) => (v ? v : null);
const MIN_PW = 8;

/**
 * Creates or updates the STUDENT login account for a student.
 * - email empty → no account change (account is never unlinked here)
 * - new account → password required
 * - existing account → password optional (blank = keep)
 */
async function syncAccount(schoolId: number, name: string, currentUserId: number | null, email: string | null, password: string | null) {
  if (!email) return { userId: currentUserId };

  if (currentUserId) {
    const clash = await db.user.findFirst({ where: { email, id: { not: currentUserId } } });
    if (clash) return { error: { accountEmail: ["Cet email est déjà utilisé"] } };
    await db.user.update({
      where: { id: currentUserId },
      data: { name, email, ...(password ? { password: await bcrypt.hash(password, 10) } : {}) },
    });
    return { userId: currentUserId };
  }

  if (!password || password.length < MIN_PW) return { error: { accountPassword: ["8 caractères minimum"] } };
  if (await db.user.findUnique({ where: { email } })) return { error: { accountEmail: ["Cet email est déjà utilisé"] } };
  const user = await db.user.create({
    data: { schoolId, name, email, role: "STUDENT", password: await bcrypt.hash(password, 10) },
  });
  return { userId: user.id };
}

export async function createStudent(_: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const account = await syncAccount(session.schoolId, `${d.firstName} ${d.lastName}`, null, clean(d.accountEmail), d.accountPassword?.trim() || null);
  if (account.error) return { errors: account.error };

  const student = await db.student.create({
    data: {
      schoolId: session.schoolId,
      userId: account.userId,
      firstName: d.firstName,
      lastName: d.lastName,
      status: d.status,
      photo: clean(d.photo),
      parentName: clean(d.parentName),
      parentPhone: clean(d.parentPhone),
      parentEmail: clean(d.parentEmail),
    },
  });

  await audit(session, "CREATE", "Student", student.id, { name: `${d.firstName} ${d.lastName}`, account: !!account.userId });
  revalidatePath("/admin", "layout");
  redirect(`/admin/students/${student.id}`);
}

export async function updateStudent(id: number, _: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const student = await db.student.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!student) return { message: "Élève introuvable." };

  const account = await syncAccount(session.schoolId, `${d.firstName} ${d.lastName}`, student.userId, clean(d.accountEmail), d.accountPassword?.trim() || null);
  if (account.error) return { errors: account.error };

  await db.student.update({
    where: { id },
    data: {
      userId: account.userId,
      firstName: d.firstName,
      lastName: d.lastName,
      status: d.status,
      photo: clean(d.photo),
      parentName: clean(d.parentName),
      parentPhone: clean(d.parentPhone),
      parentEmail: clean(d.parentEmail),
    },
  });

  await audit(session, "UPDATE", "Student", id, { name: `${d.firstName} ${d.lastName}` });
  revalidatePath("/admin", "layout");
  redirect(`/admin/students/${id}`);
}

export async function forceDeleteStudent(id: number, confirmation: string) {
  const session = await requireRole("ADMIN");
  const student = await db.student.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!student) return { ok: false as const, message: "Élève introuvable." };
  if (confirmation.trim().toUpperCase() !== `${student.lastName.toUpperCase()} ${student.firstName.toUpperCase()}`) {
    return { ok: false as const, message: "Confirmation invalide." };
  }

  const check = await canForceDeleteStudent(id, session.schoolId);
  if (!check.ok) return { ok: false as const, message: check.reason };

  if (student.userId) await db.student.update({ where: { id }, data: { userId: null } });

  await db.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { studentId: id } });
    await tx.payment.deleteMany({ where: { invoice: { studentId: id } } });
    await tx.invoiceLine.deleteMany({ where: { invoice: { studentId: id } } });
    await tx.invoice.deleteMany({ where: { studentId: id } });
    await tx.enrollment.deleteMany({ where: { studentId: id } });
    await tx.notification.deleteMany({ where: { userId: student.userId ?? -1 } });
    await tx.student.delete({ where: { id } });
  });

  await audit(session, "DELETE", "Student", id, {
    name: `${student.firstName} ${student.lastName}`,
    reason: "UNPAID_OVER_30_DAYS",
    maxDaysLate: check.maxDaysLate,
    unpaid: check.unpaid,
  });
  revalidatePath("/admin", "layout");
  redirect("/admin/students");
}

export async function deleteStudent(id: number) {
  const session = await requireRole("ADMIN");
  const student = await db.student.findFirst({ where: { id, schoolId: session.schoolId } });
  if (!student) return;

  if (student.userId) await db.student.update({ where: { id }, data: { userId: null } });
  await db.student.delete({ where: { id } });
  await audit(session, "DELETE", "Student", id, { name: `${student.firstName} ${student.lastName}` });
  revalidatePath("/admin", "layout");
}
