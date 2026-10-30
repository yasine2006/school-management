import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, PageHeader, td, th } from "@/components/ui";
import { deleteSpecialty } from "./actions";
import { SpecialtyForm } from "./specialty-form";

export const metadata: Metadata = { title: "Matières" };

export default async function SpecialtiesPage() {
  const { schoolId } = await requireRole("ADMIN");
  const specialties = await db.specialty.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    include: { _count: { select: { groups: true } } },
  });

  return (
    <>
      <PageHeader title="Matières" subtitle={`${specialties.length} matières enseignées au centre`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Matière</th>
                  <th className={th}>Groupes</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {specialties.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>
                      <span className="flex items-center gap-2.5 font-medium">
                        <span className="h-3.5 w-3.5 rounded-full" style={{ background: s.color ?? "#94a3b8" }} />
                        {s.name}
                      </span>
                    </td>
                    <td className={td}>{s._count.groups}</td>
                    <td className={`${td} text-right`}>
                      {s._count.groups === 0 && (
                        <form action={deleteSpecialty.bind(null, s.id)}>
                          <ConfirmButton label="Supprimer" message={`Supprimer la matière ${s.name} ?`} className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100">
                            <Trash2 size={15} />
                          </ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!specialties.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-sm text-muted">
                      Aucune matière.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <SpecialtyForm />
      </div>
    </>
  );
}
