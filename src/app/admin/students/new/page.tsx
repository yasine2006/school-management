import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { createStudent } from "../actions";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Nouvel élève" };

export default async function NewStudentPage() {
  await requireRole("ADMIN");

  return (
    <>
      <PageHeader title="Nouvel élève" subtitle="Ajoutez ensuite ses matières depuis la page Inscriptions." />
      <StudentForm action={createStudent} submitLabel="Ajouter l'élève" />
    </>
  );
}
