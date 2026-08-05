import { useState } from "react";
import { useGetDashboardStats, useListContentPosts } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndianRupee, Landmark, FileCheck, ShoppingBag, RefreshCw } from "lucide-react";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";

import { StatCard, PLATFORM_DOT } from "@/components/dashboard/dashboard-components";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import {
  DashboardSkeleton,
  BusinessSummaryCards,
  RevenueAndOperationsSection,
  PipelineAndHealthSection,
  MonthOverviewAndInsightsSection,
  DeadlinesAndContentSection,
} from "@/components/dashboard/dashboard-admin-sections";

import { getPostDateKey } from "@/components/content/content-constants";

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [chartRange, setChartRange] = useState<string>("6m");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats({
    query: {
      staleTime: 60_000,
      refetchInterval: 120_000,
      refetchOnWindowFocus: false,
    },
  });
  // Full admins (SUPER_ADMIN/ADMIN/MANAGER) see the BI console; everyone else sees the employee view
  const adminRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
  const isEmployee = !adminRoles.includes(user?.systemRole ?? "");

  const { data: revenueChart, isLoading: chartLoading } = useQuery<{ month: string; amount: number }[]>({
    queryKey: ["revenue-chart", chartRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/revenue-chart?range=${chartRange}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token && !isEmployee,
  });

  // Content posts for current week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const weekEndMonthStr = format(weekEnd, "yyyy-MM");
  const needsBothMonths = currentMonthStr !== weekEndMonthStr;

  const { data: weekPosts } = useListContentPosts({ month: currentMonthStr } as any);
  const { data: weekPostsNext } = useListContentPosts({ month: weekEndMonthStr } as any);
  const allWeekPosts = needsBothMonths ? [...(weekPosts ?? []), ...(weekPostsNext ?? [])] : (weekPosts ?? []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const todayStr = format(new Date(), "EEEE, dd MMM yyyy");

  // Content calendar week strip
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const postsByDay: Record<string, { platform: string }[]> = {};
  allWeekPosts.forEach((p: any) => {
    if (p.scheduledAt) {
      const dayKey = getPostDateKey(p.scheduledAt);
      if (dayKey) {
        if (!postsByDay[dayKey]) postsByDay[dayKey] = [];
        postsByDay[dayKey]!.push({ platform: p.platform ?? "INSTAGRAM" });
      }
    }
  });

  if (statsLoading || !stats) {
    return <DashboardSkeleton />;
  }

  if (isEmployee || stats.isEmployee) {
    return (
      <EmployeeDashboard
        stats={stats}
        refetchStats={refetchStats}
        greeting={greeting()}
        todayStr={todayStr}
        navigate={navigate}
        weekDays={weekDays}
        postsByDay={postsByDay}
        allWeekPosts={allWeekPosts}
        PLATFORM_DOT={PLATFORM_DOT}
      />
    );
  }

  return (
    <div className="p-6 space-y-6 animated-fade-in text-foreground">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {greeting()}, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchStats()} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Badge variant="outline" className="text-[11px] font-semibold py-1 px-2.5 gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live BI Console
          </Badge>
        </div>
      </div>

      {/* ── First Row: Redesigned Top KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue Collected"
          value={`₹${(stats.revenueCollected?.currentMonth ?? 0).toLocaleString("en-IN")}`}
          subtext={`₹${(stats.revenueCollected?.totalCollected ?? 0).toLocaleString("en-IN")} total all-time`}
          accentColor="border-l-emerald-500"
          icon={<IndianRupee className="h-5 w-5 text-emerald-500" />}
        />
        <StatCard
          label="Outstanding Revenue"
          value={`₹${(stats.outstandingRevenue ?? 0).toLocaleString("en-IN")}`}
          subtext="From Sent, Unpaid & Overdue Invoices"
          accentColor="border-l-amber-500"
          icon={<Landmark className="h-5 w-5 text-amber-500" />}
        />
        <StatCard
          label="Quotation Value"
          value={`₹${(stats.quotationValue ?? 0).toLocaleString("en-IN")}`}
          subtext="Total potential values waiting for client approval"
          accentColor="border-l-indigo-500"
          icon={<FileCheck className="h-5 w-5 text-indigo-500" />}
        />
        <StatCard
          label="Purchase Orders"
          value={stats.purchaseOrders?.total ?? 0}
          subtext={`${stats.purchaseOrders?.pending ?? 0} Pending • ${stats.purchaseOrders?.approved ?? 0} Approved • ${stats.purchaseOrders?.completed ?? 0} Completed`}
          accentColor="border-l-violet-500"
          icon={<ShoppingBag className="h-5 w-5 text-violet-500" />}
        />
      </div>

      {/* ── Second Row: Business Summary ── */}
      <BusinessSummaryCards stats={stats} />

      {/* ── Third Row: Revenue Trend & Segmented Operational Analytics ── */}
      <RevenueAndOperationsSection
        chartRange={chartRange}
        setChartRange={setChartRange}
        chartLoading={chartLoading}
        revenueChart={revenueChart}
        stats={stats}
      />

      {/* ── Fourth Row: Sales Pipeline & Project Health ── */}
      <PipelineAndHealthSection stats={stats} navigate={navigate} />

      {/* ── Fifth Row: This Month Overview & Quick Insights ── */}
      <MonthOverviewAndInsightsSection stats={stats} navigate={navigate} />

      {/* ── Sixth Row: Upcoming Deadlines & Content Calendar ── */}
      <DeadlinesAndContentSection
        stats={stats}
        navigate={navigate}
        allWeekPosts={allWeekPosts}
        weekDays={weekDays}
        postsByDay={postsByDay}
      />
    </div>
  );
}
