import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/session";
import { buildDataset } from "@/lib/reports";
import { tablePdf } from "@/lib/pdf";
import { formatDH } from "@/lib/format";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Non authentifié", { status: 401 });
  if (session.role !== "ADMIN") return new Response("Interdit", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "pdf" ? "pdf" : "xlsx";
  const ds = await buildDataset(session.schoolId, sp);
  const filename = `${ds.slug}-${new Date().toISOString().slice(0, 10)}.${format}`;
  const headers = (type: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  });

  await audit(session, "EXPORT", "Report", undefined, { type: sp.get("type") ?? "students", format, rows: ds.rows.length });

  if (format === "pdf") {
    const school = await db.school.findUniqueOrThrow({ where: { id: session.schoolId } });
    const money = new Set(ds.money);
    const pdf = tablePdf({
      school,
      title: ds.title,
      subtitle: ds.subtitle,
      head: ds.head,
      body: ds.rows.map((r) => r.map((v, i) => (money.has(i) ? formatDH(Number(v)) : String(v)))),
    });
    return new Response(new Uint8Array(pdf), { headers: headers("application/pdf") });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(ds.title.slice(0, 31));
  ws.addRow(ds.head);
  ds.rows.forEach((r) => ws.addRow(r));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1B3B" } };
  ws.columns.forEach((col, i) => {
    const longest = Math.max(ds.head[i]!.length, ...ds.rows.map((r) => String(r[i] ?? "").length));
    col.width = Math.min(Math.max(longest + 3, 10), 40);
    if (ds.money.includes(i)) col.numFmt = '#,##0.00 "DH"';
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  });
}
