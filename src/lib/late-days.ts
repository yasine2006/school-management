/**
 * Règle métier partagée : le retard est calculé sur la DATE D'INSCRIPTION.
 *
 * - Aucun délai de grâce : inscription le 20/10 → 21/10 = 1 jour de retard.
 * - Le compte est le nombre de jours calendaires (UTC) écoulés depuis
 *   l'inscription, et il augmente d'un chaque jour (1, 2, 3, …).
 */
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Ancre de facturation = date d'inscription la plus ancienne. */
export function enrollmentAnchor(enrollments: { startedAt: Date }[]): Date | null {
  return enrollments.reduce<Date | null>((min, e) => (!min || e.startedAt < min ? e.startedAt : min), null);
}

/** Échéance = date d'inscription (le retard commence le lendemain). */
export function dueDateFromEnrollment(start: Date): Date {
  return startOfDay(start);
}

/** Jours de retard = jours calendaires depuis l'inscription (0 le jour même). */
export function lateDaysFromEnrollment(start: Date, asOf: Date): number {
  const days = Math.floor((startOfDay(asOf).getTime() - startOfDay(start).getTime()) / DAY);
  return days > 0 ? days : 0;
}
