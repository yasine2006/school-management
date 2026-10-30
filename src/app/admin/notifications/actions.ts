"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/session";

export async function markAllRead() {
  const session = await requireRole("ADMIN");
  await db.notification.updateMany({ where: { userId: session.userId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/admin", "layout");
}

const schema = z.object({
  groupId: z.string(),
  title: z.string().trim().min(1, "Titre requis").max(120),
  body: z.string().trim().min(1, "Message requis").max(1000),
});

export type AnnounceState = { errors?: Record<string, string[] | undefined> };

/** Sends an in-app announcement to the student accounts of one group (or the whole centre). */
export async function sendAnnouncement(_: AnnounceState, formData: FormData): Promise<AnnounceState> {
  const session = await requireRole("ADMIN");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const groupId = Number(parsed.data.groupId) || undefined;
  const students = await db.student.findMany({
    where: {
      schoolId: session.schoolId,
      archived: false,
      userId: { not: null },
      ...(groupId ? { enrollments: { some: { groupId, status: "ACTIVE" } } } : {}),
    },
    select: { userId: true },
  });
  const userIds = [...new Set(students.map((s) => s.userId!))];

  if (userIds.length) {
    await db.notification.createMany({
      data: userIds.map((userId) => ({ userId, title: parsed.data.title, body: parsed.data.body })),
    });
  }

  await audit(session, "CREATE", "Notification", undefined, { recipients: userIds.length, groupId });
  redirect(`/admin/notifications?sent=${userIds.length}`);
}
