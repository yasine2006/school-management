import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { toInputDate, formatDate } from "@/lib/format";
import { AutoForm } from "@/components/auto-form";
import { Avatar, Badge, Card, PageHeader, selectCls, td, th, btnPrimary } from "@/components/ui";
import { FileText, Search } from "lucide-react";
import { updateAbsenceNote } from "./actions";

export const metadata: Metadata = { title: "Absences & Preuves" };

export default async function AdminAbsencesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string; groupId?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : toInputDate(new Date());
  const q = sp.q?.trim() || "";

  const groups = await db.group.findMany({ where: { schoolId, active: true }, orderBy: { name: "asc" }, include: { specialty: true } });
  const groupId = Number(sp.groupId) || undefined;

  const absences = await db.attendance.findMany({
    where: {
      date: new Date(`${day}T00:00:00.000Z`),
      status: { in: ["ABSENT", "LATE"] },
      group: { schoolId, ...(groupId ? { id: groupId } : {}) },
      ...(q
        ? {
            student: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      student: true,
      group: { include: { specialty: true, teacher: true } },
    },
    orderBy: [{ groupId: "asc" }, { student: { lastName: "asc" } }],
  });

  return (
    <>
      <PageHeader title="Absences & Preuves" subtitle="Vérifier et compléter les justifications saisies par les enseignants." />

      <Card className="mb-6">
        <AutoForm className="flex flex-wrap items-center gap-3 p-4">
          <input type="date" name="date" defaultValue={day} className={selectCls} />
          <select name="groupId" defaultValue={groupId ?? ""} className={selectCls}>
            <option value="">Tous les groupes</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Rechercher un élève…" className="w-full rounded-lg border border-line pl-9 pr-3 py-2 text-sm" />
          </div>
        </AutoForm>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50/70">
              <tr>
                <th className={th}>Élève</th>
                <th className={th}>Groupe / Matière</th>
                <th className={th}>Enseignant</th>
                <th className={th}>Statut</th>
                <th className={th}>Preuve / Justification</th>
                <th className={`${th} text-right`}>Enregistrer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {absences.map((a) => (
                <tr key={a.id}>
                  <td className={td}>
                    <span className="flex items-center gap-2.5 font-medium">
                      <Avatar name={`${a.student.firstName} ${a.student.lastName}`} photo={a.student.photo} size={30} />
                      {a.student.lastName} {a.student.firstName}
                    </span>
                  </td>
                  <td className={td}>
                    <p className="font-medium">{a.group.name}</p>
                    <p className="text-xs text-muted">{a.group.specialty.name}</p>
                  </td>
                  <td className={td}>{a.group.teacher?.name ?? "—"}</td>
                  <td className={td}>
                    <Badge tone={a.status === "ABSENT" ? "red" : "amber"}>{a.status === "ABSENT" ? "Absent" : "Retard"}</Badge>
                  </td>
                  <td className={td}>
                    <form action={updateAbsenceNote.bind(null, a.id, day)} className="flex gap-2">
                      <input
                        name="note"
                        defaultValue={a.note ?? ""}
                        placeholder="Ajouter une preuve (billet, appel, justificatif...)"
                        className="w-full min-w-64 rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                      />
                      <button className={btnPrimary}>
                        <FileText size={14} /> Enregistrer
                      </button>
                    </form>
                  </td>
                  <td className={`${td} text-right text-xs text-muted`}>{formatDate(a.date)}</td>
                </tr>
              ))}
              {!absences.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    Aucune absence/retard pour le {formatDate(new Date(`${day}T00:00:00.000Z`))}.
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
