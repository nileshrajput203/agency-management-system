import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState, createContext, useContext, Component, ErrorInfo, ReactNode } from "react";
import type { User } from "@workspace/api-client-react";

// ─── React Error Boundary ──────────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorId: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorId: "",
  };

  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    const errorId = "ERR-" + Math.random().toString(36).substring(2, 11).toUpperCase();
    return { hasError: true, errorId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 font-heading">Something went wrong.</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              An unexpected component crash occurred. Click reload below to refresh the page.
            </p>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2.5 rounded select-all border border-slate-200 dark:border-slate-700">
              Error ID: {this.state.errorId}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-50 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-sm transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ─── Auth Context ───────────────────────────────────────────────
type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

// Module-level variable to synchronously track active authentication token across transitions
let activeToken: string | null = typeof window !== "undefined" ? (localStorage.getItem("agency_token") || localStorage.getItem("token")) : null;

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("agency_token") || localStorage.getItem("token");
    const savedUser = localStorage.getItem("agency_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        activeToken = savedToken;
        localStorage.setItem("agency_token", savedToken);
        localStorage.setItem("token", savedToken);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    activeToken = newToken;
    localStorage.setItem("agency_token", newToken);
    localStorage.setItem("token", newToken);
    localStorage.setItem("agency_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    activeToken = null;
    localStorage.removeItem("agency_token");
    localStorage.removeItem("token");
    localStorage.removeItem("agency_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Theme Context ──────────────────────────────────────────────
type ThemeContextType = { theme: "light" | "dark"; toggleTheme: () => void; setTheme: (t: "light" | "dark") => void };
export const ThemeContext = createContext<ThemeContextType>({ theme: "light", toggleTheme: () => {}, setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") ?? "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

// ─── API Client setup ───────────────────────────────────────────
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(BASE || "/");

// Register a single static auth token getter that accesses the dynamic activeToken state and localStorage fallback
setAuthTokenGetter(() => {
  return activeToken || (typeof window !== "undefined" ? (localStorage.getItem("agency_token") || localStorage.getItem("token")) : null) || "";
});

// ─── Entity Dependency Cache Synchronizer ──────────────────────────
const MUTATION_TO_ENTITY: Record<string, string> = {
  createClient: "clients",
  updateClient: "clients",
  deleteClient: "clients",

  createProject: "projects",
  updateProject: "projects",
  deleteProject: "projects",

  createTask: "tasks",
  updateTask: "tasks",
  deleteTask: "tasks",

  createLead: "leads",
  updateLead: "leads",
  deleteLead: "leads",

  createContentPost: "contentPosts",
  updateContentPost: "contentPosts",
  deleteContentPost: "contentPosts",
  createCalendarShare: "calendarShares",

  createInvoice: "invoices",
  updateInvoice: "invoices",
  deleteInvoice: "invoices",

  createQuotation: "quotations",
  updateQuotation: "quotations",
  deleteQuotation: "quotations",
  convertQuotationToInvoice: "invoices",

  createProposal: "proposals",
  updateProposal: "proposals",
  deleteProposal: "proposals",

  createUser: "users",
  updateUser: "users",
  deleteUser: "users",

  checkIn: "attendance",
  checkOut: "attendance",

  createLeaveRequest: "leaves",
  approveLeaveRequest: "leaves",
  rejectLeaveRequest: "leaves",

  updateSettings: "settings",

  createProformaInvoice: "proformaInvoices",
  updateProformaInvoice: "proformaInvoices",
  deleteProformaInvoice: "proformaInvoices",

  createPurchaseOrder: "purchaseOrders",
  updatePurchaseOrder: "purchaseOrders",
  deletePurchaseOrder: "purchaseOrders",

  createDeliveryChallan: "deliveryChallans",
  updateDeliveryChallan: "deliveryChallans",
  deleteDeliveryChallan: "deliveryChallans",
};

const ENTITY_QUERIES: Record<string, string[]> = {
  projects: ["/api/projects", "/api/tasks"],
  clients: [
    "/api/clients",
    "/api/projects",
    "/api/invoices",
    "/api/quotations",
    "/api/proposals",
    "/api/purchase-orders",
    "/api/leads",
    "/api/content-posts"
  ],
  tasks: ["/api/tasks"],
  leads: ["/api/leads"],
  contentPosts: ["/api/content-posts"],
  calendarShares: ["/api/content-posts/shares"],
  invoices: ["/api/invoices"],
  quotations: ["/api/quotations"],
  proposals: ["/api/proposals"],
  users: [
    "/api/users",
    "/api/tasks",
    "/api/attendance",
    "/api/leave-requests",
    "/api/projects"
  ],
  attendance: ["/api/attendance", "/api/attendance/today"],
  leaves: ["/api/leave-requests", "/api/attendance"],
  settings: ["/api/settings"],
  proformaInvoices: ["/api/proforma-invoices"],
  purchaseOrders: ["/api/purchase-orders"],
  deliveryChallans: ["/api/delivery-challans"]
};

function resolveDependencies(mutationKey: string, variables: any): Set<string> {
  const prefixes = new Set<string>();
  const entity = MUTATION_TO_ENTITY[mutationKey];

  if (entity && ENTITY_QUERIES[entity]) {
    ENTITY_QUERIES[entity].forEach(prefix => prefixes.add(prefix));
  }

  if (mutationKey === "convertQuotationToInvoice") {
    ENTITY_QUERIES.quotations?.forEach(prefix => prefixes.add(prefix));
  }

  // Check if we should invalidate Recent Activity
  const isCreate = mutationKey.startsWith("create") || mutationKey === "checkIn" || mutationKey === "checkOut";
  const isDelete = mutationKey.startsWith("delete");
  const isAction = [
    "approveLeaveRequest",
    "rejectLeaveRequest",
    "convertQuotationToInvoice"
  ].includes(mutationKey);

  let statusChanged = false;
  if (variables && typeof variables === 'object') {
    const payload = variables.data || variables;
    if (payload && typeof payload === 'object' && ('status' in payload || 'completed' in payload || 'paid' in payload || 'approved' in payload)) {
      statusChanged = true;
    }
  }

  if (isCreate || isDelete || isAction || (mutationKey.startsWith("update") && statusChanged)) {
    prefixes.add("/api/recent-activity");
  }

  // Check if we should invalidate Dashboard Stats / Revenue Chart
  let affectsDashboard = false;
  if (isCreate || isDelete || isAction) {
    affectsDashboard = true;
  } else if (mutationKey.startsWith("update") && variables && typeof variables === 'object') {
    const payload = variables.data || variables;
    if (payload && typeof payload === 'object') {
      const dashboardKeys = ["status", "total", "amount", "paid", "priority", "completed", "approved", "checkIn", "checkOut"];
      affectsDashboard = dashboardKeys.some(k => k in payload);
    }
  }

  if (affectsDashboard) {
    prefixes.add("/api/dashboard/stats");
    prefixes.add("/api/dashboard/revenue-chart");
  }

  return prefixes;
}

// ─── Query Client ───────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      queryClient.invalidateQueries();
    },
  }),
});

if (typeof window !== "undefined" && !(window as any).__api_fetch_intercepted__) {
  (window as any).__api_fetch_intercepted__ = true;
  try {
    const originalFetch = window.fetch;
    if (originalFetch) {
      const interceptedFetch = async function (...args: any[]) {
        const response = await originalFetch.apply(window, args as [RequestInfo | URL, RequestInit?]);
        try {
          if (response.ok) {
            const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
            const options = typeof args[1] === "object" ? args[1] : (typeof args[0] === "object" ? (args[0] as RequestInit) : undefined);
            const method = (options?.method || "GET").toUpperCase();
            if (method !== "GET" && url.includes("/api/")) {
              queryClient.invalidateQueries();
            }
          }
        } catch (e) {
          // Ignore interceptor errors
        }
        return response;
      };

      try {
        window.fetch = interceptedFetch;
      } catch {
        try {
          Object.defineProperty(window, "fetch", {
            value: interceptedFetch,
            writable: true,
            configurable: true,
          });
        } catch {
          // fetch is read-only in this environment
        }
      }
    }
  } catch (e) {
    // Ignore fetch interceptor setup errors
  }
}

// ─── Page imports (lazy) ────────────────────────────────────────
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardLayout from "@/pages/layout";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/clients/detail";
import SalesPage from "@/pages/sales";
import ProjectsPage from "@/pages/projects";
import TasksPage from "@/pages/tasks";
import ContentPage from "@/pages/content";
import InvoicesPage from "@/pages/invoices";
import QuotationsPage from "@/pages/quotations";
import UsersPage from "@/pages/users";
import AttendancePage from "@/pages/attendance";
import LeavesPage from "@/pages/leaves";
import ProposalsPage from "@/pages/proposals";
import MeetingsPage from "@/pages/meetings";
import SettingsPage from "@/pages/settings";
import HawanHubPage from "@/pages/hawan";
import NotFound from "@/pages/not-found";
import ClientPortalPage from "@/pages/portal";
import PublicCalendarPage from "@/pages/public-calendar";
import PurchaseOrdersPage from "@/pages/purchase-orders";
import ExcelReportsPage from "@/pages/excel-reports";
import NotificationsPage from "@/pages/notifications";
import WorkReportsPage from "@/pages/work-reports";
import PerformanceReportPage from "@/pages/performance-report";

// ─── Employee Portal imports ────────────────────────────────────
import EmployeeLayout from "@/pages/employee/layout";
import EmployeeDashboardPage from "@/pages/employee/dashboard";
import EmployeeClientsPage from "@/pages/employee/clients";
import EmployeeLeadsPage from "@/pages/employee/leads";
import EmployeeProjectsPage from "@/pages/employee/projects";
import EmployeeTasksPage from "@/pages/employee/tasks";
import EmployeeMeetingsPage from "@/pages/employee/meetings";
import EmployeeContentPage from "@/pages/employee/content";
import EmployeeAttendancePage from "@/pages/employee/attendance";
import EmployeeLeavePage from "@/pages/employee/leave";
import EmployeeNotificationsPage from "@/pages/employee/notifications";
import EmployeeProfilePage from "@/pages/employee/profile";
import EmployeeWorkReportsPage from "@/pages/employee/work-reports";

// ─── Protected route wrapper ────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-violet-500 animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium">Loading AgencyOS...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;

  const adminRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"];
  const isEmployee = !adminRoles.includes(user.systemRole) && !adminRoles.includes(user.role);

  if (isEmployee) {
    if (user.isDelegatedAdmin && user.portalMode === "MODE_2") {
      return <>{children}</>;
    }
    // A delegated employee with an explicitly enabled module can use the
    // complete module page, not just the limited employee dashboard.
    const moduleForPath: Record<string, string> = {
      "/sales": "sales",
      "/clients": "clients",
      "/projects": "projects",
      "/content": "content",
      "/tasks": "tasks",
      "/attendance": "attendance",
      "/leaves": "leaves",
    };
    const module = Object.entries(moduleForPath).find(([path]) =>
      location === path || location.startsWith(`${path}/`)
    )?.[1];
    if (module && (user.allowedModules ?? []).includes(module)) {
      return <>{children}</>;
    }
    return <Redirect to="/employee/dashboard" />;
  }

  return <>{children}</>;
}

