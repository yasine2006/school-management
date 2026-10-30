import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ConfirmButton } from "@/components/confirm-button";
import { Card, PageHeader, td, th } from "@/components/ui";
import { deleteLevel } from "./actions";
import { LevelForm } from "./level-form";

export const metadata: Metadata = { title: "Niveaux" };

export default async function LevelsPage() {
  const { schoolId } = await requireRole("ADMIN");
  const levels = await db.level.findMany({
    where: { schoolId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { groups: true } } },
  });

  return (
    <>
      <PageHeader title="Niveaux" subtitle={`${levels.length} niveaux · servent à tarifer les groupes`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Niveau</th>
                  <th className={th}>Ordre</th>
                  <th className={th}>Groupes</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {levels.map((l) => (
                  <tr key={l.id}>
                    <td className={`${td} font-medium`}>{l.name}</td>
                    <td className={td}>{l.order}</td>
                    <td className={td}>{l._count.groups}</td>
                    <td className={`${td} text-right`}>
                      {l._count.groups === 0 && (
                        <form action={deleteLevel.bind(null, l.id)}>
                          <ConfirmButton label="Supprimer" message={`Supprimer le niveau ${l.name} ?`} className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100">
                            <Trash2 size={15} />
                          </ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {!levels.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted">
                      Aucun niveau.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <LevelForm />
      </div>
    </>
  );
}
