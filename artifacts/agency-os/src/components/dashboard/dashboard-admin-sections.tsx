import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Briefcase, CheckCircle2, BarChart3, Layers, TrendingUp, ArrowRight,
  FolderOpen, Calendar, Sparkles, Plus, Clock, Flame
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { RANGE_OPTIONS, PIPELINE_STAGE_COLORS, PLATFORM_DOT } from "./dashboard-components";

export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-72 xl:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export function BusinessSummaryCards({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Active Clients */}
      <Card className="bg-card">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" /> Active Clients
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-foreground">
              {stats.businessSummary?.clients?.active ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">active client partners</span>
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Total Registered</p>
              <p className="text-base font-bold mt-0.5">{stats.businessSummary?.clients?.total ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Added This Month</p>
              <p className="text-base font-bold text-emerald-500 mt-0.5">+{stats.businessSummary?.clients?.newThisMonth ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Summary */}
      <Card className="bg-card">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-500" /> Projects Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-foreground">
              {stats.businessSummary?.projects?.running ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">running projects</span>
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-border/60 grid grid-cols-4 gap-1 text-[10px] text-center">
            <div>
              <p className="text-muted-foreground truncate">Total</p>
              <p className="text-sm font-bold mt-0.5">{stats.businessSummary?.projects?.total ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">Completed</p>
              <p className="text-sm font-bold text-slate-400 mt-0.5">{stats.businessSummary?.projects?.completed ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">New MTD</p>
              <p className="text-sm font-bold text-indigo-400 mt-0.5">{stats.businessSummary?.projects?.startedThisMonth ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">Overdue</p>
              <p className={cn("text-sm font-bold mt-0.5", (stats.businessSummary?.projects?.overdue ?? 0) > 0 ? "text-rose-500 font-extrabold" : "text-muted-foreground")}>
                {stats.businessSummary?.projects?.overdue ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Summary */}
      <Card className="bg-card">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-violet-500" /> Tasks Backlog
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-heading text-foreground">
              {stats.businessSummary?.tasks?.dueToday ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">due today</span>
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-border/60 grid grid-cols-5 gap-1 text-[10px] text-center">
            <div>
              <p className="text-muted-foreground truncate">Pending</p>
              <p className="text-sm font-bold mt-0.5">{stats.businessSummary?.tasks?.pending ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">In Progress</p>
              <p className="text-sm font-bold text-amber-500 mt-0.5">{stats.businessSummary?.tasks?.inProgress ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">Completed</p>
              <p className="text-sm font-bold text-emerald-500 mt-0.5">{stats.businessSummary?.tasks?.completed ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">Overdue</p>
              <p className={cn("text-sm font-bold mt-0.5", (stats.businessSummary?.tasks?.overdue ?? 0) > 0 ? "text-rose-500 font-extrabold animate-pulse" : "text-muted-foreground")}>
                {stats.businessSummary?.tasks?.overdue ?? 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground truncate">Total</p>
              <p className="text-sm font-bold mt-0.5">{stats.businessSummary?.tasks?.total ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RevenueAndOperationsSection({
  chartRange,
  setChartRange,
  chartLoading,
  revenueChart,
  stats,
}: {
  chartRange: string;
  setChartRange: (r: string) => void;
  chartLoading: boolean;
  revenueChart?: { month: string; amount: number }[];
  stats: any;
}) {
  const hasRevenueData = revenueChart && revenueChart.some((d) => d.amount > 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Revenue Trend */}
      <Card className="xl:col-span-2 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> Revenue Trend
            </CardTitle>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              {RANGE_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={chartRange === opt.key ? "default" : "ghost"}
                  className="h-6 px-2.5 text-[10px] font-bold"
                  onClick={() => setChartRange(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-48" />
          ) : !hasRevenueData ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border">
              <BarChart3 className="h-10 w-10 mb-2 opacity-30 text-primary" />
              <p className="text-sm font-medium">No revenue data available</p>
              <p className="text-xs opacity-75 mt-0.5">Paid invoices will appear here once processed</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChart ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.55 0.22 260)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="oklch(0.55 0.22 260)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                />
                <Area type="monotone" dataKey="amount" stroke="oklch(0.55 0.22 260)"
                  strokeWidth={2.5} fill="url(#revenueGrad)"
                  dot={{ fill: "oklch(0.55 0.22 260)", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Segmented Operational Analytics */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Operations Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Invoice Breakdown */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Invoices</span>
              <span className="text-foreground font-extrabold">{stats.invoiceAnalytics?.total ?? 0} total</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              <div style={{ width: `${((stats.invoiceAnalytics?.paid ?? 0) / (stats.invoiceAnalytics?.total || 1)) * 100}%` }} className="bg-emerald-500" title="Paid" />
              <div style={{ width: `${((stats.invoiceAnalytics?.sent ?? 0) / (stats.invoiceAnalytics?.total || 1)) * 100}%` }} className="bg-blue-500" title="Sent" />
              <div style={{ width: `${((stats.invoiceAnalytics?.overdue ?? 0) / (stats.invoiceAnalytics?.total || 1)) * 100}%` }} className="bg-rose-500" title="Overdue" />
              <div style={{ width: `${((stats.invoiceAnalytics?.draft ?? 0) / (stats.invoiceAnalytics?.total || 1)) * 100}%` }} className="bg-slate-400" title="Draft" />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Paid: {stats.invoiceAnalytics?.paid ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Sent: {stats.invoiceAnalytics?.sent ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Overdue: {stats.invoiceAnalytics?.overdue ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Draft: {stats.invoiceAnalytics?.draft ?? 0}</span>
            </div>
          </div>

          {/* Quotations Breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Quotations</span>
              <span className="text-foreground font-extrabold">{stats.quotationAnalytics?.total ?? 0} total</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              <div style={{ width: `${((stats.quotationAnalytics?.accepted ?? 0) / (stats.quotationAnalytics?.total || 1)) * 100}%` }} className="bg-emerald-500" title="Accepted" />
              <div style={{ width: `${((stats.quotationAnalytics?.sent ?? 0) / (stats.quotationAnalytics?.total || 1)) * 100}%` }} className="bg-indigo-500" title="Sent" />
              <div style={{ width: `${((stats.quotationAnalytics?.draft ?? 0) / (stats.quotationAnalytics?.total || 1)) * 100}%` }} className="bg-slate-400" title="Draft" />
              <div style={{ width: `${((stats.quotationAnalytics?.rejected ?? 0) / (stats.quotationAnalytics?.total || 1)) * 100}%` }} className="bg-rose-500" title="Rejected" />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Accepted: {stats.quotationAnalytics?.accepted ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Sent: {stats.quotationAnalytics?.sent ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Draft: {stats.quotationAnalytics?.draft ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Rejected: {stats.quotationAnalytics?.rejected ?? 0}</span>
            </div>
          </div>

          {/* Purchase Orders Breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Purchase Orders</span>
              <span className="text-foreground font-extrabold">{stats.purchaseOrderAnalytics?.total ?? 0} total</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
              <div style={{ width: `${((stats.purchaseOrderAnalytics?.completed ?? 0) / (stats.purchaseOrderAnalytics?.total || 1)) * 100}%` }} className="bg-emerald-500" title="Completed" />
              <div style={{ width: `${((stats.purchaseOrderAnalytics?.approved ?? 0) / (stats.purchaseOrderAnalytics?.total || 1)) * 100}%` }} className="bg-amber-500" title="Approved" />
              <div style={{ width: `${((stats.purchaseOrderAnalytics?.ordered ?? 0) / (stats.purchaseOrderAnalytics?.total || 1)) * 100}%` }} className="bg-violet-500" title="Ordered" />
              <div style={{ width: `${((stats.purchaseOrderAnalytics?.pending ?? 0) / (stats.purchaseOrderAnalytics?.total || 1)) * 100}%` }} className="bg-slate-400" title="Pending" />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Completed: {stats.purchaseOrderAnalytics?.completed ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Approved: {stats.purchaseOrderAnalytics?.approved ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Ordered: {stats.purchaseOrderAnalytics?.ordered ?? 0}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Pending: {stats.purchaseOrderAnalytics?.pending ?? 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PipelineAndHealthSection({ stats, navigate }: { stats: any; navigate: (path: string) => void }) {
  const healthData = [
    { name: "On Track", value: stats.projectHealth?.onTrack ?? 0, color: "#10b981" },
    { name: "At Risk", value: stats.projectHealth?.atRisk ?? 0, color: "#f59e0b" },
    { name: "Delayed", value: stats.projectHealth?.delayed ?? 0, color: "#ef4444" },
    { name: "Completed", value: stats.projectHealth?.completed ?? 0, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Sales Pipeline */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Sales Pipeline Value
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/sales")}>
              Pipeline Desk <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.leadPipeline?.stages?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active leads in pipeline</p>
          ) : (
            <div className="space-y-3.5">
              {stats.leadPipeline?.stages?.map((stage: any) => {
                const maxCount = Math.max(...(stats.leadPipeline?.stages?.map((s: any) => s.count) ?? [1]));
                const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                return (
                  <div key={stage.stage} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{stage.count} lead{stage.count !== 1 ? "s" : ""}</Badge>
                      </div>
                      {stage.value > 0 && (
                        <span className="text-xs font-bold text-emerald-500">
                          ₹{(stage.value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", PIPELINE_STAGE_COLORS[stage.stage] ?? "bg-slate-400")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground pt-1.5 border-t border-border/40">
                Total pipeline potential: <span className="font-bold text-foreground">₹{(stats.leadPipeline?.totalValue ?? 0).toLocaleString("en-IN")}</span> across active leads
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Health Donut */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" /> Active Project Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mb-2 opacity-30 text-primary" />
              <p className="text-sm font-medium">No active projects</p>
              <p className="text-xs opacity-75 mt-0.5">Create a project to monitor delivery health</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              <div className="md:col-span-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={healthData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {healthData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, "Projects"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="md:col-span-2 space-y-2 text-xs">
                {healthData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{item.value} project{item.value !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function MonthOverviewAndInsightsSection({ stats, navigate }: { stats: any; navigate: (path: string) => void }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* This Month Overview */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> This Month Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projects Started</p>
            <p className="text-lg font-bold text-indigo-400 mt-1">{stats.thisMonthOverview?.projectsCreated ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projects Closed</p>
            <p className="text-lg font-bold text-emerald-500 mt-1">{stats.thisMonthOverview?.projectsCompleted ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Clients Added</p>
            <p className="text-lg font-bold text-primary mt-1">{stats.thisMonthOverview?.clientsAdded ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tasks Completed</p>
            <p className="text-lg font-bold text-violet-500 mt-1">{stats.thisMonthOverview?.tasksCompleted ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Invoices Raised</p>
            <p className="text-lg font-bold text-blue-400 mt-1">{stats.thisMonthOverview?.invoicesGenerated ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quotes Created</p>
            <p className="text-lg font-bold text-pink-500 mt-1">{stats.thisMonthOverview?.quotationsGenerated ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">POs Issued</p>
            <p className="text-lg font-bold text-amber-500 mt-1">{stats.thisMonthOverview?.purchaseOrdersCreated ?? 0}</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Collected MTD</p>
            <p className="text-xs font-bold text-emerald-500 mt-2 truncate">₹{(stats.thisMonthOverview?.revenueCollected ?? 0).toLocaleString("en-IN")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Insights & Actions */}
      <div className="space-y-6">
        {/* Insights Card */}
        <Card className="bg-gradient-to-br from-indigo-950/20 to-card border border-primary/10">
          <CardHeader className="pb-2.5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" /> Agency Health Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.quickInsights?.length === 0 ? (
              <p className="text-xs text-muted-foreground">All systems stable. No pending highlights.</p>
            ) : (
              stats.quickInsights?.map((insight: string, idx: number) => (
                <div key={idx} className="flex gap-2.5 items-start bg-muted/20 p-2.5 rounded-lg border border-border/40 text-xs">
                  <span className="text-emerald-500 font-bold shrink-0">✦</span>
                  <p className="text-foreground/90 font-medium leading-relaxed">{insight}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Panel */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Executive Launchpad
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <Button onClick={() => navigate("/clients")} variant="outline" className="h-20 flex flex-col gap-1.5 items-center justify-center p-2 text-center rounded-xl bg-muted/20 border border-border/50 hover:border-primary/40 scale-hover">
              <Plus className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-bold">Add Client</span>
            </Button>
            <Button onClick={() => navigate("/projects")} variant="outline" className="h-20 flex flex-col gap-1.5 items-center justify-center p-2 text-center rounded-xl bg-muted/20 border border-border/50 hover:border-primary/40 scale-hover">
              <Plus className="h-4 w-4 text-indigo-500" />
              <span className="text-[10px] font-bold">New Project</span>
            </Button>
            <Button onClick={() => navigate("/invoices")} variant="outline" className="h-20 flex flex-col gap-1.5 items-center justify-center p-2 text-center rounded-xl bg-muted/20 border border-border/50 hover:border-primary/40 scale-hover">
              <Plus className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] font-bold">Bill Invoice</span>
            </Button>
            <Button onClick={() => navigate("/quotations")} variant="outline" className="h-20 flex flex-col gap-1.5 items-center justify-center p-2 text-center rounded-xl bg-muted/20 border border-border/50 hover:border-primary/40 scale-hover">
              <Plus className="h-4 w-4 text-violet-500" />
              <span className="text-[10px] font-bold">New Quote</span>
            </Button>
            <Button onClick={() => navigate("/tasks")} variant="outline" className="h-20 flex flex-col gap-1.5 items-center justify-center p-2 text-center rounded-xl bg-muted/20 border border-border/50 hover:border-primary/40 scale-hover col-span-2 sm:col-span-1">
              <Plus className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-bold">Assign Task</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DeadlinesAndContentSection({
  stats,
  navigate,
  allWeekPosts,
  weekDays,
  postsByDay,
}: {
  stats: any;
  navigate: (path: string) => void;
  allWeekPosts: any[];
  weekDays: Date[];
  postsByDay: Record<string, { platform: string }[]>;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Upcoming Deadlines */}
      <Card className="xl:col-span-2 bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Upcoming Deadlines & Leave Schedules
          </CardTitle>
          <span className="text-xs text-muted-foreground">Chronological priorities</span>
        </CardHeader>
        <CardContent>
          {stats.upcomingDeadlines?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border rounded-xl bg-card/10">
              <Clock className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">All quiet this month</p>
              <p className="text-xs opacity-75 mt-0.5">No upcoming deadlines or employee leaves scheduled</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {stats.upcomingDeadlines?.map((item: any) => {
                const dateLabel = format(new Date(item.date), "dd MMM yyyy");

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-all duration-150 justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-base">
                        {item.type === "project" ? "💼" : item.type === "invoice" ? "🧾" : item.type === "task" ? "📋" : "🌴"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                            {item.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {item.extraInfo}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-xs font-bold", item.overdue ? "text-rose-500 font-black animate-pulse" : "text-foreground")}>
                        {dateLabel}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {item.overdue ? "Immediate Action Required" : "Upcoming deadline"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Calendar Week Strip */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-orange-500 animate-pulse" /> Week's Social Content
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/content")}>
              Calendar <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allWeekPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border">
              <Flame className="h-8 w-8 mb-2 opacity-30 text-orange-500" />
              <p className="text-sm font-medium">No scheduled content.</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayPosts = postsByDay[dayKey] ?? [];
                const isCurrentDay = isToday(day);
                return (
                  <div
                    key={dayKey}
                    onClick={() => navigate("/content")}
                    className={cn(
                      "flex flex-col items-center gap-1 p-1.5 rounded-lg border cursor-pointer transition-colors hover:border-primary/40",
                      isCurrentDay ? "bg-primary/5 border-primary/30" : "border-border bg-card/50"
                    )}
                  >
                    <p className={cn("text-[9px] font-semibold uppercase", isCurrentDay ? "text-primary font-black" : "text-muted-foreground")}>
                      {format(day, "EEE")}
                    </p>
                    <p className={cn("text-sm font-bold font-heading leading-none", isCurrentDay ? "text-primary" : "text-foreground")}>
                      {format(day, "d")}
                    </p>
                    {dayPosts.length > 0 ? (
                      <div className="flex flex-wrap gap-0.5 justify-center mt-1">
                        {dayPosts.slice(0, 3).map((p, i) => (
                          <div key={i} className={cn("h-1.5 w-1.5 rounded-full", PLATFORM_DOT[p.platform] ?? "bg-slate-400")} />
                        ))}
                      </div>
                    ) : (
                      <div className="h-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
