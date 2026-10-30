import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const MAX_TOKENS = 5;

export function searchTokens(q?: string | null): string[] {
  return (q ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS);
}

export async function studentSearchWhere(q: string | undefined | null, schoolId: number): Promise<Prisma.StudentWhereInput> {
  const tokens = searchTokens(q);
  if (!tokens.length) return {};

  const conditions = tokens.map((token) => {
    const like = `%${token.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return Prisma.sql`(
      unaccent(s."firstName") ILIKE unaccent(${like})
      OR unaccent(s."lastName") ILIKE unaccent(${like})
      OR unaccent(COALESCE(s."parentName", '')) ILIKE unaccent(${like})
      OR EXISTS (
        SELECT 1 FROM "Enrollment" e
        JOIN "Group" g ON g.id = e."groupId"
        LEFT JOIN "Specialty" sp ON sp.id = g."specialtyId"
        WHERE e."studentId" = s.id
          AND (unaccent(g.name) ILIKE unaccent(${like}) OR unaccent(COALESCE(sp.name, '')) ILIKE unaccent(${like}))
      )
    )`;
  });

  const rows = await db.$queryRaw<{ id: number }[]>`
    SELECT s.id FROM "Student" s
    WHERE s."schoolId" = ${schoolId} AND s.archived = false AND ${Prisma.join(conditions, " AND ")}
  `;

  return { id: { in: rows.map((r) => r.id) } };
}
