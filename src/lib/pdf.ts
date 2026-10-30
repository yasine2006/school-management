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
  doc.setDrawColor(230, 235, 243).line(14, 34, doc.internal.pageSize.getWidth() - 14, 34);
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

  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...BLUE).text("REÇU DE PAIEMENT", 14, 46);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 72, 95);
  doc.text(`N° ${d.receiptNo}`, w - 14, 42, { align: "right" });
  doc.text(`Date : ${formatDate(d.paidAt)}`, w - 14, 48, { align: "right" });

  autoTable(doc, {
    startY: 54,
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
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60, 72, 95).text(`Élève : ${d.student} · Mois : ${formatMonth(d.month)} · ${d.method}`, 14, y);
  const y2 = y + 8;
  doc.setFillColor(239, 245, 255).roundedRect(14, y2, 84, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...NAVY).text(`Montant reçu : ${formatDH(d.amount)}`, 18, y2 + 9);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 122, 147).text("Reste à payer : " + formatDH(Math.max(d.due - d.paidTotal, 0)), 104, y2 + 9);
  doc.text("Cachet et signature", w - 14, y2 + 9, { align: "right" });
  return out(doc);
}

export function tablePdf(d: { school: School; title: string; subtitle?: string; head: string[]; body: string[][] }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, d.school);
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...NAVY).text(d.title, 14, 46);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 122, 147);
  doc.text([d.subtitle, `Généré le ${formatDate(new Date())}`].filter(Boolean).join("  ·  "), 14, 52);

  autoTable(doc, {
    startY: 58,
    head: [d.head],
    body: d.body,
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: [15, 27, 51] },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    didDrawPage: () => {
      const pages = doc.getNumberOfPages();
      doc.setFontSize(8).setTextColor(150).text(`Page ${pages}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    },
  });
  return out(doc);
}
