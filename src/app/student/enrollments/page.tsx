import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { formatDate, formatDH } from "@/lib/format";
import { Avatar, Badge, Card } from "@/components/ui";
import { requireStudent } from "../queries";

export const metadata: Metadata = { title: "Mes cours" };

export default async function StudentEnrollments() {
  const session = await requireRole("STUDENT");
  const me = await requireStudent(session);

  const student = await db.student.findUniqueOrThrow({
    where: { id: me.id },
    include: {
      enrollments: { include: { group: { include: { specialty: true, level: true, teacher: true } } }, orderBy: [{ status: "asc" }] },
    },
  });

  const name = `${student.firstName} ${student.lastName}`;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <Avatar name={name} photo={student.photo} size={40} />
        <div className="leading-tight">
          <h1 className="text-base font-bold">Mes cours</h1>
          <p className="text-sm text-muted">{student.enrollments.length} inscription(s)</p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {student.enrollments.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="h-3 w-3 rounded-full" style={{ background: e.group.specialty.color ?? "#94a3b8" }} />
                  {e.group.specialty.name}
                </p>
                <p className="text-sm text-muted">
                  {e.group.name} · {e.group.level.name}
                </p>
                <p className="text-sm text-muted">Enseignant : {e.group.teacher?.name ?? "—"}</p>
              </div>
              <Badge tone={e.status === "ACTIVE" ? "green" : "gray"}>{e.status === "ACTIVE" ? "Active" : "Arrêtée"}</Badge>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Début</dt>
                <dd className="font-medium">{formatDate(e.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Fin</dt>
                <dd className="font-medium">{e.stoppedAt ? formatDate(e.stoppedAt) : "En cours"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Mensualité</dt>
                <dd className="font-medium">{formatDH(Number(e.monthlyFee.toString()))}</dd>
              </div>
            </dl>
          </Card>
        ))}

        {!student.enrollments.length && (
          <Card className="p-10 text-center text-sm text-muted">
            <BookOpen className="mx-auto mb-3" size={28} />
            Vous n&apos;êtes inscrit à aucune matière pour le moment.
          </Card>
        )}
      </div>
    </>
  );
}
