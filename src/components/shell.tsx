import Link from "next/link";
import {
  Bell,
  BellRing,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  School,
  LogOut,
  Search,
  Settings,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";
import { NavLink } from "@/components/nav-link";
import { MobileMenu } from "@/components/mobile-menu";
import { Avatar } from "@/components/ui";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const NAV: Record<"ADMIN" | "TEACHER", Item[]> = {
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/students", label: "Élèves", icon: Users },
    { href: "/admin/groups", label: "Groupes", icon: School },
    { href: "/admin/specialties", label: "Matières", icon: BookOpen },
    { href: "/admin/levels", label: "Niveaux", icon: GraduationCap },
    { href: "/admin/enrollments", label: "Inscriptions", icon: ClipboardList },
    { href: "/admin/attendance", label: "Présences", icon: CalendarCheck },
    { href: "/admin/absences", label: "Absences & Preuves", icon: FileText },
    { href: "/admin/teachers-attendance", label: "Présence enseignants", icon: ClipboardList },
    { href: "/admin/timetable", label: "Emploi du temps", icon: CalendarClock },
    { href: "/admin/invoices", label: "Factures", icon: Wallet },
    { href: "/admin/reminders", label: "Relances", icon: BellRing },
    { href: "/admin/reports", label: "Rapports", icon: ChartColumn },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/users", label: "Utilisateurs", icon: UserCog },
    { href: "/admin/settings", label: "Paramètres", icon: Settings },
  ],
  TEACHER: [
    { href: "/teacher", label: "Mes groupes", icon: Users, exact: true },
    { href: "/teacher/attendance", label: "Présences", icon: CalendarCheck },
  ],
};

function SchoolLogo({ school, size = 40 }: { school: { name: string; logo: string | null }; size?: number }) {
  if (school.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={school.logo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-lg bg-white object-contain p-1" />;
  }
  return (
    <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15">
      <BookOpen size={size * 0.55} />
    </span>
  );
}

function Sidebar({
  role,
  school,
  user,
}: {
  role: "ADMIN" | "TEACHER";
  school: { name: string; logo: string | null };
  user: { name: string; email: string };
}) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy-900 to-navy-950 text-slate-300">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <SchoolLogo school={school} />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-semibold text-white">{school.name}</p>
          <p className="text-xs text-slate-400">Centre de soutien</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV[role].map(({ href, label, icon: Icon, exact }) => (
          <NavLink
            key={href}
            href={href}
            exact={exact}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            activeClassName="!bg-brand-600 !text-white shadow-sm"
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size={36} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <form action={logout}>
          <button className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
            <LogOut size={16} /> Déconnexion
          </button>
        </form>
      </div>
    </div>
  );
}

export function AppShell({
  role,
  school,
  user,
  unread = 0,
  children,
}: {
  role: "ADMIN" | "TEACHER";
  school: { name: string; logo: string | null };
  user: { name: string; email: string };
  unread?: number;
  children: ReactNode;
}) {
  const roleLabel = role === "ADMIN" ? "Super Admin" : "Enseignant";
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar role={role} school={school} user={user} />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:px-8">
        <MobileMenu>
          <Sidebar role={role} school={school} user={user} />
        </MobileMenu>

        {role === "ADMIN" ? (
          <form action="/admin/students" className="relative w-full max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              placeholder="Rechercher un élève, un groupe…"
              className="w-full rounded-lg border border-transparent bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
            />
          </form>
        ) : (
          <div className="flex-1" />
        )}

        <div className="ml-auto flex items-center gap-4">
          {role === "ADMIN" && (
            <Link href="/admin/notifications" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <Avatar name={user.name} size={34} />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">{roleLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 lg:p-8">{children}</main>
    </div>
  );
}
