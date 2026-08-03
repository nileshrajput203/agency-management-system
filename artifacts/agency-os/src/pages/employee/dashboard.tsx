import { useGetDashboardStats, useListContentPosts } from "@workspace/api-client-react";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { startOfWeek, endOfWeek, addDays, format } from "date-fns";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-admin-sections";
import { PLATFORM_DOT } from "@/components/dashboard/dashboard-components";
import { getPostDateKey } from "@/components/content/content-constants";

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats({
    query: {
      refetchInterval: 3000,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
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
