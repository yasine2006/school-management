import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { studentSearchWhere } from "@/lib/search";
import { invoiceStatus, invoiceTotals, statusMeta } from "@/lib/fees";
import { formatDate, formatMonth } from "@/lib/format";

export type Dataset = {
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | number)[][];
  /** column indexes holding money amounts (formatted as DH in PDF, kept numeric in Excel) */
  money: number[];
  slug: string;
};

const parseDay = (v: string | null, end = false) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z`) : undefined;

const range = (from?: Date, to?: Date) => (from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined);

const periodLabel = (sp: URLSearchParams) => {
  const f = sp.get("from");
  const t = sp.get("to");
  return f || t ? `Période : ${f ? formatDate(`${f}T00:00:00Z`) : "…"} → ${t ? formatDate(`${t}T00:00:00Z`) : "…"}` : undefined;
};

const methodLabel = (m: string) => (m === "CASH" ? "Cash" : "Virement");

export async function buildDataset(schoolId: number, sp: URLSearchParams): Promise<Dataset> {
  const type = sp.get("type") ?? "students";
  const from = parseDay(sp.get("from"));
  const to = parseDay(sp.get("to"), true);
  const q = sp.get("q") || undefined;
  const groupId = Number(sp.get("groupId")) || undefined;
  const specialtyId = Number(sp.get("specialtyId")) || undefined;

  const studentWhere: Prisma.StudentWhereInput = {
    schoolId,
    archived: false,
    ...(await studentSearchWhere(q, schoolId)),
    ...(groupId || specialtyId
      ? { enrollments: { some: { ...(groupId ? { groupId } : {}), ...(specialtyId ? { group: { specialtyId } } : {}) } } }
      : {}),
  };

  if (type === "invoices") {
    const status = sp.get("status");
    const unpaidOnly = sp.get("unpaid") === "1";
    const invoices = await db.invoice.findMany({
      where: {
        student: studentWhere,
        ...(range(from, to) ? { month: range(from, to) } : {}),
      },
      include: { lines: true, payments: { orderBy: { paidAt: "desc" } }, student: true },
      orderBy: [{ month: "desc" }],
    });

    const rows = invoices
      .filter((i) => (!status || invoiceStatus(i) === status) && (!unpaidOnly || invoiceStatus(i) !== "PAID"))
      .sort((a, b) => b.month.getTime() - a.month.getTime() || a.student.lastName.localeCompare(b.student.lastName))
      .map((i) => {
        const t = invoiceTotals(i);
        return [
          `${i.student.lastName} ${i.student.firstName}`,
          i.lines.map((l) => l.label).join(", "),
          formatMonth(i.month),
          t.due,
          t.paid,
          t.remaining,
          statusMeta[invoiceStatus(i)].label,
        ];
      });

    return {
      title: unpaidOnly ? "Factures impayées" : "État des factures",
      subtitle: [periodLabel(sp), unpaidOnly ? "Factures non totalement payées" : undefined].filter(Boolean).join(" · ") || undefined,
      head: ["Élève", "Matières", "Mois", "Dû", "Payé", "Reste", "Statut"],
      rows,
      money: [3, 4, 5],
      slug: unpaidOnly ? "factures-impayees" : "etat-des-factures",
    };
  }

  if (type === "receipts") {
    const payments = await db.payment.findMany({
      where: { invoice: { student: studentWhere }, ...(range(from, to) ? { paidAt: range(from, to) } : {}) },
      include: { invoice: { include: { student: true } } },
      orderBy: { paidAt: "desc" },
    });
    return {
      title: "Reçus de paiement",
      subtitle: periodLabel(sp),
      head: ["N° reçu", "Date", "Élève", "Mois", "Montant", "Mode"],
      rows: payments.map((p) => [
        p.receiptNo ?? `#${p.id}`,
        formatDate(p.paidAt),
        `${p.invoice.student.lastName} ${p.invoice.student.firstName}`,
        formatMonth(p.invoice.month),
        Number(p.amount.toString()),
        methodLabel(p.method),
      ]),
      money: [4],
      slug: "recus",
    };
  }

  if (type === "enrollments") {
    const enrollments = await db.enrollment.findMany({
      where: { student: studentWhere, ...(range(from, to) ? { startedAt: range(from, to) } : {}) },
      include: { group: { include: { specialty: true, level: true, teacher: true } }, student: true },
      orderBy: [{ status: "asc" }],
    });
    return {
      title: "Liste des inscriptions",
      subtitle: periodLabel(sp),
      head: ["Élève", "Groupe", "Matière", "Niveau", "Enseignant", "Mensualité", "Statut"],
      rows: enrollments.map((e) => [
        `${e.student.lastName} ${e.student.firstName}`,
        e.group.name,
        e.group.specialty.name,
        e.group.level.name,
        e.group.teacher?.name ?? "—",
        Number(e.monthlyFee.toString()),
        e.status === "ACTIVE" ? "Active" : "Arrêtée",
      ]),
      money: [5],
      slug: "liste-des-inscriptions",
    };
  }

  // students
  const cols = new Set((sp.get("cols") ?? "groups,phone,status").split(","));
  const students = await db.student.findMany({
    where: { ...studentWhere, ...(range(from, to) ? { registeredAt: range(from, to) } : {}) },
    include: { enrollments: { include: { group: { include: { specialty: true, level: true } } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const stLabel = { ACTIVE: "Actif", PENDING: "En attente", INACTIVE: "Inactif" } as const;

  const head = ["Nom complet"];
  if (cols.has("groups")) head.push("Matières", "Niveaux");
  if (cols.has("phone")) head.push("Parent", "Téléphone");
  if (cols.has("status")) head.push("Statut");

  return {
    title: "Liste des élèves",
    subtitle: periodLabel(sp),
    head,
    rows: students.map((s) => {
      const row: (string | number)[] = [`${s.lastName} ${s.firstName}`];
      if (cols.has("groups")) {
        row.push(s.enrollments.map((e) => e.group.specialty.name).join(", ") || "—", [...new Set(s.enrollments.map((e) => e.group.level.name))].join(", ") || "—");
      }
      if (cols.has("phone")) row.push(s.parentName ?? "—", s.parentPhone ?? "—");
      if (cols.has("status")) row.push(stLabel[s.status]);
      return row;
    }),
    money: [],
    slug: "liste-des-eleves",
  };
}
