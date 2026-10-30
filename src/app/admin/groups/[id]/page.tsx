import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { kindMeta } from "@/lib/fees";
import { formatDate, formatDH } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { Avatar, Badge, Card, selectCls, td, th } from "@/components/ui";
import { deleteEnrollment, reactivateEnrollment, stopEnrollment } from "../../enrollments/actions";
import { assignTeacher } from "../actions";
import { GroupEnrollForm } from "./group-enroll-form";

export const metadata: Metadata = { title: "Détail du groupe" };

const DAYS = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const group = await db.group.findFirst({
    where: { id, schoolId },
    include: {
      specialty: true,
      level: true,
      sessions: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      enrollments: {
        include: { student: true, _count: { select: { lines: true } } },
        orderBy: [{ status: "asc" }, { student: { lastName: "asc" } }],
      },
    },
  });
  if (!group) notFound();

  const [teachers, students] = await Promise.all([
    db.user.findMany({ where: { schoolId, role: "TEACHER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.student.findMany({
      where: { schoolId, archived: false, id: { notIn: group.enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.studentId) } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const activeCount = group.enrollments.filter((e) => e.status === "ACTIVE").length;

  return (
    <>
      <Link href="/admin/groups" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Retour aux groupes
      </Link>

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: group.specialty.color ?? "#94a3b8" }} />
            {group.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {group.specialty.name} · {group.level.name} ·{" "}
            <Badge tone={kindMeta[group.kind].tone} dot={false}>
              {kindMeta[group.kind].label}
            </Badge>
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatDH(Number(group.monthlyFee.toString()))}/mois ·{" "}
            {group.capacity ? `Capacité ${activeCount}/${group.capacity}` : `${activeCount} élève(s)`}
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
              <h2 className="font-semibold">Élèves inscrits</h2>
              <span className="text-sm text-muted">{group.enrollments.length} au total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-line bg-slate-50/70">
                  <tr>
                    <th className={th}>Élève</th>
                    <th className={th}>Mensualité</th>
                    <th className={th}>Depuis</th>
                    <th className={th}>Statut</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {group.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td className={td}>
                        <span className="flex items-center gap-2.5 font-medium">
                          <Avatar name={`${e.student.firstName} ${e.student.lastName}`} photo={e.student.photo} size={28} />
                          <Link href={`/admin/students/${e.studentId}`} className="hover:text-brand-600">
                            {e.student.lastName} {e.student.firstName}
                          </Link>
                        </span>
                      </td>
                      <td className={td}>{formatDH(Number(e.monthlyFee.toString()))}</td>
                      <td className={td}>{formatDate(e.startedAt)}</td>
                      <td className={td}>
                        <Badge tone={e.status === "ACTIVE" ? "green" : "gray"}>{e.status === "ACTIVE" ? "Active" : "Arrêtée"}</Badge>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          {e.status === "ACTIVE" ? (
                            <form action={stopEnrollment.bind(null, e.id)}>
                              <button className="text-xs font-medium text-amber-600 hover:underline">Arrêter</button>
                            </form>
                          ) : (
                            <form action={reactivateEnrollment.bind(null, e.id)}>
                              <button className="text-xs font-medium text-emerald-600 hover:underline">Réactiver</button>
                            </form>
                          )}
                          {e._count.lines === 0 && (
                            <form action={deleteEnrollment.bind(null, e.id)}>
                              <ConfirmButton label="Supprimer" message="Retirer cet élève du groupe ?" className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100">
                                <Trash2 size={14} />
                              </ConfirmButton>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!group.enrollments.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                        Aucun élève dans ce groupe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="p-5 pb-3 font-semibold">Créneaux hebdomadaires</h2>
            <ul className="divide-y divide-line text-sm">
              {group.sessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3">
                  <span className="font-medium">{DAYS[s.dayOfWeek]}</span>
                  <span className="text-muted">
                    {s.startTime} – {s.endTime}
                    {s.room && ` · ${s.room}`}
                  </span>
                </li>
              ))}
              {!group.sessions.length && <li className="px-5 py-6 text-center text-muted">Aucun créneau défini.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Enseignant du groupe</h2>
            <form action={assignTeacher.bind(null, group.id)} className="flex items-center gap-2">
              <select name="teacherId" defaultValue={group.teacherId ?? ""} className={selectCls}>
                <option value="">— Aucun —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="rounded-md px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">OK</button>
            </form>
          </Card>

          <Card className="p-5">
            <GroupEnrollForm groupId={group.id} students={students.map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}` }))} />
          </Card>
        </div>
      </div>
    </>
  );
}
