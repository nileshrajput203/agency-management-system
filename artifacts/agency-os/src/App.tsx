import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect, useState, createContext, useContext } from "react";
import type { User } from "@workspace/api-client-react";

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

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("agency_token");
    const savedUser = localStorage.getItem("agency_user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("agency_token", newToken);
    localStorage.setItem("agency_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("agency_token");
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
type ThemeContextType = { theme: "light" | "dark"; toggleTheme: () => void };
export const ThemeContext = createContext<ThemeContextType>({ theme: "light", toggleTheme: () => {} });
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
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

// ─── API Client setup ───────────────────────────────────────────
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
setBaseUrl(BASE || "/");

// ─── Query Client ───────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ─── Page imports (lazy) ────────────────────────────────────────
import LoginPage from "@/pages/login";
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
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

// ─── Protected route wrapper ────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
  return <>{children}</>;
}

// ─── Router ─────────────────────────────────────────────────────
function AppRouter() {
  const { token } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => token ?? "");
  }, [token]);

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
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
      <Route path="/users">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <UsersPage />
            </DashboardLayout>
          </ProtectedRoute>
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
      <Route path="/leaves">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <LeavesPage />
            </DashboardLayout>
          </ProtectedRoute>
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
      <Route path="/settings">
        {() => (
          <ProtectedRoute>
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          </ProtectedRoute>
        )}
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
  );
}

export default App;
