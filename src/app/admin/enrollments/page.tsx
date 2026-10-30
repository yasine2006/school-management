import type { Metadata } from "next";
import Link from "next/link";
import { Search, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { studentSearchWhere } from "@/lib/search";
import { formatDH } from "@/lib/format";
import { AutoForm } from "@/components/auto-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Pagination } from "@/components/pagination";
import { Avatar, Badge, Card, inputCls, PageHeader, selectCls, td, th } from "@/components/ui";
import { deleteEnrollment, reactivateEnrollment, stopEnrollment } from "./actions";
import { EnrollForm } from "./enroll-form";

export const metadata: Metadata = { title: "Inscriptions" };

const PAGE_SIZE = 12;

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; groupId?: string; status?: string; page?: string; studentId?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const { q, groupId, status, studentId, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.EnrollmentWhereInput = {
    student: {
      schoolId,
      archived: false,
      ...(studentId ? { id: Number(studentId) } : {}),
      ...(await studentSearchWhere(q, schoolId)),
    },
    ...(groupId ? { groupId: Number(groupId) } : {}),
    ...(status === "ACTIVE" || status === "STOPPED" ? { status } : {}),
  };

  const [enrollments, total, groups, students, allGroups] = await Promise.all([
    db.enrollment.findMany({
      where,
      include: { student: true, group: { include: { specialty: true, level: true, teacher: true } }, _count: { select: { lines: true } } },
      orderBy: [{ status: "asc" }, { student: { lastName: "asc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.enrollment.count({ where }),
    db.group.findMany({ where: { schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.student.findMany({ where: { schoolId, archived: false }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    db.group.findMany({ where: { schoolId }, orderBy: { name: "asc" }, include: { level: true } }),
  ]);

  return (
    <>
      <PageHeader title="Inscriptions" subtitle={`${total} inscriptions · un élève peut suivre plusieurs matières`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <AutoForm className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="relative min-w-48 flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={q} placeholder="Nom de l'élève…" className={`${inputCls} pl-9`} />
            </div>
            <select name="groupId" defaultValue={groupId ?? ""} className={selectCls}>
              <option value="">Tous les groupes</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={status ?? ""} className={selectCls}>
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Active</option>
              <option value="STOPPED">Arrêtée</option>
            </select>
          </AutoForm>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Élève</th>
                  <th className={th}>Groupe</th>
                  <th className={th}>Matière</th>
                  <th className={th}>Niveau</th>
                  <th className={th}>Mensualité</th>
                  <th className={th}>Statut</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>
                      <span className="flex items-center gap-2.5 font-medium">
                        <Avatar name={`${e.student.firstName} ${e.student.lastName}`} photo={e.student.photo} size={28} />
                        <Link href={`/admin/students/${e.studentId}`} className="hover:text-brand-600">
                          {e.student.lastName} {e.student.firstName}
                        </Link>
                      </span>
                    </td>
                    <td className={td}>{e.group.name}</td>
                    <td className={td}>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.group.specialty.color ?? "#94a3b8" }} />
                        {e.group.specialty.name}
                      </span>
                    </td>
                    <td className={td}>{e.group.level.name}</td>
                    <td className={td}>{formatDH(Number(e.monthlyFee.toString()))}</td>
                    <td className={td}>
                      <Badge tone={e.status === "ACTIVE" ? "green" : "gray"}>{e.status === "ACTIVE" ? "Active" : "Arrêtée"}</Badge>
                    </td>
                    <td className={td}>
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
                            <ConfirmButton label="Supprimer" message="Supprimer cette inscription ?" className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100">
                              <Trash2 size={14} />
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!enrollments.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                      Aucune inscription.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/enrollments" params={{ q, groupId, status, studentId }} noun="inscriptions" />
        </Card>
        <EnrollForm
          students={students.map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}` }))}
          groups={allGroups.map((g) => ({ id: g.id, name: g.name, fee: Number(g.monthlyFee.toString()), level: g.level.name }))}
        />
      </div>
    </>
  );
}
