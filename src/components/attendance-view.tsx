import { CircleCheck } from "lucide-react";
import { db } from "@/lib/db";
import { saveAttendance } from "@/app/attendance-actions";
import { AutoForm } from "@/components/auto-form";
import { Avatar, btnPrimary, Card, PageHeader, selectCls, td, th } from "@/components/ui";
import { toInputDate } from "@/lib/format";

const OPTIONS = [
  { value: "PRESENT", label: "Présent", on: "peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:ring-emerald-200" },
  { value: "ABSENT", label: "Absent", on: "peer-checked:bg-rose-50 peer-checked:text-rose-600 peer-checked:ring-rose-200" },
  { value: "LATE", label: "Retard", on: "peer-checked:bg-amber-50 peer-checked:text-amber-700 peer-checked:ring-amber-200" },
];

export async function AttendanceView({
  basePath,
  schoolId,
  teacherId,
  searchParams,
}: {
  basePath: "/admin/attendance" | "/teacher/attendance";
  schoolId: number;
  teacherId?: number;
  searchParams: { groupId?: string; date?: string; saved?: string };
}) {
  const groups = await db.group.findMany({
    where: { schoolId, active: true, ...(teacherId ? { teacherId } : {}) },
    orderBy: { name: "asc" },
    include: { specialty: true, level: true },
  });

  const day = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "") ? searchParams.date! : toInputDate(new Date());
  const current = groups.find((g) => String(g.id) === searchParams.groupId) ?? groups[0];

  const students = current
    ? await db.enrollment.findMany({
        where: { groupId: current.id, status: "ACTIVE", student: { archived: false } },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        include: { student: { include: { attendance: { where: { groupId: current.id, date: new Date(`${day}T00:00:00.000Z`) } } } } },
      })
    : [];

  return (
    <>
      <PageHeader title="Présences" subtitle="Marquez la présence des élèves par groupe. L'élève est notifié en cas d'absence." />

      {!current ? (
        <Card className="p-10 text-center text-sm text-muted">Aucun groupe disponible.</Card>
      ) : (
        <Card>
          <AutoForm className="flex flex-wrap items-end gap-3 border-b border-line p-4">
            <label className="text-xs font-medium text-muted">
              Groupe
              <select name="groupId" defaultValue={current.id} className={`${selectCls} mt-1 block`}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              Date
              <input type="date" name="date" defaultValue={day} className={`${selectCls} mt-1 block`} />
            </label>
          </AutoForm>

          {searchParams.saved && (
            <p className="m-4 mb-0 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CircleCheck size={16} /> Présences enregistrées.
            </p>
          )}

          <form action={saveAttendance.bind(null, current.id, day, basePath)}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-slate-50/70">
                  <tr>
                    <th className={th}>Élève</th>
                    <th className={th}>Statut</th>
                    <th className={th}>Preuve / Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {students.map((e) => {
                    const s = e.student;
                    const value = s.attendance[0]?.status ?? "PRESENT";
                    const note = s.attendance[0]?.note ?? "";
                    return (
                      <tr key={s.id}>
                        <td className={td}>
                          <span className="flex items-center gap-3 font-medium">
                            <Avatar name={`${s.firstName} ${s.lastName}`} photo={s.photo} size={32} />
                            {s.lastName} {s.firstName}
                          </span>
                        </td>
                        <td className={td}>
                          <div className="flex gap-2">
                            {OPTIONS.map((o) => (
                              <label key={o.value} className="cursor-pointer">
                                <input type="radio" name={`s_${s.id}`} value={o.value} defaultChecked={value === o.value} className="peer sr-only" />
                                <span className={`inline-block rounded-md px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-inset ring-line transition hover:bg-slate-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 ${o.on}`}>
                                  {o.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className={td}>
                          <input
                            name={`n_${s.id}`}
                            defaultValue={note}
                            placeholder="Motif, billet, appel…"
                            className="w-full max-w-xs rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {!students.length && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">
                        Aucun élève inscrit dans ce groupe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {students.length > 0 && (
              <div className="border-t border-line p-4">
                <button className={btnPrimary}>Enregistrer les présences</button>
              </div>
            )}
          </form>
        </Card>
      )}
    </>
  );
}
