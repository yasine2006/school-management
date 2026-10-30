import "server-only";
import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";

/** Who did what, when. Call after every create / update / delete. */
export async function audit(
  s: SessionPayload,
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "PAYMENT" | "EXPORT",
  entity: string,
  entityId?: number,
  details?: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: {
      schoolId: s.schoolId,
      userId: s.userId,
      action,
      entity,
      entityId,
      details: details as object | undefined,
    },
  });
}
