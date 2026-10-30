import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Clock, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { kindMeta } from "@/lib/fees";
import { Avatar, Badge, btnGhost, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Mes groupes" };

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default async function TeacherHome() {
  const session = await requireRole("TEACHER");

  const groups = await db.group.findMany({
    where: { schoolId: session.schoolId, teacherId: session.userId },
    include: {
      specialty: true,
      level: true,
      sessions: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      enrollments: { where: { status: "ACTIVE" }, include: { student: true }, orderBy: { student: { lastName: "asc" } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title={`Bonjour ${session.name}`} subtitle="Vos groupes et vos élèves" />
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.id} className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.specialty.color ?? "#94a3b8" }} />
                  {g.name}
                  <Badge tone={kindMeta[g.kind].tone}>{kindMeta[g.kind].label}</Badge>
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  {g.specialty.name} · {g.level.name} · {g.enrollments.length} élèves
                </p>
              </div>
              <Link href={`/teacher/attendance?groupId=${g.id}`} className={btnGhost}>
                <CalendarCheck size={15} /> Présences
              </Link>
            </div>
            {g.sessions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted">
                {g.sessions.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                    <Clock size={12} /> {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}
                    {s.room && (
                      <>
                        <MapPin size={12} /> {s.room}
                      </>
                    )}
                  </span>
                ))}
              </div>
            )}
            <ul className="divide-y divide-line text-sm">
              {g.enrollments.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={`${e.student.firstName} ${e.student.lastName}`} photo={e.student.photo} size={30} />
                  {e.student.lastName} {e.student.firstName}
                </li>
              ))}
              {!g.enrollments.length && <li className="py-3 text-center text-muted">Aucun élève inscrit.</li>}
            </ul>
          </Card>
        ))}
        {!groups.length && <Card className="p-10 text-center text-sm text-muted lg:col-span-2">Aucun groupe ne vous est encore assigné.</Card>}
      </div>
    </>
  );
}
