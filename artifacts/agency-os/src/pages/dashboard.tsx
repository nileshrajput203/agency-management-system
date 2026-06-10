import {
  useGetDashboardStats,
  useGetRevenueChart,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, Users, TrendingUp, IndianRupee, Clock, BarChart3,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  label, value, icon, trend, color = "primary",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}) {
  return (
    <Card className="scale-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-1.5 text-2xl font-bold font-heading text-foreground">{value}</p>
            {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
          </div>
          <div className={`p-2.5 rounded-xl bg-primary/10 text-primary`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: revenueChart, isLoading: chartLoading } = useGetRevenueChart();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {greeting()}, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here is what is happening at Blink Beyond today.
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>
          ))
        ) : (
          <>
            <StatCard
              label="Active Projects"
              value={stats?.activeProjects ?? 0}
              icon={<FolderKanban className="h-5 w-5" />}
            />
            <StatCard
              label="Total Clients"
              value={stats?.totalClients ?? 0}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Open Leads"
              value={stats?.openLeads ?? 0}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              label="Revenue Collected"
              value={`₹${((stats?.revenuePaid ?? 0) / 100000).toFixed(1)}L`}
              icon={<IndianRupee className="h-5 w-5" />}
              trend={`₹${((stats?.outstanding ?? 0) / 100000).toFixed(1)}L outstanding`}
            />
            <StatCard
              label="Tasks Due"
              value={stats?.tasksDue ?? 0}
              icon={<Clock className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={revenueChart ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 240)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "oklch(0.48 0.02 240)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "oklch(0.48 0.02 240)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid oklch(0.91 0.01 240)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="oklch(0.55 0.22 260)"
                    strokeWidth={2.5}
                    dot={{ fill: "oklch(0.55 0.22 260)", strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              ))
            ) : (activity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
            ) : (
              (activity ?? []).slice(0, 8).map((item) => (
                <div key={item.id} className="flex gap-2.5 items-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary uppercase">
                      {(item.type?.[0] ?? "S").toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground leading-snug line-clamp-2">{item.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
