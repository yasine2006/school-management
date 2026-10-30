import type { Metadata } from "next";
import { CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Avatar, Card } from "@/components/ui";
import { requireStudent } from "../queries";

export const metadata: Metadata = { title: "Mon emploi du temps" };

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

type Slot = { id: string; group: string; color: string | null; start: string; end: string; room: string | null };

export default async function StudentSchedule() {
  const session = await requireRole("STUDENT");
  const me = await requireStudent(session);

  const student = await db.student.findUniqueOrThrow({
    where: { id: me.id },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: { group: { include: { specialty: true, sessions: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } } } },
      },
    },
  });

  const name = `${student.firstName} ${student.lastName}`;
  const byDay = new Map<number, Slot[]>();
  for (const e of student.enrollments) {
    for (const s of e.group.sessions) {
      const slot: Slot = { id: `${e.group.id}-${s.id}`, group: e.group.name, color: e.group.specialty.color, start: s.startTime, end: s.endTime, room: s.room };
      const list = byDay.get(s.dayOfWeek) ?? [];
      list.push(slot);
      byDay.set(s.dayOfWeek, list);
    }
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={name} photo={student.photo} size={40} />
        <div className="leading-tight">
          <h1 className="text-base font-bold">Mon emploi du temps</h1>
          <p className="text-sm text-muted">Séances hebdomadaires</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {days.map((d) => (
          <section key={d}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
              <CalendarDays size={15} /> {DAYS[d]}
            </h2>
            <ul className="space-y-2">
              {byDay.get(d)!.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-1.5 rounded-full" style={{ background: s.color ?? "#94a3b8" }} />
                    <div className="leading-tight">
                      <p className="text-sm font-medium">{s.group}</p>
                      <p className="text-xs text-muted">
                        {s.start} – {s.end}
                      </p>
                    </div>
                  </div>
                  {s.room && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <MapPin size={13} /> {s.room}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {!days.length && <Card className="p-10 text-center text-sm text-muted">Aucune séance prévue.</Card>}
      </div>
    </>
  );
}
