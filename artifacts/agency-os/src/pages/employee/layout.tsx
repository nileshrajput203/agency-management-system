import { useAuth, useTheme } from "@/App";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Users, TrendingUp, FolderKanban, CheckSquare,
  Calendar, Clock, Umbrella, Bell, User, Sun, Moon, LogOut, ChevronRight, CalendarDays, FileCheck,
} from "lucide-react";
import { NotificationsPopover } from "@/components/common/NotificationsPopover";
import { CompanyLogo } from "@/components/common/CompanyLogo";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItemDef extends NavItem {
  modules?: string[]; // allowed if user has ANY of these modules; undefined = always visible
}

interface NavGroupDef {
  label: string;
  items: NavItemDef[];
}

const ALL_EMPLOYEE_NAV_GROUPS: NavGroupDef[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/employee/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: "My Work",
    items: [
      { label: "My Clients",        href: "/employee/clients",          icon: <Users className="h-4 w-4" />,                               modules: ["clients"] },
      { label: "Sales Funnel",      href: "/sales",                      icon: <TrendingUp className="h-4 w-4" />,                           modules: ["sales"] },
      { label: "My Projects",       href: "/employee/projects",         icon: <FolderKanban className="h-4 w-4" />,                         modules: ["projects"] },
      { label: "My Tasks",          href: "/employee/tasks",            icon: <CheckSquare className="h-4 w-4" />,                          modules: ["tasks"] },
      { label: "Work Reports",      href: "/employee/work-reports",     icon: <FileCheck className="h-4 w-4 text-emerald-500" /> },
      { label: "Meetings",          href: "/employee/meetings",         icon: <CalendarDays className="h-4 w-4 text-blue-500" />,           modules: ["clients", "projects"] },
      { label: "Content Calendar",  href: "/employee/content-calendar", icon: <Calendar className="h-4 w-4" />,                            modules: ["content"] },
    ],
  },
  {
    label: "People & HR",
    items: [
      { label: "Attendance", href: "/employee/attendance", icon: <Clock className="h-4 w-4" />,    modules: ["attendance"] },
      { label: "Leave",      href: "/employee/leave",      icon: <Umbrella className="h-4 w-4" />, modules: ["leaves"] },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Notifications", href: "/employee/notifications", icon: <Bell className="h-4 w-4" /> },
      { label: "Profile",       href: "/employee/profile",       icon: <User className="h-4 w-4" /> },
    ],
  },
];

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, navigate] = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "E";

  const userAllowedModules: string[] = user?.allowedModules ?? [];
  const employeeNavGroups = ALL_EMPLOYEE_NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.modules) return true; // no restriction = always visible
        return item.modules.some(m => userAllowedModules.includes(m));
      }),
    }))
    .filter(group => group.items.length > 0);

  const getBreadcrumb = () => {
    if (location.includes("work-reports")) return "Work Reports";
    if (location.includes("clients")) return "My Clients";
    if (location.includes("leads")) return "Sales Funnel";
    if (location.includes("projects")) return "My Projects";
    if (location.includes("tasks")) return "My Tasks";
    if (location.includes("meetings")) return "Meetings";
    if (location.includes("content")) return "Content Calendar";
    if (location.includes("attendance")) return "Attendance";
    if (location.includes("leave")) return "Leave Management";
    if (location.includes("notifications")) return "Notifications";
    if (location.includes("profile")) return "Profile Settings";
    return "Dashboard";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Employee Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar overflow-y-auto">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
          <CompanyLogo variant="sidebar" size={36} />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-5">
          {employeeNavGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.href || location.startsWith(item.href + "/") || location.startsWith(item.href + "?");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-testid={`emp-nav-${item.href.replace("/employee/", "")}`}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className={cn(isActive ? "text-current" : "text-muted-foreground group-hover:text-current")}>
                        {item.icon}
                      </span>
                      {item.label}
                      {isActive && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.systemRole || "Employee"}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/employee/profile")}>
                <User className="h-4 w-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "light" ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background flex flex-col">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-card/40 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>Portal</span>
            <span>/</span>
            <span className="font-semibold text-foreground">{getBreadcrumb()}</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsPopover />
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-lg">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
