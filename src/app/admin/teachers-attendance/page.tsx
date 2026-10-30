import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { db } from "@/lib/db";
import { toInputDate } from "@/lib/format";
import { AutoForm } from "@/components/auto-form";
import { Avatar, btnPrimary, Card, PageHeader, selectCls, td, th } from "@/components/ui";
import { CircleCheck } from "lucide-react";
import { saveTeacherAttendance } from "./actions";

export const metadata: Metadata = { title: "Présence enseignants" };

const OPTIONS = [
  { value: "PRESENT", label: "Présent", on: "peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:ring-emerald-200" },
  { value: "ABSENT", label: "Absent", on: "peer-checked:bg-rose-50 peer-checked:text-rose-600 peer-checked:ring-rose-200" },
  { value: "LATE", label: "Retard", on: "peer-checked:bg-amber-50 peer-checked:text-amber-700 peer-checked:ring-amber-200" },
];

export default async function TeachersAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; saved?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : toInputDate(new Date());

  const teachers = await db.user.findMany({
    where: { schoolId, role: "TEACHER", active: true },
    orderBy: { name: "asc" },
    include: { teacherAttendance: { where: { date: new Date(`${day}T00:00:00.000Z`) } } },
  });

  return (
    <>
      <PageHeader title="Présence enseignants" subtitle="L'administrateur enregistre lui-même la présence des enseignants." />

      <Card>
        <AutoForm className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <label className="text-xs font-medium text-muted">
            Date
            <input type="date" name="date" defaultValue={day} className={`${selectCls} mt-1 block`} />
          </label>
        </AutoForm>

        {sp.saved && (
          <p className="m-4 mb-0 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CircleCheck size={16} /> Présences enseignants enregistrées.
          </p>
        )}

        <form action={saveTeacherAttendance.bind(null, day)}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Enseignant</th>
                  <th className={th}>Statut</th>
                  <th className={th}>Preuve / Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {teachers.map((t) => {
                  const rec = t.teacherAttendance[0];
                  const value = rec?.status ?? "PRESENT";
                  const note = rec?.note ?? "";
                  return (
                    <tr key={t.id}>
                      <td className={td}>
                        <span className="flex items-center gap-3 font-medium">
                          <Avatar name={t.name} size={32} />
                          {t.name}
                          <span className="text-xs text-muted">{t.email}</span>
                        </span>
                      </td>
                      <td className={td}>
                        <div className="flex gap-2">
                          {OPTIONS.map((o) => (
                            <label key={o.value} className="cursor-pointer">
                              <input type="radio" name={`t_${t.id}`} value={o.value} defaultChecked={value === o.value} className="peer sr-only" />
                              <span className={`inline-block rounded-md px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-inset ring-line transition hover:bg-slate-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 ${o.on}`}>
                                {o.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className={td}>
                        <input
                          name={`tn_${t.id}`}
                          defaultValue={note}
                          placeholder="Appel, absence justifiée, arrivé en retard..."
                          className="w-full max-w-md rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                        />
                      </td>
                    </tr>
                  );
                })}
                {!teachers.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">
                      Aucun enseignant actif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {teachers.length > 0 && (
            <div className="border-t border-line p-4">
              <button className={btnPrimary}>Enregistrer la présence des enseignants</button>
            </div>
          )}
        </form>
      </Card>
    </>
  );
}
