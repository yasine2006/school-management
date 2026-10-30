import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { registrationState } from "@/lib/fees";
import { formatDate, toInputDate } from "@/lib/format";
import { Avatar, Badge, btnGhost, Card, PageHeader, td, th, type Tone } from "@/components/ui";
import { closePeriod, validateStudent } from "./actions";
import { PeriodForm } from "./period-form";

export const metadata: Metadata = { title: "Inscriptions" };

const states: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Ouverte", tone: "green" },
  CLOSED: { label: "Fermée", tone: "red" },
  UPCOMING: { label: "À venir", tone: "amber" },
  NONE: { label: "Non définie", tone: "gray" },
};

export default async function RegistrationsPage() {
  const { schoolId } = await requireRole("ADMIN");
  const period = await db.registrationPeriod.findFirst({ where: { schoolId }, orderBy: { startDate: "desc" } });
  const state = registrationState(period);

  const students = await db.student.findMany({
    where: {
      schoolId,
      archived: false,
      ...(period ? { registeredAt: { gte: period.startDate, lte: period.endDate } } : {}),
    },
    include: { enrollments: { where: { status: "ACTIVE" }, include: { group: { include: { specialty: true } } } } },
    orderBy: { registeredAt: "desc" },
    take: 15,
  });

  const today = new Date();
  const defStart = period?.startDate ?? today;
  const defEnd = period?.endDate ?? new Date(today.getTime() + 60 * 86_400_000);

  return (
    <>
      <PageHeader title="Période d'inscription / Tswjil" subtitle={period?.name} />

      <Card className="mb-6 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge tone={states[state]!.tone}>{states[state]!.label}</Badge>
            <p className="text-sm text-muted">
              {state === "OPEN" && "Les inscriptions se ferment automatiquement à la date de fin."}
              {state === "CLOSED" && "Les inscriptions sont fermées."}
              {state === "UPCOMING" && "Les inscriptions ouvriront à la date de début."}
              {state === "NONE" && "Définissez une période pour ouvrir les inscriptions."}
            </p>
          </div>
          {state === "OPEN" && (
            <form action={closePeriod}>
              <button className={btnGhost}>Clôturer maintenant</button>
            </form>
          )}
        </div>
        <PeriodForm start={toInputDate(defStart)} end={toInputDate(defEnd)} />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-semibold">Liste des inscriptions</h2>
          <Link href="/admin/students/new" className="text-sm font-medium text-brand-600 hover:underline">
            + Nouvelle inscription
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-slate-50/70">
              <tr>
                <th className={th}>Nom élève</th>
                <th className={th}>Matières</th>
                <th className={th}>Date d&apos;inscription</th>
                <th className={th}>Statut</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className={td}>
                    <span className="flex items-center gap-3 font-medium">
                      <Avatar name={`${s.firstName} ${s.lastName}`} photo={s.photo} size={32} />
                      {s.firstName} {s.lastName}
                    </span>
                  </td>
                  <td className={td}>
                    {s.enrollments.length ? s.enrollments.map((e) => e.group.specialty.name).join(", ") : "—"}
                  </td>
                  <td className={td}>{formatDate(s.registeredAt)}</td>
                  <td className={td}>
                    <Badge tone={s.status === "ACTIVE" ? "green" : s.status === "PENDING" ? "amber" : "gray"}>
                      {s.status === "ACTIVE" ? "Validé" : s.status === "PENDING" ? "En attente" : "Inactif"}
                    </Badge>
                  </td>
                  <td className={`${td} text-right`}>
                    {s.status === "PENDING" && (
                      <form action={validateStudent.bind(null, s.id)}>
                        <button className="text-sm font-medium text-brand-600 hover:underline">Valider</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!students.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    Aucune inscription sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
