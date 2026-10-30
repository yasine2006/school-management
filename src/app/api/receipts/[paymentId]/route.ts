import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { receiptPdf } from "@/lib/pdf";
import { invoiceTotals } from "@/lib/fees";

export async function GET(_: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Non authentifié", { status: 401 });

  const id = Number((await params).paymentId);
  if (!Number.isInteger(id)) return new Response("Introuvable", { status: 404 });

  const payment = await db.payment.findFirst({
    where: { id, invoice: { student: { schoolId: session.schoolId } } },
    include: { invoice: { include: { lines: true, payments: true, student: { include: { school: true } } } } },
  });
  if (!payment) return new Response("Introuvable", { status: 404 });

  const { student } = payment.invoice;
  const allowed = session.role === "ADMIN" || (session.role === "STUDENT" && student.userId === session.userId);
  if (!allowed) return new Response("Interdit", { status: 403 });

  const totals = invoiceTotals(payment.invoice);
  const receiptNo = payment.receiptNo ?? `R-${payment.id}`;
  const pdf = receiptPdf({
    school: student.school,
    receiptNo,
    paidAt: payment.paidAt,
    student: `${student.firstName} ${student.lastName}`,
    month: payment.invoice.month,
    lines: payment.invoice.lines.map((l) => ({ label: l.label, amount: Number(l.amount.toString()) })),
    amount: Number(payment.amount.toString()),
    method: payment.method === "CASH" ? "Espèces" : "Virement",
    due: totals.due,
    paidTotal: totals.paid,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
