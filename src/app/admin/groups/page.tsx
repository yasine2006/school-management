import type { Metadata } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { kindMeta } from "@/lib/fees";
import { formatDH } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Card, PageHeader, selectCls, td, th } from "@/components/ui";
import { assignTeacher, deleteGroup } from "./actions";
import { GroupForm } from "./group-form";

export const metadata: Metadata = { title: "Groupes" };

const DAYS = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default async function GroupsPage() {
  const { schoolId } = await requireRole("ADMIN");
  const [groups, specialties, levels, teachers] = await Promise.all([
    db.group.findMany({
      where: { schoolId },
      orderBy: [{ level: { order: "asc" } }, { name: "asc" }],
      include: {
        specialty: true,
        level: true,
        sessions: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
        _count: { select: { enrollments: true } },
      },
    }),
    db.specialty.findMany({ where: { schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.level.findMany({ where: { schoolId }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { schoolId, role: "TEACHER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Groupes" subtitle={`${groups.length} groupes · un groupe = une matière × un niveau × un enseignant`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Groupe</th>
                  <th className={th}>Matière</th>
                  <th className={th}>Niveau</th>
                  <th className={th}>Élèves</th>
                  <th className={th}>Mensualité</th>
                  <th className={th}>Enseignant</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td className={td}>
                      <Link href={`/admin/groups/${g.id}`} className="block font-medium hover:text-brand-600">
                        {g.name}
                      </Link>
                      <span className="text-xs text-muted">
                        <Badge tone={kindMeta[g.kind].tone} dot={false}>
                          {kindMeta[g.kind].label}
                        </Badge>
                        {g.sessions.length > 0 && (
                          <span className="ml-2">
                            {g.sessions.map((s) => `${DAYS[s.dayOfWeek]} ${s.startTime}`).join(" · ")}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={td}>{g.specialty.name}</td>
                    <td className={td}>{g.level.name}</td>
                    <td className={td}>
                      {g._count.enrollments}
                      {g.capacity ? <span className="text-muted">/{g.capacity}</span> : null}
                    </td>
                    <td className={td}>{formatDH(Number(g.monthlyFee.toString()))}</td>
                    <td className={td}>
                      <form action={assignTeacher.bind(null, g.id)} className="flex items-center gap-2">
                        <select name="teacherId" defaultValue={g.teacherId ?? ""} className={selectCls}>
                          <option value="">— Aucun —</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button className="rounded-md px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">OK</button>
                      </form>
                    </td>
                    <td className={`${td} text-right`}>
                      {g._count.enrollments === 0 && (
                        <form action={deleteGroup.bind(null, g.id)}>
                          <ConfirmButton label="Supprimer" message={`Supprimer le groupe ${g.name} ?`} className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100">
                            <Trash2 size={15} />
                          </ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!groups.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                      Aucun groupe. Créez d&apos;abord une matière et un niveau.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <GroupForm specialties={specialties} levels={levels} teachers={teachers} />
      </div>
    </>
  );
}
