import { db } from "@/lib/db";
import { firstOfMonth } from "@/lib/fees";
import { monthKey } from "@/lib/invoicing";
import { sendReminders } from "@/lib/reminders";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET non configuré" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const month = firstOfMonth();
  const schools = await db.school.findMany({ select: { id: true } });
  let sent = 0;
  const skipped = 0;

  for (const school of schools) {
    const count = await sendReminders(school.id, month, { onlyOverdue: true });
    sent += count;
  }

  return Response.json({ ok: true, month: monthKey(month), sent, skipped });
}

export async function GET() {
  return Response.json({ error: "Méthode non autorisée" }, { status: 405 });
}
