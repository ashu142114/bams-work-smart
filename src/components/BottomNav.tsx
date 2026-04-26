import { Link, useLocation } from "@tanstack/react-router";
import { Home, Clock, Users, Settings, ClipboardList, UserCog, ListChecks, ShieldCheck } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const navByRole: Record<AppRole, NavItem[]> = {
  admin: [
    { to: "/admin/home", label: "Home", icon: Home },
    { to: "/admin/tasks", label: "Tasks", icon: ListChecks },
    { to: "/admin/users", label: "Users", icon: UserCog },
    { to: "/admin/team", label: "Teams", icon: Users },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ],
  hr: [
    { to: "/hr/home", label: "Home", icon: Home },
    { to: "/hr/attendance", label: "Attendance", icon: Clock },
    { to: "/hr/users", label: "Users", icon: UserCog },
    { to: "/hr/team", label: "Teams", icon: Users },
  ],
  leader: [
    { to: "/leader/home", label: "Home", icon: Home },
    { to: "/leader/tasks", label: "Tasks", icon: ListChecks },
    { to: "/leader/review", label: "Review", icon: ShieldCheck },
    { to: "/leader/team", label: "Team", icon: Users },
  ],
  employee: [
    { to: "/employee/home", label: "Home", icon: Home },
    { to: "/employee/tasks", label: "Tasks", icon: ListChecks },
    { to: "/employee/attendance", label: "History", icon: ClipboardList },
  ],
};

export function BottomNav() {
  const { role } = useAuth();
  const loc = useLocation();
  if (!role) return null;
  const items = navByRole[role];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-border bg-card/95 backdrop-blur safe-bottom z-40">
      <ul className="flex items-stretch justify-around px-2 pt-2">
        {items.map((it) => {
          const active = loc.pathname === it.to || loc.pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <li key={it.to} className="flex-1">
              <Link
                to={it.to}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
