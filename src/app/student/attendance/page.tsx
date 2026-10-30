import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { Avatar, Badge } from "@/components/ui";
import { requireStudent } from "../queries";

export const metadata: Metadata = { title: "Mes présences" };

export default async function StudentAttendance() {
  const session = await requireRole("STUDENT");
  const me = await requireStudent(session);

  const since = new Date(new Date().getTime() - 60 * 86_400_000);
  const student = await db.student.findUniqueOrThrow({
    where: { id: me.id },
    include: {
      attendance: { where: { date: { gte: since } }, orderBy: { date: "desc" }, take: 80, include: { group: { include: { specialty: true } } } },
    },
  });

  const name = `${student.firstName} ${student.lastName}`;
  const count = (s: string) => student.attendance.filter((a) => a.status === s).length;

  const summary = [
    { label: "Présences", value: count("PRESENT"), tone: "green" as const },
    { label: "Absences", value: count("ABSENT"), tone: "red" as const },
    { label: "Retards", value: count("LATE"), tone: "amber" as const },
  ];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={name} photo={student.photo} size={40} />
        <div className="leading-tight">
          <h1 className="text-base font-bold">Mes présences</h1>
          <p className="text-sm text-muted">60 derniers jours</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-3">
          {summary.map((s) => (
            <div key={s.label} className="rounded-xl border border-line p-3 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
          ))}
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {student.attendance.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="leading-tight">
                <p className="text-sm font-medium">{a.group.specialty.name}</p>
                <p className="text-xs text-muted">{formatDate(a.date, { weekday: "long", day: "numeric", month: "long" })}</p>
                {a.note && <p className="mt-1 text-xs text-slate-600">Preuve / motif : {a.note}</p>}
              </div>
              <Badge tone={a.status === "PRESENT" ? "green" : a.status === "ABSENT" ? "red" : "amber"}>
                {a.status === "PRESENT" ? "Présent" : a.status === "ABSENT" ? "Absent" : "Retard"}
              </Badge>
            </li>
          ))}
          {!student.attendance.length && (
            <li className="p-10 text-center text-sm text-muted">
              <CalendarCheck className="mx-auto mb-3" size={28} />
              Aucune présence enregistrée.
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
