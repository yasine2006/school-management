import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - startedAt,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return Response.json(
      { status: "degraded", db: "down", error: e?.message?.slice(0, 100), timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
