/**
 * Règle métier partagée : le retard est calculé sur la DATE D'INSCRIPTION.
 *
 * - Échéance affichée = inscription + 5 jours (délai de grâce).
 * - Aucun retard affiché pendant les 5 premiers jours.
 * - À partir du 6e jour, on affiche le nombre TOTAL de jours écoulés
 *   depuis l'inscription (6, 7, 8, …), et il augmente d'un chaque jour.
 *
 * Exemple : inscription 19/11 → échéance 24/11
 *   24/11 = 0 j (à jour) · 25/11 = 6 j · 26/11 = 7 j · 27/11 = 8 j …
 */
const DAY = 86_400_000;
export const GRACE_DAYS = 5;

/** Ancre de facturation = date d'inscription la plus ancienne. */
export function enrollmentAnchor(enrollments: { startedAt: Date }[]): Date | null {
  return enrollments.reduce<Date | null>((min, e) => (!min || e.startedAt < min ? e.startedAt : min), null);
}

/** Date d'échéance = date d'inscription + 5 jours. */
export function dueDateFromEnrollment(start: Date): Date {
  return new Date(start.getTime() + GRACE_DAYS * DAY);
}

/** Jours de retard affichés (0 pendant le délai de grâce, puis total depuis l'inscription). */
export function lateDaysFromEnrollment(start: Date, asOf: Date): number {
  const days = Math.floor((asOf.getTime() - start.getTime()) / DAY);
  return days > GRACE_DAYS ? days : 0;
}