// ─── Employee route wrapper ─────────────────────────────────────
function EmployeeRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-violet-500 animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium">Loading Employee Portal...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return <>{children}</>;
}

// ─── Access Denied fallback ─────────────────────────────────────
function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md p-8 bg-card border border-border rounded-2xl shadow-lg text-center space-y-5">
        <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-2xl font-bold">
          🚫
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have the required permissions to view this section. Please contact your system administrator if you believe this is an error.
          </p>
        </div>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-all duration-200 shadow-sm shadow-primary/10 hover:shadow"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Admin route wrapper ────────────────────────────────────────
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-violet-500 animate-pulse" />
          <p className="text-sm text-muted-foreground font-medium">Loading AgencyOS...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  const isPrivilegedAdmin =
    ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(user.systemRole) ||
    (user.isDelegatedAdmin && (user.portalMode === "MODE_2" || user.allowedModules?.includes("team") || user.allowedModules?.includes("settings")));
  if (!isPrivilegedAdmin) {
    return <AccessDeniedPage />;
  }
  return <>{children}</>;
}

// ─── Router ─────────────────────────────────────────────────────
function AppRouter() {
  const { token } = useAuth();

  useEffect(() => {
    if (token !== undefined) {
      activeToken = token;
    }
  }, [token]);

  return (
    <Switch>
      <Route path="/content-calendar/share/:shareToken" component={PublicCalendarPage} />
      <Route path="/share/calendar/:shareToken" component={PublicCalendarPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/portal/:clientId">
        {({ clientId }) => <ClientPortalPage clientId={clientId!} />}
      </Route>
      <Route path="/dashboard">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/clients/:id">
        {({ id }) => (
          <ProtectedRoute>
            <DashboardLayout>
              <ClientDetailPage id={id!} />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/clients">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <ClientsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sales">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <SalesPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/projects">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <ProjectsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/tasks">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <TasksPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/content">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <ContentPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/invoices">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <InvoicesPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/quotations">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <QuotationsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/purchase-orders">
        {() => (
          <AdminRoute>
            <DashboardLayout>
              <PurchaseOrdersPage />
            </DashboardLayout>
          </AdminRoute>
        )}
      </Route>
      <Route path="/proposals">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <ProposalsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/users">
        {() => (
          <AdminRoute>
            <DashboardLayout>
              <UsersPage />
            </DashboardLayout>
          </AdminRoute>
        )}
      </Route>
      <Route path="/attendance">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <AttendancePage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/meetings">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <MeetingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/leaves">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <LeavesPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/notifications">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <NotificationsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/excel-reports">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <ExcelReportsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/work-reports">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <WorkReportsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/performance-report">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <PerformanceReportPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hawan">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <HawanHubPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <AdminRoute>
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          </AdminRoute>
        )}
      </Route>

      {/* ─── Employee Portal Routes ───────────────────────────────── */}
      <Route path="/employee/dashboard">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeDashboardPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/clients">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeClientsPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/leads">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeLeadsPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/projects">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeProjectsPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/tasks">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeTasksPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/meetings">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeMeetingsPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/content-calendar">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeContentPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/attendance">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeAttendancePage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/leave">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeLeavePage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/notifications">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeNotificationsPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/profile">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeProfilePage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/employee/work-reports">
        {() => (
          <EmployeeRoute>
            <EmployeeLayout>
              <EmployeeWorkReportsPage />
            </EmployeeLayout>
          </EmployeeRoute>
        )}
      </Route>
      <Route path="/admin">
        {() => <Redirect to="/dashboard" />}
      </Route>
      <Route path="/admin/:rest*">
        {() => <Redirect to="/dashboard" />}
      </Route>
      <Route path="/employee">
        {() => <Redirect to="/employee/dashboard" />}
      </Route>

      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <WouterRouter base={BASE}>
              <AppRouter />
            </WouterRouter>
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
