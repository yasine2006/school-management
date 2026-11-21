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

  // ── 2. Élèves non payés / Impayés (Unpaid) ───────────────────────────────────
  // Monthly by default (aligned with the Relances page): current month only.
  // Uses the same scope as Relances — ACTIVE students with an ACTIVE enrollment —
  // and includes students without an invoice (MISSING, with expected amount) so
  // the KPIs match the "Reste à encaisser" card exactly.
  if (type === "unpaid") {
    const asOfParam = sp.get("asOf") || sp.get("to");
    const asOfDate = parseDay(asOfParam, true) ?? new Date();

    const fromParam = sp.get("since") || sp.get("from");
    const fromDay = parseDay(fromParam);

    const monthsParam = sp.get("months") ?? "1";

    // Upper bound month: 1st of the month of the asOfDate
    const maxMonth = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1));

    // Lower bound month: current month unless the admin explicitly widens it
    let minMonth: Date | undefined;
    if (fromDay) {
      minMonth = new Date(Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), 1));
    } else if (monthsParam === "2") {
      minMonth = new Date(Date.UTC(maxMonth.getUTCFullYear(), maxMonth.getUTCMonth() - 1, 1));
    } else if (monthsParam === "3") {
      minMonth = new Date(Date.UTC(maxMonth.getUTCFullYear(), maxMonth.getUTCMonth() - 2, 1));
    } else if (monthsParam === "year") {
      // Full current year: January 1st of the selected year → asOf month
      minMonth = new Date(Date.UTC(maxMonth.getUTCFullYear(), 0, 1));
    } else if (monthsParam === "all") {
      minMonth = undefined; // all past months
    } else {
      // Default: current month only (par mois, comme la page Relances)
      minMonth = maxMonth;
    }

    // Same student scope as the Relances page: active students with active enrollments.
    const students = await db.student.findMany({
      where: {
        schoolId,
        archived: false,
        status: "ACTIVE",
        enrollments: { some: { status: "ACTIVE" } },
        ...(await studentSearchWhere(q, schoolId)),
        ...(groupId || specialtyId
          ? {
              enrollments: {
                some: {
                  status: "ACTIVE",
                  ...(groupId ? { groupId } : {}),
                  ...(specialtyId ? { group: { specialtyId } } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        enrollments: { where: { status: "ACTIVE" }, include: { group: true } },
        invoices: {
          where: {
            month: { ...(minMonth ? { gte: minMonth } : {}), lte: maxMonth },
            ...(groupId ? { lines: { some: { enrollment: { groupId } } } } : {}),
          },
          include: {
            lines: { include: { enrollment: { include: { group: true } } } },
            payments: { orderBy: { paidAt: "desc" } },
          },
          orderBy: [{ month: "desc" }],
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const DAY = 86_400_000;

    // Business rule: an invoice is never due before enrollment + 5 days,
    // even if its stored dueDate is the 5th of the month (older invoices).
    const effectiveDue = (baseDue: Date, enrollments: { startedAt: Date }[]) => {
      if (!enrollments.length) return baseDue;
      const firstStart = enrollments.reduce(
        (min, e) => (e.startedAt.getTime() < min.getTime() ? e.startedAt : min),
        enrollments[0].startedAt,
      );
      const afterEnrollment = new Date(firstStart.getTime() + 5 * DAY);
      return afterEnrollment > baseDue ? afterEnrollment : baseDue;
    };

    const fallbackDue = new Date(Date.UTC(maxMonth.getUTCFullYear(), maxMonth.getUTCMonth(), 5));

    type UnpaidEntry = {
      studentId: number;
      name: string;
      regDate: string;
      phone: string;
      group: string;
      month: Date;
      dueDate: Date;
      lateDays: number;
      due: number;
      paid: number;
      remaining: number;
      statusLabel: string;
      lastPayment: string;
    };

    const entries: UnpaidEntry[] = [];
    for (const s of students) {
      const expected = s.enrollments.reduce((sum, e) => sum + Number(e.monthlyFee.toString()), 0);
      const allGroups = Array.from(new Set(s.enrollments.map((e) => e.group.name))).join(", ") || "—";
      const regDate = s.registeredAt ? formatDate(s.registeredAt) : "—";
      const phone = s.parentPhone ?? s.parentEmail ?? "—";
      const unpaidInvoices = s.invoices.filter((i) => invoiceStatus(i) !== "PAID");

      if (!unpaidInvoices.length) {
        // No invoice in the window → MISSING, counted with expected amount (like Relances),
        // but ONLY once the enrollment + 5 days grace period has actually elapsed.
        if (!s.invoices.length && expected > 0) {
          const due = effectiveDue(fallbackDue, s.enrollments);
          if (due.getTime() <= asOfDate.getTime()) {
            const lateDays = Math.floor((asOfDate.getTime() - due.getTime()) / DAY);
            entries.push({
              studentId: s.id,
              name: `${s.lastName} ${s.firstName}`,
              regDate,
              phone,
              group: allGroups,
              month: maxMonth,
              dueDate: due,
              lateDays,
              due: expected,
              paid: 0,
              remaining: expected,
              statusLabel: "Sans facture",
              lastPayment: "Aucun",
            });
          }
        }
        continue;
      }

      for (const i of unpaidInvoices) {
        const t = invoiceTotals(i);
        const status = invoiceStatus(i);
        const due = effectiveDue(i.dueDate, s.enrollments);
        const lateDays = Math.floor((asOfDate.getTime() - due.getTime()) / DAY);
        const subjectOrGroup =
          i.lines.map((l) => l.enrollment?.group?.name ?? l.label).filter(Boolean).join(", ") || allGroups;
        const lastPayment = i.payments[0];
        entries.push({
          studentId: s.id,
          name: `${s.lastName} ${s.firstName}`,
          regDate,
          phone,
          group: subjectOrGroup,
          month: i.month,
          dueDate: due,
          lateDays,
          due: t.due,
          paid: t.paid,
          remaining: t.remaining,
          statusLabel: statusMeta[status].label,
          lastPayment: lastPayment ? formatDate(lastPayment.paidAt) : "Aucun",
        });
      }
    }

    entries.sort((a, b) => {
      const diff = a.name.localeCompare(b.name);
      if (diff !== 0) return diff;
      return a.month.getTime() - b.month.getTime();
    });

    let sumDue = 0;
    let sumPaid = 0;
    let sumRemaining = 0;
    let lateCount = 0;

    const rows = entries.map((e) => {
      if (e.lateDays > 0) lateCount++;
      sumDue += e.due;
      sumPaid += e.paid;
      sumRemaining += e.remaining;

      const delayLabel =
        e.lateDays > 0
          ? `${e.lateDays} j`
          : e.lateDays === 0
            ? "Aujourd'hui"
            : `Non échu (${Math.abs(e.lateDays)} j)`;

      return [
        e.name,
        e.regDate,
        e.phone,
        e.group,
        formatMonth(e.month),
        formatDate(e.dueDate),
        delayLabel,
        e.due,
        e.paid,
        e.remaining,
        e.statusLabel,
        e.lastPayment,
      ];
    });

    const recoveryRate = sumDue > 0 ? Math.round((sumPaid / sumDue) * 1000) / 10 : 0;
    const uniqueStudents = new Set(entries.filter((e) => e.remaining > 0).map((e) => e.studentId)).size;

    const windowText =
      monthsParam === "all"
        ? "Historique cumulatif inclus"
        : monthsParam === "year"
          ? `Année ${maxMonth.getUTCFullYear()} (depuis janvier)`
          : monthsParam === "2"
            ? `2 derniers mois (depuis ${formatMonth(minMonth!)})`
            : monthsParam === "3"
              ? `3 derniers mois (depuis ${formatMonth(minMonth!)})`
              : `Mois sélectionné (${formatMonth(maxMonth)})`;

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
