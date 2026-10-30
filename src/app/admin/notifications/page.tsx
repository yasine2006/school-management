import type { Metadata } from "next";
import { AlertCircle, Bell, CheckCheck, CircleCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { timeAgo } from "@/lib/format";
import { btnGhost, Card, PageHeader } from "@/components/ui";
import { markAllRead } from "./actions";
import { AnnounceForm } from "./announce-form";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { schoolId, userId } = await requireRole("ADMIN");
  const { sent } = await searchParams;

  const [notifications, groups] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.group.findMany({ where: { schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} non lue(s)` : "Tout est lu"}
        action={
          unread > 0 && (
            <form action={markAllRead}>
              <button className={btnGhost}>
                <CheckCheck size={16} /> Tout marquer comme lu
              </button>
            </form>
          )
        }
      />

      {sent !== undefined && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Annonce envoyée à {sent} élève(s).</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <ul className="divide-y divide-line">
            {notifications.map((n) => {
              const Icon = n.title.startsWith("Paiement") ? CircleCheck : n.title.startsWith("Absence") ? AlertCircle : Bell;
              const tint = n.title.startsWith("Paiement") ? "bg-emerald-50 text-emerald-600" : n.title.startsWith("Absence") ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-600";
              return (
                <li key={n.id} className="flex items-start gap-3 p-4">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tint}`}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {n.title} {!n.readAt && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-brand-500 align-middle" />}
                    </p>
                    <p className="text-sm text-muted">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                </li>
              );
            })}
            {!notifications.length && <li className="p-10 text-center text-sm text-muted">Aucune notification.</li>}
          </ul>
        </Card>
        <AnnounceForm groups={groups} />
      </div>
    </>
  );
}
