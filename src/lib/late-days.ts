/**
 * Règle métier partagée : le retard est calculé sur la DATE D'INSCRIPTION (cycle mensuel).
 *
 * - Aucun délai de grâce : si l'échéance mensuelle est le 15, le 16 = 1 jour de retard.
 * - Pour chaque mois de facturation, l'échéance (« fin du mois d'inscription »)
 *   correspond au jour du mois de l'inscription (ex. inscrit le 15/10 -> échéance le 15/11 en novembre).
 * - Le retard est compté en jours calendaires (UTC) écoulés depuis cette échéance mensuelle.
 */
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Ancre de facturation = date d'inscription la plus ancienne. */
export function enrollmentAnchor(enrollments: { startedAt: Date }[]): Date | null {
  return enrollments.reduce<Date | null>((min, e) => (!min || e.startedAt < min ? e.startedAt : min), null);
}

/** Échéance brute = date d'inscription. */
export function dueDateFromEnrollment(start: Date): Date {
  return startOfDay(start);
}

/**
 * Date d'échéance mensuelle (« fin du mois d'inscription ») pour un mois de facturation donné.
 * Si l'élève s'est inscrit le jour J (ex. 12 du mois) :
 * - Dans le mois de facturation M, l'échéance est le jour J de ce mois (ou le dernier jour si le mois est plus court).
 */
export function monthlyDueDate(start: Date, month: Date): Date {
  const year = month.getUTCFullYear();
  const m = month.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const startDay = start.getUTCDate();
  const dueDay = Math.min(startDay, daysInMonth);
  return new Date(Date.UTC(year, m, dueDay));
}

/**
 * Vérifie si l'échéance mensuelle (« fin du mois d'inscription ») est échue à ce jour (asOf).
 * Ex. aujourd'hui le 22 : tout élève dont l'échéance est <= 22 dans ce mois est échu.
 */
export function isDueAsOf(start: Date, month: Date, asOf = new Date()): boolean {
  const due = monthlyDueDate(start, month);
  return startOfDay(asOf).getTime() >= startOfDay(due).getTime();
}

/**
 * Jours de retard pour un mois donné par rapport à la date de référence (asOf).
 * 0 si l'échéance n'est pas encore passée.
 */
export function lateDaysForMonth(start: Date, month: Date, asOf = new Date()): number {
  const due = monthlyDueDate(start, month);
  const days = Math.floor((startOfDay(asOf).getTime() - startOfDay(due).getTime()) / DAY);
  return days > 0 ? days : 0;
}

/** Jours de retard = jours calendaires depuis l'inscription (0 le jour même). */
export function lateDaysFromEnrollment(start: Date, asOf: Date): number {
  const days = Math.floor((startOfDay(asOf).getTime() - startOfDay(start).getTime()) / DAY);
  return days > 0 ? days : 0;
}
