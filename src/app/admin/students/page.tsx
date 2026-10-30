import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { studentSearchWhere } from "@/lib/search";
import { AutoForm } from "@/components/auto-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Pagination } from "@/components/pagination";
import { Avatar, Badge, Card, inputCls, PageHeader, selectCls, td, th, type Tone } from "@/components/ui";
import { deleteStudent } from "./actions";

export const metadata: Metadata = { title: "Élèves" };

const PAGE_SIZE = 8;
const status: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Actif", tone: "green" },
  PENDING: { label: "En attente", tone: "amber" },
  INACTIVE: { label: "Inactif", tone: "gray" },
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; specialtyId?: string; status?: string; page?: string }>;
}) {
  const { schoolId } = await requireRole("ADMIN");
  const { q, specialtyId, status: statusFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.StudentWhereInput = {
    schoolId,
    archived: false,
    ...(statusFilter ? { status: statusFilter as Prisma.EnumStudentStatusFilter } : {}),
    ...(specialtyId ? { enrollments: { some: { group: { specialtyId: Number(specialtyId) } } } } : {}),
    ...(await studentSearchWhere(q, schoolId)),
  };

  const [students, total, specialties] = await Promise.all([
    db.student.findMany({
      where,
      include: { enrollments: { where: { status: "ACTIVE" }, include: { group: { include: { specialty: true } } } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.student.count({ where }),
    db.specialty.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Gestion des élèves"
        action={
          <Link
            href="/admin/students/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
          >
            <Plus size={16} /> Ajouter un élève
          </Link>
        }
      />

      <Card>
        <AutoForm className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="Rechercher un élève…" className={`${inputCls} pl-9`} />
          </div>
          <select name="specialtyId" defaultValue={specialtyId ?? ""} className={selectCls}>
            <option value="">Toutes les matières</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={statusFilter ?? ""} className={selectCls}>
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="PENDING">En attente</option>
            <option value="INACTIVE">Inactif</option>
          </select>
        </AutoForm>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50/70">
              <tr>
                <th className={th}>Photo</th>
                <th className={th}>Nom complet</th>
                <th className={th}>Matières</th>
                <th className={th}>Parent</th>
                <th className={th}>Téléphone</th>
                <th className={th}>Statut</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => {
                const full = `${s.firstName} ${s.lastName}`;
                const st = status[s.status]!;
                return (
                  <tr key={s.id} className="transition hover:bg-slate-50/60">
                    <td className={td}>
                      <Avatar name={full} photo={s.photo} size={38} />
                    </td>
                    <td className={`${td} font-medium`}>
                      <Link href={`/admin/students/${s.id}`} className="hover:text-brand-600">
                        {full}
                      </Link>
                    </td>
                    <td className={td}>
                      <span className="flex flex-wrap gap-1">
                        {s.enrollments.length ? (
                          s.enrollments.map((e) => (
                            <span key={e.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                              <span className="h-2 w-2 rounded-full" style={{ background: e.group.specialty.color ?? "#94a3b8" }} />
                              {e.group.specialty.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </span>
                    </td>
                    <td className={td}>{s.parentName ?? "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{s.parentPhone ?? "—"}</td>
                    <td className={td}>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td className={td}>
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/admin/students/${s.id}/edit`} aria-label="Modifier" title="Modifier" className="rounded-md bg-brand-50 p-1.5 text-brand-600 hover:bg-brand-100">
                          <Pencil size={15} />
                        </Link>
                        <Link href={`/admin/students/${s.id}`} aria-label="Voir la fiche" title="Voir la fiche" className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                          <Eye size={15} />
                        </Link>
                        <form action={deleteStudent.bind(null, s.id)}>
                          <ConfirmButton
                            label="Supprimer"
                            message={`Supprimer ${full} ? Ses inscriptions et factures seront aussi supprimées.`}
                            className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                          >
                            <Trash2 size={15} />
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!students.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                    Aucun élève trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/students" params={{ q, specialtyId, status: statusFilter }} noun="élèves" />
      </Card>
    </>
  );
}
