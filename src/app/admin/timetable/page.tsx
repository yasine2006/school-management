import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { AutoForm } from "@/components/auto-form";
import { Card, PageHeader, selectCls } from "@/components/ui";

export const metadata: Metadata = { title: "Emploi du temps" };

// dayOfWeek 1 = Monday … 7 = Sunday
const DAYS = [
  { n: 1, label: "Lundi" },
  { n: 2, label: "Mardi" },
  { n: 3, label: "Mercredi" },
  { n: 4, label: "Jeudi" },
  { n: 5, label: "Vendredi" },
  { n: 6, label: "Samedi" },
  { n: 7, label: "Dimanche" },
];

type Slot = { id: number; group: string; color: string | null; start: string; end: string; room: string | null };

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ teacherId?: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const { teacherId } = await searchParams;

  const teachers = await db.user.findMany({
    where: { schoolId, role: "TEACHER", active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      groups: {
        where: { active: true },
        select: {
          name: true,
          specialty: { select: { name: true, color: true } },
          sessions: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], select: { id: true, dayOfWeek: true, startTime: true, endTime: true, room: true } },
        },
      },
    },
  });

  const shown = teacherId ? teachers.filter((t) => t.id === Number(teacherId)) : teachers;

  return (
    <>
      <PageHeader title="Emploi du temps" subtitle="Le planning hebdomadaire de chaque enseignant" />

      <Card className="mb-6">
        <AutoForm className="flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-56 text-xs font-medium text-muted">
            Enseignant
            <select name="teacherId" defaultValue={teacherId ?? ""} className={`${selectCls} mt-1 block`}>
              <option value="">Tous les enseignants</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Afficher</button>
        </AutoForm>
      </Card>

      <div className="space-y-6">
        {shown.map((t) => {
          // build day -> slots
          const byDay = new Map<number, Slot[]>();
          for (const g of t.groups) {
            for (const s of g.sessions) {
              const list = byDay.get(s.dayOfWeek) ?? [];
              list.push({ id: s.id, group: g.name, color: g.specialty.color, start: s.startTime, end: s.endTime, room: s.room });
              byDay.set(s.dayOfWeek, list);
            }
          }

          return (
            <Card key={t.id} className="overflow-hidden">
              <h2 className="border-b border-line px-5 py-4 font-semibold">{t.name}</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="border-b border-line bg-slate-50/70">
                    <tr>
                      {DAYS.map((d) => (
                        <th key={d.n} className="px-3 py-2.5 text-center text-xs font-semibold text-muted">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      {DAYS.map((d) => {
                        const slots = byDay.get(d.n) ?? [];
                        return (
                          <td key={d.n} className="border-r border-line p-2 last:border-r-0">
                            <div className="space-y-1.5">
                              {slots.map((s) => (
                                <div key={s.id} className="rounded-md border border-line bg-white p-2 shadow-sm">
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color ?? "#94a3b8" }} />
                                    <span className="truncate text-[11px] font-semibold leading-tight">{s.group}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-muted">
                                    {s.start}–{s.end}
                                    {s.room && ` · ${s.room}`}
                                  </p>
                                </div>
                              ))}
                              {!slots.length && <p className="py-1 text-center text-[11px] text-slate-300">—</p>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              {!t.groups.length && <p className="px-5 py-6 text-center text-sm text-muted">Aucun groupe assigné.</p>}
            </Card>
          );
        })}
        {!shown.length && (
          <Card className="p-10 text-center text-sm text-muted">
            <CalendarDays className="mx-auto mb-3" size={28} />
            Aucun enseignant trouvé.
          </Card>
        )}
      </div>
    </>
  );
}
