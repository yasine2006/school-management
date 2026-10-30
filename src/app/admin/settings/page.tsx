import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm, SchoolForm } from "./settings-forms";

export const metadata: Metadata = { title: "Paramètres" };

const TABS = [
  { key: "school", label: "Centre" },
  { key: "security", label: "Sécurité" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const { tab: tabParam, saved } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "school";

  const school = await db.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { name: true, logo: true, address: true, phone: true, email: true },
  });

  return (
    <>
      <PageHeader title="Paramètres" />
      <Card>
        <div className="flex gap-6 border-b border-line px-6">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/settings?tab=${t.key}`}
              className={`-mb-px border-b-2 py-3.5 text-sm font-medium ${t.key === tab ? "border-brand-600 text-brand-600" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="p-6">
          <h2 className="mb-5 font-semibold">{tab === "school" ? "Informations du centre" : "Changer le mot de passe"}</h2>
          {saved && (
            <p className="mb-5 flex max-w-xl items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
              <CircleCheck size={16} /> Les informations ont été enregistrées avec succès.
            </p>
          )}
          {tab === "school" ? <SchoolForm school={school} /> : <PasswordForm />}
        </div>
      </Card>
    </>
  );
}
