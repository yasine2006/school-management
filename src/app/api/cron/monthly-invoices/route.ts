import { NextResponse } from "next/server";
import { generateMissingInvoices, monthKey } from "@/lib/invoicing";

async function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const provided = bearer || (request.headers.get("x-cron-secret") ?? "").trim();
  return provided === secret ? secret : null;
}

/** Monthly invoicing hook: run it on the 1st of every month (crontab or platform cron). */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const generated = await generateMissingInvoices();
  return NextResponse.json({ ok: true, generated, month: monthKey(new Date()), at: new Date().toISOString() });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
