import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckSquare, Clock, FileText, Umbrella, ArrowRight, RefreshCw,
  AlertTriangle, CheckCircle2, Timer, CalendarClock, Activity,
  FolderOpen, TrendingUp,
} from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

export function EmployeeDashboard({
  stats,
  refetchStats,
  greeting,
  todayStr,
  navigate,
}: {
  stats: any;
  refetchStats: () => void;
  greeting: string;
  todayStr: string;
  navigate: (path: string) => void;
  // legacy props – kept so call-sites don't need updating
  weekDays?: Date[];
  postsByDay?: Record<string, { platform: string }[]>;
  allWeekPosts?: any[];
  PLATFORM_DOT?: Record<string, string>;
}) {
  const { token } = useAuth();

  const authHeader = () => {
    const t = token || localStorage.getItem("agency_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  /* ── Live queries ── */
  const { data: attendanceToday } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
    queryFn: async () => {
      const r = await fetch("/api/attendance/today", { headers: authHeader() });
      return r.ok ? r.json() : null;
    },
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: workReports = [] } = useQuery<any[]>({
    queryKey: ["/api/work-reports"],
    queryFn: async () => {
      const r = await fetch("/api/work-reports", { headers: authHeader() });
      return r.ok ? r.json() : [];
    },
    refetchInterval: 30_000,
  });

  const { data: leaveRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/leaves"],
    queryFn: async () => {
      const r = await fetch("/api/leaves", { headers: authHeader() });
      return r.ok ? r.json() : [];
    },
    refetchInterval: 30_000,
  });

  const { data: notifData } = useQuery<any>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications", { headers: authHeader() });
      return r.ok ? r.json() : { unreadCount: 0 };
    },
    refetchInterval: 15_000,
  });

  /* ── Derived values ── */
  const safeStats    = stats || {};
  const myTasks      = safeStats.myTasks || [];
  const myProjects   = safeStats.myProjects || safeStats.assignedProjects || [];
  const summary      = safeStats.myWorkSummary || safeStats.employeeSummary || {};
  const deadlines    = safeStats.upcomingDeadlines || [];
  const recentAct    = safeStats.recentActivity || [];

  const isCheckedIn      = Boolean(attendanceToday?.checkedIn);
  const checkInFmt       = attendanceToday?.checkInAt  ? format(new Date(attendanceToday.checkInAt),  "hh:mm a") : "—";
  const checkOutFmt      = attendanceToday?.checkOutAt ? format(new Date(attendanceToday.checkOutAt), "hh:mm a") : isCheckedIn ? "Active" : "—";
  const attendanceStatus = attendanceToday?.status ?? null;

  const pendingReports  = workReports.filter((r: any) => r.status === "SUBMITTED" || r.status === "NEEDS_CHANGES").length;
  const approvedReports = workReports.filter((r: any) => r.status === "APPROVED").length;
  const rejectedReports = workReports.filter((r: any) => r.status === "REJECTED").length;

  const pendingLeaves  = leaveRequests.filter((l: any) => l.status === "PENDING").length;
  const approvedLeaves = leaveRequests.filter((l: any) => l.status === "APPROVED").length;

  const unreadCount = notifData?.unreadCount ?? 0;

  // Task breakdown
  const totalTasks     = myTasks.length;
  const doneTasks      = summary.completedTasks ?? myTasks.filter((t: any) => t.status === "COMPLETED" || t.status === "DONE").length;
  const runningTasks   = summary.runningTasks ?? myTasks.filter((t: any) => t.status === "IN_PROGRESS").length;
  const approvedTasks  = summary.approvedTasks ?? totalTasks;
  const overdueTasks   = summary.overdueTasks ?? myTasks.filter((t: any) => t.dueDate && isPast(new Date(t.dueDate)) && t.status !== "COMPLETED" && t.status !== "DONE").length;
  const dueToday       = summary.tasksDueToday ?? myTasks.filter((t: any) => t.dueDate && isToday(new Date(t.dueDate))).length;
  const progressPct    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Upcoming tasks: non-completed, sorted by due date
  const upcomingTasks = [...myTasks]
    .filter((t: any) => t.status !== "COMPLETED" && t.status !== "DONE")
    .sort((a: any, b: any) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 8);

  const dueLabelClass = (dueDate: string | null) => {
    if (!dueDate) return "text-muted-foreground";
    const d = new Date(dueDate);
    if (isPast(d) && !isToday(d)) return "text-rose-500 font-bold";
    if (isToday(d)) return "text-amber-500 font-bold";
    if (isTomorrow(d)) return "text-amber-400";
    return "text-muted-foreground";
  };

  const dueLabelText = (dueDate: string | null) => {
    if (!dueDate) return "No due date";
    const d = new Date(dueDate);
    if (isToday(d)) return "Due Today";
    if (isTomorrow(d)) return "Due Tomorrow";
    if (isPast(d)) return `Overdue · ${format(d, "dd MMM")}`;
    return `Due ${format(d, "dd MMM yyyy")}`;
  };

  const PRIORITY_COLOR: Record<string, string> = {
    HIGH:   "bg-rose-500/10 text-rose-500 border-rose-500/20",
    URGENT: "bg-rose-600/10 text-rose-600 border-rose-600/20",
    MEDIUM: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    LOW:    "bg-slate-500/10 text-slate-500 border-slate-500/20",
    NORMAL: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  };

  const ATT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
    PRESENT:  { label: "Present",   cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    LATE:     { label: "Late",      cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    HALF_DAY: { label: "Half Day",  cls: "bg-amber-400/10 text-amber-500 border-amber-400/20" },
    ABSENT:   { label: "Absent",    cls: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
    ON_LEAVE: { label: "On Leave",  cls: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  };

  const attBadge = attendanceStatus ? ATT_STATUS_MAP[attendanceStatus] : null;

  return (
    <div className="p-6 space-y-6 animated-fade-in text-foreground max-w-screen-xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {greeting}, {safeStats.employeeName?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="outline" className="text-[11px] gap-1.5 px-2.5 py-1 bg-primary/5 text-primary">
              🔔 {unreadCount} new notification{unreadCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetchStats()} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Row 1: 4 Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Attendance */}
        <Card
          className="bg-card border border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate("/employee/attendance")}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Clock className="h-4 w-4 text-primary" /> Attendance
              </div>
              {attBadge ? (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 font-bold uppercase", attBadge.cls)}>
                  {attBadge.label}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                  {isCheckedIn ? "Active" : "Not In"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground">In</p>
                <p className="font-bold text-foreground mt-0.5">{checkInFmt}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground">Out</p>
                <p className="font-bold text-foreground mt-0.5">{checkOutFmt}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card
          className="bg-card border border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate("/employee/tasks")}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckSquare className="h-4 w-4 text-indigo-500" /> My Tasks
            </div>
            <div className="grid grid-cols-5 gap-1 text-center text-xs">
              <div>
                <p className="text-xl font-bold text-foreground font-heading">{approvedTasks}</p>
                <p className="text-[10px] text-muted-foreground">Approved</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-500 font-heading">{runningTasks}</p>
                <p className="text-[10px] text-muted-foreground">Running</p>
              </div>
              <div>
                <p className={cn("text-xl font-bold font-heading", dueToday > 0 ? "text-amber-500" : "text-foreground")}>{dueToday}</p>
                <p className="text-[10px] text-muted-foreground">Due Today</p>
              </div>
              <div>
                <p className={cn("text-xl font-bold font-heading", overdueTasks > 0 ? "text-rose-500" : "text-foreground")}>{overdueTasks}</p>
                <p className="text-[10px] text-muted-foreground">Overdue</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-500 font-heading">{doneTasks}</p>
                <p className="text-[10px] text-muted-foreground">Complete</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Reports */}
        <Card
          className="bg-card border border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate("/employee/work-reports")}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-emerald-500" /> Work Reports
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div>
                <p className="text-xl font-bold text-amber-500 font-heading">{pendingReports}</p>
                <p className="text-[10px] text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-500 font-heading">{approvedReports}</p>
                <p className="text-[10px] text-muted-foreground">Approved</p>
              </div>
              <div>
                <p className="text-xl font-bold text-rose-500 font-heading">{rejectedReports}</p>
                <p className="text-[10px] text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave */}
        <Card
          className="bg-card border border-border/60 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => navigate("/employee/leave")}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Umbrella className="h-4 w-4 text-violet-500" /> Leave Status
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-amber-500/10 p-2 text-center border border-amber-500/20">
                <p className="text-xl font-bold text-amber-500 font-heading">{pendingLeaves}</p>
                <p className="text-[10px] text-amber-600 font-semibold">Pending</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2 text-center border border-emerald-500/20">
                <p className="text-xl font-bold text-emerald-500 font-heading">{approvedLeaves}</p>
                <p className="text-[10px] text-emerald-600 font-semibold">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Upcoming Tasks + Task Progress ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Upcoming Tasks — main focus */}
        <Card className="xl:col-span-2 bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" /> Upcoming Tasks
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/employee/tasks")}>
              All Tasks <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-20 text-emerald-500" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs opacity-70 mt-0.5">No pending tasks assigned to you</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => navigate("/employee/tasks")}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/25 transition-all cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      {task.projectName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">📁 {task.projectName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.priority && task.priority !== "NORMAL" && (
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase font-bold", PRIORITY_COLOR[task.priority] ?? "")}>
                          {task.priority}
                        </Badge>
                      )}
                      <span className={cn("text-[10px] font-semibold whitespace-nowrap", dueLabelClass(task.dueDate))}>
                        {dueLabelText(task.dueDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Progress */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> My Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Completion ring */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative flex items-center justify-center h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="3"
                    strokeDasharray={`${progressPct} ${100 - progressPct}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="text-2xl font-bold font-heading leading-none">{progressPct}%</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">Done</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {doneTasks} of {totalTasks} tasks completed
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Completed
                </span>
                <span className="font-bold text-emerald-500">{doneTasks}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Timer className="h-3 w-3 text-indigo-400" /> In Progress
                </span>
                <span className="font-bold text-indigo-400">
                  {myTasks.filter((t: any) => t.status === "IN_PROGRESS").length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-rose-500" /> Overdue
                </span>
                <span className={cn("font-bold", overdueTasks > 0 ? "text-rose-500" : "text-muted-foreground")}>
                  {overdueTasks}
                </span>
              </div>
              {dueToday > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-xs font-bold text-amber-600">⚡ {dueToday} task{dueToday !== 1 ? "s" : ""} due today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Active Projects ── */}
      {myProjects.length > 0 && (
        <Card className="bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" /> My Active Projects
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/employee/projects")}>
              All Projects <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myProjects.slice(0, 6).map((project: any) => {
                const pct = project.completion ?? 0;
                return (
                  <div key={project.id} className="p-3.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-all space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{project.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {project.priority && (
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase", PRIORITY_COLOR[project.priority] ?? "")}>
                              {project.priority}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {project.dueDate ? `Due ${format(new Date(project.dueDate), "dd MMM yyyy")}` : "No due date"}
                          </span>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] uppercase shrink-0", project.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary")}>
                        {project.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-bold">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 4: Upcoming Deadlines + Recent Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Upcoming Deadlines */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                <Clock className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No upcoming deadlines</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {deadlines.map((item: any) => (
                  <div key={item.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    item.overdue
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border bg-muted/10 hover:bg-muted/20"
                  )}>
                    <span className="text-base shrink-0">
                      {item.type === "project" ? "💼" : item.type === "task" ? "📋" : "🌴"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">{item.type}</Badge>
                        {item.extraInfo && <span className="text-[10px] text-muted-foreground">{item.extraInfo}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("text-xs font-bold", item.overdue ? "text-rose-500 animate-pulse" : "text-foreground")}>
                        {item.date ? format(new Date(item.date), "dd MMM") : "—"}
                      </p>
                      {item.overdue && <p className="text-[9px] text-rose-400">Overdue</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentAct.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
                <Activity className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {recentAct.slice(0, 10).map((act: any) => (
                  <div key={act.id} className="flex gap-3 items-start text-xs border-b border-border/30 pb-3 last:border-0 last:pb-0">
                    <span className="text-base shrink-0">
                      {act.type === "project" ? "💼" : act.type === "leave" ? "🌴" : "📋"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/90 font-medium leading-snug">{act.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {act.createdAt ? format(new Date(act.createdAt), "dd MMM yyyy, hh:mm a") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
