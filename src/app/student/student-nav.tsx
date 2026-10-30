import { CalendarCheck, CalendarDays, House, Wallet, BookOpen } from "lucide-react";
import { NavLink } from "@/components/nav-link";

const items = [
  { href: "/student", label: "Accueil", icon: House, exact: true },
  { href: "/student/enrollments", label: "Cours", icon: BookOpen },
  { href: "/student/schedule", label: "Horaires", icon: CalendarDays },
  { href: "/student/attendance", label: "Présences", icon: CalendarCheck },
  { href: "/student/payments", label: "Paiements", icon: Wallet },
];

export function StudentNav({ unread }: { unread: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-md grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      {items.map(({ href, label, icon: Icon, exact }) => (
        <NavLink
          key={href}
          href={href}
          exact={exact}
          className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-slate-400"
          activeClassName="!text-brand-600"
        >
          <span className="relative">
            <Icon size={20} />
            {exact && unread > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{unread}</span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
