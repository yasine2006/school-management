import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Avatar, Badge, Card, PageHeader, td, th, type Tone } from "@/components/ui";
import { toggleActive } from "./actions";
import { UserForm } from "./user-form";

export const metadata: Metadata = { title: "Utilisateurs" };

const roles: Record<string, { label: string; tone: Tone }> = {
  ADMIN: { label: "Administrateur", tone: "purple" },
  TEACHER: { label: "Enseignant", tone: "blue" },
  STUDENT: { label: "Élève", tone: "green" },
};

export default async function UsersPage() {
  const { schoolId, userId } = await requireRole("ADMIN");
  const users = await db.user.findMany({ where: { schoolId }, orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Comptes de l'administration, des enseignants et des élèves (lecture seule)" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line bg-slate-50/70">
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Rôle</th>
                  <th className={th}>Statut</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className={td}>
                      <span className="flex items-center gap-3">
                        <Avatar name={u.name} size={34} />
                        <span className="leading-tight">
                          <span className="block font-medium">{u.name}</span>
                          <span className="text-xs text-muted">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className={td}>
                      <Badge tone={roles[u.role]!.tone} dot={false}>
                        {roles[u.role]!.label}
                      </Badge>
                    </td>
                    <td className={td}>
                      <Badge tone={u.active ? "green" : "gray"}>{u.active ? "Actif" : "Désactivé"}</Badge>
                    </td>
                    <td className={`${td} text-right`}>
                      {u.id !== userId && (
                        <form action={toggleActive.bind(null, u.id)}>
                          <button className="text-sm font-medium text-brand-600 hover:underline">{u.active ? "Désactiver" : "Réactiver"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <UserForm />
      </div>
    </>
  );
}
