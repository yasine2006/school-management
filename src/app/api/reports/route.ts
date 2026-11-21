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

  await audit(session, "EXPORT", "Report", undefined, {
    type: sp.get("type") ?? "students",
    format,
    rows: ds.rows.length,
    groupId: sp.get("groupId") ?? undefined,
  });

  if (format === "pdf") {
    const school = await db.school.findUniqueOrThrow({ where: { id: session.schoolId } });
    const money = new Set(ds.money);

    const kpis =
      ds.summary && ds.summary.totalDue > 0
        ? [
            { label: "Total Dû", value: formatDH(ds.summary.totalDue) },
            { label: "Total Encaissé", value: formatDH(ds.summary.totalPaid) },
            { label: "Reste à Recouvrer", value: formatDH(ds.summary.totalRemaining) },
            { label: "Taux Recouvrement", value: `${ds.summary.recoveryRate}%` },
            { label: "Total Dossiers", value: `${ds.summary.totalCount}` },
          ]
        : undefined;

    const pdf = tablePdf({
      school,
      title: ds.title,
      subtitle: ds.subtitle,
      head: ds.head,
      body: ds.rows.map((r) => r.map((v, i) => (money.has(i) ? formatDH(Number(v)) : String(v)))),
      kpis,
    });
    return new Response(new Uint8Array(pdf), { headers: headers("application/pdf") });
  }

  // Excel Export
  const wb = new ExcelJS.Workbook();
  wb.creator = "Centre Excellence";
  wb.created = new Date();

  const ws = wb.addWorksheet(ds.title.slice(0, 31));

  // Title block in Excel
  ws.addRow([ds.title]);
  ws.getRow(1).font = { bold: true, size: 14, color: { argb: "FF071432" } };

  if (ds.subtitle) {
    ws.addRow([ds.subtitle]);
    ws.getRow(2).font = { italic: true, size: 9, color: { argb: "FF6B7A93" } };
  } else {
    ws.addRow([]);
  }

  // Optional summary KPIs in Excel
  if (ds.summary && ds.summary.totalDue > 0) {
    ws.addRow([
      `Total Dû: ${ds.summary.totalDue.toFixed(2)} DH`,
      `Total Encaissé: ${ds.summary.totalPaid.toFixed(2)} DH`,
      `Reste à Recouvrer: ${ds.summary.totalRemaining.toFixed(2)} DH`,
      `Recouvrement: ${ds.summary.recoveryRate}%`,
      `Lignes: ${ds.summary.totalCount}`,
    ]);
    const kpiRow = ws.getRow(3);
    kpiRow.font = { bold: true, size: 9.5, color: { argb: "FF071432" } };
    kpiRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBF1FD" } };
    ws.addRow([]); // empty row separator
  } else {
    ws.addRow([]);
  }

  // Header row index
  const headerRowIdx = ws.rowCount + 1;
  ws.addRow(ds.head);

  const header = ws.getRow(headerRowIdx);
  header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1B3B" } };
  header.alignment = { vertical: "middle" };

  // Data rows
  ds.rows.forEach((r, idx) => {
    const row = ws.addRow(r);
    if (idx % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }
  });

  // Formatting and auto-width
  ws.columns.forEach((col, i) => {
    const longest = Math.max(
      ds.head[i]?.length ?? 10,
      ...ds.rows.map((r) => String(r[i] ?? "").length),
    );
    col.width = Math.min(Math.max(longest + 4, 12), 40);
    if (ds.money.includes(i)) {
      col.numFmt = '#,##0.00 "DH"';
    }
  });

  // Freeze header row
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  });
}
