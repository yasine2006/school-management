import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { buildDataset } from "@/lib/reports";

/** Lightweight JSON preview used by the report builder (8 first rows + total count). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "ADMIN") return Response.json({ error: "Interdit" }, { status: 403 });

  const ds = await buildDataset(session.schoolId, req.nextUrl.searchParams);
  return Response.json(
    {
      title: ds.title,
      subtitle: ds.subtitle ?? null,
      head: ds.head,
      rows: ds.rows.slice(0, 8),
      total: ds.rows.length,
      money: ds.money,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
