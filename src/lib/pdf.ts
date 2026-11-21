import "server-only";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatDH, formatMonth } from "@/lib/format";

type School = { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null };

const NAVY: [number, number, number] = [11, 27, 59];
const BLUE: [number, number, number] = [31, 90, 240];

function header(doc: jsPDF, school: School) {
  let x = 14;
  if (school.logo?.startsWith("data:image/")) {
    try {
      const fmt = school.logo.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(school.logo, fmt, 14, 12, 18, 18);
      x = 36;
    } catch {
      /* unreadable logo: skip it */
    }
  }
  doc.setTextColor(...NAVY).setFont("helvetica", "bold").setFontSize(16).text(school.name, x, 20);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 116, 139);
  const line = [school.address, school.phone, school.email].filter(Boolean).join("  ·  ");
  if (line) doc.text(line, x, 26);
  doc.setDrawColor(230, 235, 243).line(14, 32, doc.internal.pageSize.getWidth() - 14, 32);
}

const out = (doc: jsPDF) => Buffer.from(doc.output("arraybuffer"));

export function receiptPdf(d: {
  school: School;
  receiptNo: string;
  paidAt: Date;
  student: string;
  month: Date;
  lines: { label: string; amount: number }[];
  amount: number;
  method: string;
  due: number;
  paidTotal: number;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();
  header(doc, d.school);

  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...BLUE).text("REÇU DE PAIEMENT", 14, 44);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 72, 95);
  doc.text(`N° ${d.receiptNo}`, w - 14, 40, { align: "right" });
  doc.text(`Date : ${formatDate(d.paidAt)}`, w - 14, 46, { align: "right" });

  autoTable(doc, {
    startY: 52,
    theme: "striped",
    styles: { fontSize: 9.5, cellPadding: 1.8, textColor: [15, 27, 51] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 34 } },
    head: [["Matière", "Montant"]],
    body: [
      ...d.lines.map((l) => [l.label, formatDH(l.amount)]),
      ...(d.lines.length > 1 ? [["Total du mois", formatDH(d.due)]] : []),
    ],
    foot: [["Total payé à ce jour", formatDH(d.paidTotal)]],
    footStyles: { fillColor: [239, 245, 255], textColor: [15, 27, 51], fontStyle: "bold", halign: "right" },
  });

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 72, 95).text(
    `Élève : ${d.student} · Mois : ${formatMonth(d.month)} · ${d.method}`,
    14,
    y,
  );
  const y2 = y + 8;
  doc.setFillColor(239, 245, 255).roundedRect(14, y2, 84, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...NAVY).text(`Montant reçu : ${formatDH(d.amount)}`, 18, y2 + 9);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 122, 147).text(
    "Reste à payer : " + formatDH(Math.max(d.due - d.paidTotal, 0)),
    104,
    y2 + 9,
  );
  doc.text("Cachet et signature", w - 14, y2 + 9, { align: "right" });
  return out(doc);
}

export function tablePdf(d: {
  school: School;
  title: string;
  subtitle?: string;
  head: string[];
  body: string[][];
  landscape?: boolean;
  kpis?: { label: string; value: string }[];
}) {
  const isLandscape = d.landscape ?? d.head.length > 6;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: isLandscape ? "landscape" : "portrait" });
  const w = doc.internal.pageSize.getWidth();

  header(doc, d.school);

  // Title
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...NAVY).text(d.title, 14, 42);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(107, 122, 147);
  const sub = [d.subtitle, `Édité le ${formatDate(new Date())}`].filter(Boolean).join("  ·  ");
  doc.text(sub, 14, 48);

  let startTableY = 54;

  // Optional KPI cards banner
  if (d.kpis && d.kpis.length > 0) {
    const boxW = Math.min(54, (w - 28 - (d.kpis.length - 1) * 3) / d.kpis.length);
    let curX = 14;
    for (const k of d.kpis) {
      doc.setFillColor(243, 246, 251).roundedRect(curX, 52, boxW, 13, 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100, 116, 139).text(k.label, curX + 3, 56.5);
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY).text(k.value, curX + 3, 62);
      curX += boxW + 3;
    }
    startTableY = 69;
  }

  autoTable(doc, {
    startY: startTableY,
    head: [d.head],
    body: d.body,
    theme: "striped",
    styles: {
      fontSize: isLandscape ? 8 : 7.5,
      cellPadding: isLandscape ? 2 : 1.8,
      textColor: [15, 27, 51],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: "bold",
      fontSize: isLandscape ? 8.5 : 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14, bottom: 15 },
    didDrawPage: () => {
      const pages = doc.getNumberOfPages();
      doc.setFontSize(8).setTextColor(140);
      doc.text(
        `${d.school.name}  ·  Rapport confidentiel`,
        14,
        doc.internal.pageSize.getHeight() - 8,
      );
      doc.text(
        `Page ${pages}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: "right" },
      );
    },
  });

  return out(doc);
}
