import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { updateStudent } from "../../actions";
import { StudentForm } from "../../student-form";

export const metadata: Metadata = { title: "Modifier l'élève" };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { schoolId } = await requireRole("ADMIN");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const student = await db.student.findFirst({ where: { id, schoolId }, include: { user: true } });
  if (!student) notFound();

  return (
    <>
      <PageHeader title={`Modifier ${student.firstName} ${student.lastName}`} />
      <StudentForm
        action={updateStudent.bind(null, id)}
        backHref={`/admin/students/${id}`}
        hasAccount={!!student.userId}
        defaults={{ ...student, accountEmail: student.user?.email ?? "" }}
        submitLabel="Enregistrer"
      />
    </>
  );
}
