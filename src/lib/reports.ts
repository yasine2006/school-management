import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { studentSearchWhere } from "@/lib/search";
import { invoiceStatus, invoiceTotals, statusMeta } from "@/lib/fees";
import { formatDate, formatMonth } from "@/lib/format";

export type ReportSummary = {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  recoveryRate: number;
  totalCount: number;
  lateCount?: number;
  uniqueStudents?: number;
};

export type Dataset = {
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | number)[][];
  /** column indexes holding money amounts (formatted as DH in PDF, kept numeric in Excel) */
  money: number[];
  slug: string;
  summary?: ReportSummary;
};

const parseDay = (v: string | null, end = false) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z`) : undefined;

const range = (from?: Date, to?: Date) =>
  from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

const periodLabel = (sp: URLSearchParams) => {
  const f = sp.get("from");
  const t = sp.get("to");
  const asOf = sp.get("asOf");
  if (asOf) return `Arrêté au : ${formatDate(`${asOf}T00:00:00Z`)}`;
  if (f || t) {
    return `Période : ${f ? formatDate(`${f}T00:00:00Z`) : "Origine"} → ${t ? formatDate(`${t}T00:00:00Z`) : "Aujourd'hui"}`;
  }
  return undefined;
};

const methodLabel = (m: string) => (m === "CASH" ? "Espèces" : "Virement");

export async function buildDataset(schoolId: number, sp: URLSearchParams): Promise<Dataset> {
  const type = sp.get("type") ?? "students";
  const from = parseDay(sp.get("from"));
  const to = parseDay(sp.get("to"), true);
  const q = sp.get("q") || undefined;
  const groupId = Number(sp.get("groupId")) || undefined;
  const specialtyId = Number(sp.get("specialtyId")) || undefined;

  // Resolve group label for subtitles
  let groupLabel: string | undefined;
  if (groupId) {
    const grp = await db.group.findUnique({
      where: { id: groupId },
      select: { name: true, specialty: { select: { name: true } }, level: { select: { name: true } } },
    });
    if (grp) groupLabel = `Groupe : ${grp.name} (${grp.level.name})`;
  }

  const studentWhere: Prisma.StudentWhereInput = {
    schoolId,
    archived: false,
    ...(await studentSearchWhere(q, schoolId)),
    ...(groupId || specialtyId
      ? { enrollments: { some: { ...(groupId ? { groupId } : {}), ...(specialtyId ? { group: { specialtyId } } : {}) } } }
      : {}),
  };

  // ── 1. État des factures (Invoices) ──────────────────────────────────────────
  if (type === "invoices") {
    const status = sp.get("status");
    const unpaidOnly = sp.get("unpaid") === "1";

    const invoices = await db.invoice.findMany({
      where: {
        student: studentWhere,
        ...(range(from, to) ? { month: range(from, to) } : {}),
        ...(groupId ? { lines: { some: { enrollment: { groupId } } } } : {}),
      },
      include: {
        lines: { include: { enrollment: { include: { group: true } } } },
        payments: { orderBy: { paidAt: "desc" } },
        student: true,
      },
      orderBy: [{ month: "desc" }],
    });

    const now = new Date();
    const DAY = 86_400_000;

    const filtered = invoices.filter(
      (i) => (!status || invoiceStatus(i) === status) && (!unpaidOnly || invoiceStatus(i) !== "PAID"),
    );

    filtered.sort(
      (a, b) => b.month.getTime() - a.month.getTime() || a.student.lastName.localeCompare(b.student.lastName),
    );

    let sumDue = 0;
    let sumPaid = 0;
    let sumRemaining = 0;
    let lateCount = 0;

    const rows = filtered.map((i) => {
      const t = invoiceTotals(i);
      const st = invoiceStatus(i);
      const lateDays = Math.max(0, Math.floor((now.getTime() - i.dueDate.getTime()) / DAY));
      if (st !== "PAID" && lateDays > 0) lateCount++;

      sumDue += t.due;
      sumPaid += t.paid;
      sumRemaining += t.remaining;

      const groupNames = i.lines
        .map((l) => l.enrollment?.group?.name ?? l.label)
        .filter(Boolean)
        .join(", ");

      return [
        `${i.student.lastName} ${i.student.firstName}`,
        i.student.parentPhone ?? "—",
        groupNames || "—",
        formatMonth(i.month),
        formatDate(i.dueDate),
        st !== "PAID" && lateDays > 0 ? `${lateDays} j` : "—",
        t.due,
        t.paid,
        t.remaining,
        statusMeta[st].label,
      ];
    });

    const recoveryRate = sumDue > 0 ? Math.round((sumPaid / sumDue) * 1000) / 10 : 100;

    return {
      title: unpaidOnly ? "Factures impayées" : "État des paiements",
      subtitle: [groupLabel, periodLabel(sp), unpaidOnly ? "Factures avec solde restant dû" : undefined]
        .filter(Boolean)
        .join(" · ") || undefined,
      head: ["Élève", "Téléphone", "Groupe(s)", "Mois", "Échéance", "Retard", "Dû", "Payé", "Reste", "Statut"],
      rows,
      money: [6, 7, 8],
      slug: unpaidOnly ? "factures-impayees" : "etat-des-factures",
      summary: {
        totalDue: sumDue,
        totalPaid: sumPaid,
        totalRemaining: sumRemaining,
        recoveryRate,
        totalCount: rows.length,
        lateCount,
        uniqueStudents: new Set(filtered.map((i) => i.studentId)).size,
      },
    };
  }

  // ── 2. Élèves non payés / Impayés cumulés (Unpaid) ───────────────────────────
  // Business rule: Shows unpaid students up to a cut-off date (asOf/to).
  // Window: By default the FULL history is included so all unpaid students appear.
  // Admins may explicitly narrow the window via `months` (1, 2, 3) or `since`/`from`.
  if (type === "unpaid") {
    const asOfParam = sp.get("asOf") || sp.get("to");
    const asOfDate = parseDay(asOfParam, true) ?? new Date();

    const fromParam = sp.get("since") || sp.get("from");
    const fromDay = parseDay(fromParam);

    const monthsParam = sp.get("months") ?? "all";

    // Upper bound month: 1st of the month of the asOfDate
    const maxMonth = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1));

    // Lower bound month: full history unless the admin explicitly narrows it
    let minMonth: Date | undefined;
    if (fromDay) {
      minMonth = new Date(Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), 1));
    } else if (monthsParam === "1") {
      minMonth = maxMonth;
    } else if (monthsParam === "2") {
      minMonth = new Date(Date.UTC(maxMonth.getUTCFullYear(), maxMonth.getUTCMonth() - 1, 1));
    } else if (monthsParam === "3") {
      minMonth = new Date(Date.UTC(maxMonth.getUTCFullYear(), maxMonth.getUTCMonth() - 2, 1));
    } else {
      // Default: all past months (no lower bound)
      minMonth = undefined;
    }

    const invoices = await db.invoice.findMany({
      where: {
        student: studentWhere,
        month: {
          ...(minMonth ? { gte: minMonth } : {}),
          lte: maxMonth,
        },
        ...(groupId ? { lines: { some: { enrollment: { groupId } } } } : {}),
      },
      include: {
        lines: { include: { enrollment: { include: { group: true } } } },
        payments: { orderBy: { paidAt: "desc" } },
        student: true,
      },
      orderBy: [{ month: "desc" }],
    });

    const DAY = 86_400_000;
    const unpaidInvoices = invoices.filter((i) => invoiceStatus(i) !== "PAID");

    unpaidInvoices.sort((a, b) => {
      const diff = a.student.lastName.localeCompare(b.student.lastName);
      if (diff !== 0) return diff;
      return a.month.getTime() - b.month.getTime();
    });

    let sumDue = 0;
    let sumPaid = 0;
    let sumRemaining = 0;
    let lateCount = 0;

    const rows = unpaidInvoices.map((i) => {
      const t = invoiceTotals(i);
      const status = invoiceStatus(i);

      // Delay measured against the cut-off date
      const diffMs = asOfDate.getTime() - i.dueDate.getTime();
      const lateDays = Math.floor(diffMs / DAY);

      if (lateDays > 0) lateCount++;

      sumDue += t.due;
      sumPaid += t.paid;
      sumRemaining += t.remaining;

      const lastPayment = i.payments[0];
      const regDate = i.student.registeredAt ? formatDate(i.student.registeredAt) : "—";

      const subjectOrGroup = i.lines
        .map((l) => l.enrollment?.group?.name ?? l.label)
        .filter(Boolean)
        .join(", ");

      const delayLabel =
        lateDays > 0
          ? `${lateDays} j`
          : lateDays === 0
            ? "Aujourd'hui"
            : `Non échu (${Math.abs(lateDays)} j)`;

      return [
        `${i.student.lastName} ${i.student.firstName}`,
        regDate,
        i.student.parentPhone ?? i.student.parentEmail ?? "—",
        subjectOrGroup || "—",
        formatMonth(i.month),
        formatDate(i.dueDate),
        delayLabel,
        t.due,
        t.paid,
        t.remaining,
        statusMeta[status].label,
        lastPayment ? formatDate(lastPayment.paidAt) : "Aucun",
      ];
    });

    const recoveryRate = sumDue > 0 ? Math.round((sumPaid / sumDue) * 1000) / 10 : 0;
    const uniqueStudents = new Set(unpaidInvoices.map((i) => i.studentId)).size;

    const windowText = minMonth
      ? minMonth.getTime() === maxMonth.getTime()
        ? `Mois de ${formatMonth(maxMonth)} uniquement`
        : `2 mois max (${formatMonth(minMonth)} & ${formatMonth(maxMonth)})`
      : "Tout l'historique";

    return {
      title: "Élèves non payés & impayés récents",
      subtitle: [
        groupLabel,
        `Arrêté au ${formatDate(asOfDate)}`,
        windowText,
        `${uniqueStudents} élève(s) avec solde impayé`,
      ]
        .filter(Boolean)
        .join(" · "),
      head: [
        "Élève",
        "Inscrit le",
        "Téléphone parent",
        "Groupe / Matières",
        "Mois impayé",
        "Échéance",
        "Retard",
        "Dû",
        "Payé",
        "Reste",
        "Statut",
        "Dernier paiement",
      ],
      rows,
      money: [7, 8, 9],
      slug: "eleves-non-payes",
      summary: {
        totalDue: sumDue,
        totalPaid: sumPaid,
        totalRemaining: sumRemaining,
        recoveryRate,
        totalCount: rows.length,
        lateCount,
        uniqueStudents,
      },
    };
  }

  // ── 3. Reçus & Encaissements (Receipts) ───────────────────────────────────────
  if (type === "receipts") {
    const payments = await db.payment.findMany({
      where: {
        invoice: {
          student: studentWhere,
          ...(groupId ? { lines: { some: { enrollment: { groupId } } } } : {}),
        },
        ...(range(from, to) ? { paidAt: range(from, to) } : {}),
      },
      include: {
        invoice: {
          include: {
            student: true,
            lines: { include: { enrollment: { include: { group: true } } } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    let totalAmount = 0;
    const rows = payments.map((p) => {
      const amt = Number(p.amount.toString());
      totalAmount += amt;
      const groupName =
        p.invoice.lines.map((l) => l.enrollment?.group?.name ?? l.label).join(", ") || "—";

      return [
        p.receiptNo ?? `#${p.id}`,
        formatDate(p.paidAt),
        `${p.invoice.student.lastName} ${p.invoice.student.firstName}`,
        groupName,
        formatMonth(p.invoice.month),
        amt,
        methodLabel(p.method),
      ];
    });

    return {
      title: "Reçus de paiement & Encaissements",
      subtitle: [groupLabel, periodLabel(sp)].filter(Boolean).join(" · ") || undefined,
      head: ["N° reçu", "Date paiement", "Élève", "Groupe", "Mois", "Montant", "Mode"],
      rows,
      money: [5],
      slug: "recus-de-paiement",
      summary: {
        totalDue: totalAmount,
        totalPaid: totalAmount,
        totalRemaining: 0,
        recoveryRate: 100,
        totalCount: rows.length,
        uniqueStudents: new Set(payments.map((p) => p.invoice.studentId)).size,
      },
    };
  }

  // ── 4. Liste des Inscriptions (Enrollments) ──────────────────────────────────
  if (type === "enrollments") {
    const enrollments = await db.enrollment.findMany({
      where: {
        student: studentWhere,
        ...(groupId ? { groupId } : {}),
        ...(range(from, to) ? { startedAt: range(from, to) } : {}),
      },
      include: {
        group: { include: { specialty: true, level: true, teacher: true } },
        student: true,
      },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    });

    let sumFees = 0;
    const rows = enrollments.map((e) => {
      const fee = Number(e.monthlyFee.toString());
      if (e.status === "ACTIVE") sumFees += fee;
      return [
        `${e.student.lastName} ${e.student.firstName}`,
        e.group.name,
        e.group.specialty.name,
        e.group.level.name,
        e.group.teacher?.name ?? "—",
        formatDate(e.startedAt),
        fee,
        e.status === "ACTIVE" ? "Active" : "Arrêtée",
      ];
    });

    const activeCount = enrollments.filter((e) => e.status === "ACTIVE").length;

    return {
      title: "Liste des inscriptions par groupe",
      subtitle: [groupLabel, periodLabel(sp)].filter(Boolean).join(" · ") || undefined,
      head: ["Élève", "Groupe", "Matière", "Niveau", "Enseignant", "Date début", "Mensualité", "Statut"],
      rows,
      money: [6],
      slug: "liste-des-inscriptions",
      summary: {
        totalDue: sumFees,
        totalPaid: sumFees,
        totalRemaining: 0,
        recoveryRate: 100,
        totalCount: rows.length,
        uniqueStudents: new Set(enrollments.map((e) => e.studentId)).size,
        lateCount: enrollments.length - activeCount,
      },
    };
  }

  // ── 5. Liste des Élèves (Students) ───────────────────────────────────────────
  const cols = new Set((sp.get("cols") ?? "groups,phone,status").split(","));
  const students = await db.student.findMany({
    where: {
      ...studentWhere,
      ...(range(from, to) ? { registeredAt: range(from, to) } : {}),
      ...(groupId ? { enrollments: { some: { groupId } } } : {}),
    },
    include: {
      enrollments: {
        include: { group: { include: { specialty: true, level: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const stLabel = { ACTIVE: "Actif", PENDING: "En attente", INACTIVE: "Inactif" } as const;

  const head = ["Nom complet", "Date inscription"];
  if (cols.has("groups")) head.push("Matières", "Niveaux");
  if (cols.has("phone")) head.push("Parent", "Téléphone");
  if (cols.has("status")) head.push("Statut");

  const rows = students.map((s) => {
    const row: (string | number)[] = [
      `${s.lastName} ${s.firstName}`,
      s.registeredAt ? formatDate(s.registeredAt) : "—",
    ];
    if (cols.has("groups")) {
      const activeEnrollments = s.enrollments.filter((e) => e.status === "ACTIVE");
      row.push(
        activeEnrollments.map((e) => e.group.specialty.name).join(", ") || "—",
        [...new Set(activeEnrollments.map((e) => e.group.level.name))].join(", ") || "—",
      );
    }
    if (cols.has("phone")) row.push(s.parentName ?? "—", s.parentPhone ?? "—");
    if (cols.has("status")) row.push(stLabel[s.status]);
    return row;
  });

  return {
    title: "Liste des élèves",
    subtitle: [groupLabel, periodLabel(sp)].filter(Boolean).join(" · ") || undefined,
    head,
    rows,
    money: [],
    slug: "liste-des-eleves",
    summary: {
      totalDue: 0,
      totalPaid: 0,
      totalRemaining: 0,
      recoveryRate: 100,
      totalCount: rows.length,
      uniqueStudents: rows.length,
    },
  };
}
