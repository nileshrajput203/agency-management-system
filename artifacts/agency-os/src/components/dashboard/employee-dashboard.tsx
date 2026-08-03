import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, ArrowRight, Users, CheckSquare, Clock, FileCheck, Plus, Sparkles, Flame, RefreshCw,
  FileText, Bell, Calendar, UserCheck, CheckCircle2, AlertCircle, XCircle
} from "lucide-react";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";

export function EmployeeDashboard({
  stats,
  refetchStats,
  greeting,
  todayStr,
  navigate,
  weekDays,
  postsByDay,
  PLATFORM_DOT,
}: {
  stats: any;
  refetchStats: () => void;
  greeting: string;
  todayStr: string;
  navigate: (path: string) => void;
  weekDays: Date[];
  postsByDay: Record<string, { platform: string }[]>;
  allWeekPosts: any[];
  PLATFORM_DOT: Record<string, string>;
}) {
  const { token } = useAuth();

  const getAuthHeaders = () => {
    const t = token || localStorage.getItem("agency_token") || localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // Live Work Reports query
  const { data: workReports = [] } = useQuery<any[]>({
    queryKey: ["/api/work-reports"],
    queryFn: async () => {
      const res = await fetch("/api/work-reports", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Live Attendance query
  const { data: attendanceToday } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/today", { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Live Notifications query
  const { data: notificationsData } = useQuery<any>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { headers: getAuthHeaders() });
      if (!res.ok) return { notifications: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Live Leaves query
  const { data: leaveRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/leaves"],
    queryFn: async () => {
      const res = await fetch("/api/leaves", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  // Live Clients query
  const { data: liveClients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const safeStats = stats || {};
  const summary = safeStats.myWorkSummary || safeStats.employeeSummary || {};
  const myProjects = safeStats.myProjects || safeStats.assignedProjects || [];
  const myTasks = safeStats.myTasks || [];
  const myTaskRequests = safeStats.myTaskRequests || [];

  // Derived Work Report stats
  const pendingReportsCount = workReports.filter((r: any) => r.status === "SUBMITTED" || r.status === "NEEDS_CHANGES").length;
  const approvedReportsCount = workReports.filter((r: any) => r.status === "APPROVED").length;
  const rejectedReportsCount = workReports.filter((r: any) => r.status === "REJECTED").length;

  // Derived Leaves stats
  const pendingLeavesCount = leaveRequests.filter((l: any) => l.status === "PENDING").length;
  const approvedLeavesCount = leaveRequests.filter((l: any) => l.status === "APPROVED").length;
  const rejectedLeavesCount = leaveRequests.filter((l: any) => l.status === "REJECTED").length;

  // Derived Client info
  const clientNames = liveClients.length > 0 
    ? liveClients.map((c: any) => c.companyName || c.contactPerson || "Client") 
    : (safeStats.clientInfo?.names || []);
  const clientCount = liveClients.length > 0 ? liveClients.length : (safeStats.clientInfo?.count ?? 0);

  // Derived Attendance info
  const isCheckedIn = Boolean(attendanceToday?.checkedIn);
  const checkInFormatted = attendanceToday?.checkInAt ? format(new Date(attendanceToday.checkInAt), "hh:mm a") : "Not Checked In";
  const checkOutFormatted = attendanceToday?.checkOutAt ? format(new Date(attendanceToday.checkOutAt), "hh:mm a") : (isCheckedIn ? "Active Shift" : "N/A");

  // Notifications
  const unreadCount = notificationsData?.unreadCount ?? 0;

  return (
    <div className="p-6 space-y-6 animated-fade-in text-foreground">
      {/* ── Section 1: Welcome Banner ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {greeting}, {safeStats.employeeName?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchStats()} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Badge variant="outline" className="text-[11px] font-semibold py-1 px-2.5 gap-1.5 bg-primary/5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Dashboard
          </Badge>
        </div>
      </div>

      {/* ── Section 2: My Work Summary Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assigned Tasks</span>
          <div>
            <span className="text-2xl font-bold text-primary font-heading">{summary.assignedTasks ?? summary.totalAssignedTasks ?? myTasks.length}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Active scope</p>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-amber-500">Due Today</span>
          <div>
            <span className="text-2xl font-bold text-amber-500 font-heading">{summary.tasksDueToday ?? 0}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Priorities today</p>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-rose-500">Overdue</span>
          <div>
            <span className="text-2xl font-bold text-rose-500 font-heading">{summary.overdueTasks ?? 0}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Needs action</p>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Projects</span>
          <div>
            <span className="text-2xl font-bold text-indigo-400 font-heading">{summary.projectsAssignedToMe ?? myProjects.length}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">My workspace</p>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-violet-400">Clients</span>
          <div>
            <span className="text-2xl font-bold text-violet-400 font-heading">{clientCount}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Assigned clients</p>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-amber-400">Pending Reports</span>
          <div>
            <span className="text-2xl font-bold text-amber-400 font-heading">{pendingReportsCount}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Work reports</p>
          </div>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border/50 flex flex-col justify-between h-[100px] scale-hover transition-all duration-200">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-emerald-400">Notifications</span>
          <div>
            <span className="text-2xl font-bold text-emerald-400 font-heading">{unreadCount}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">Unread alerts</p>
          </div>
        </div>
      </div>

      {/* ── Section 3: Live Status Highlights (Attendance, Work Reports, Leave Requests) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Widget */}
        <Card className="bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Attendance Today
            </CardTitle>

            <Badge variant="outline" className={cn("text-[10px] uppercase font-bold px-2 py-0.5", isCheckedIn ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-muted text-muted-foreground")}>
              {isCheckedIn ? "Checked In" : "Not Checked In"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-border bg-muted/10">
                <span className="text-[10px] text-muted-foreground block font-medium">Check In</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">{checkInFormatted}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-muted/10">
                <span className="text-[10px] text-muted-foreground block font-medium">Check Out</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">{checkOutFormatted}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full text-xs h-8 gap-1.5 border border-border/50" onClick={() => navigate("/employee/attendance")}>
              Go to Attendance <ArrowRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Work Reports Status */}
        <Card className="bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Work Reports Overview
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => navigate("/employee/reports")}>
              View <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-lg font-bold text-amber-500 block">{pendingReportsCount}</span>
                <span className="text-[10px] text-amber-500 font-semibold uppercase">Pending</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-lg font-bold text-emerald-500 block">{approvedReportsCount}</span>
                <span className="text-[10px] text-emerald-500 font-semibold uppercase">Approved</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <span className="text-lg font-bold text-rose-500 block">{rejectedReportsCount}</span>
                <span className="text-[10px] text-rose-500 font-semibold uppercase">Rejected</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leave Requests Overview */}
        <Card className="bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Leave Requests
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => navigate("/employee/leaves")}>
              View <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-lg font-bold text-amber-500 block">{pendingLeavesCount}</span>
                <span className="text-[10px] text-amber-500 font-semibold uppercase">Pending</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-lg font-bold text-emerald-500 block">{approvedLeavesCount}</span>
                <span className="text-[10px] text-emerald-500 font-semibold uppercase">Approved</span>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <span className="text-lg font-bold text-rose-500 block">{rejectedLeavesCount}</span>
                <span className="text-[10px] text-rose-500 font-semibold uppercase">Rejected</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 4: My Projects & Assigned Clients ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* My Projects */}
        <Card className="xl:col-span-2 bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" /> My Active Projects
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/employee/projects")}>
              Go to Projects <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {myProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No projects currently assigned to you</p>
            ) : (
              <div className="space-y-4">
                {myProjects.map((project: any) => (
                  <div key={project.id} className="p-3.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate block">{project.name}</span>
                        <div className="flex gap-2 items-center mt-1">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase">{project.priority || "NORMAL"} Priority</Badge>
                          <span className="text-[10px] text-muted-foreground">Due: {project.dueDate ? format(new Date(project.dueDate), "dd MMM yyyy") : "N/A"}</span>
                        </div>
                      </div>
                      <Badge className={cn("text-[10px] uppercase", project.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary")}>
                        {project.status?.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted h-1.5 rounded-full overflow-hidden">
                        <div style={{ width: `${project.completion ?? 0}%` }} className="bg-indigo-500 h-full rounded-full transition-all duration-300" />
                      </div>
                      <span className="text-[10px] font-bold shrink-0">{project.completion ?? 0}% Done</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Clients */}
        <Card className="bg-card flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> My Assigned Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between gap-4">
            {clientCount === 0 ? (
              <div className="text-center py-8 text-muted-foreground my-auto">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-20 text-primary" />
                <p className="text-xs font-semibold">No assigned clients</p>
                <p className="text-[10px] opacity-75 mt-0.5">Assigned via project memberships</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {clientNames.map((name: string, index: number) => (
                  <div key={index} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-foreground/90">{name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-3 border-t border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground">
                Currently managing <span className="text-foreground font-bold">{clientCount}</span> active client{clientCount !== 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 5: My Active Tasks ── */}
      <Card className="bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" /> My Tasks
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/employee/tasks")}>
            Manage Tasks <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active tasks assigned to you</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myTasks.map((task: any) => (
                <div key={task.id} className="p-3.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/20 transition-all flex flex-col justify-between gap-3 cursor-pointer" onClick={() => navigate("/employee/tasks")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-foreground truncate block">{task.title}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Project: {task.projectName || "None"}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase shrink-0">
                      {task.priority || "NORMAL"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-muted-foreground font-semibold">Due: {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "N/A"}</span>
                    <Badge className={cn("text-[9px] capitalize px-1.5 py-0.5", task.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary")}>
                      {task.status?.replace("_", " ").toLowerCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 6: Upcoming Deadlines & My Task Requests ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card className="bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Upcoming Deadlines
            </CardTitle>
            <span className="text-xs text-muted-foreground">Chronological priorities</span>
          </CardHeader>
          <CardContent>
            {safeStats.upcomingDeadlines?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border rounded-xl bg-card/10">
                <Clock className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">All quiet this month</p>
                <p className="text-xs opacity-75 mt-0.5">No upcoming deadlines or schedules</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {safeStats.upcomingDeadlines?.map((item: any) => {
                  const dateLabel = format(new Date(item.date), "dd MMM yyyy");
                  return (
                    <div key={item.id} className="flex items-center gap-3.5 p-3 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-all justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base">
                          {item.type === "project" ? "💼" : item.type === "task" ? "📋" : "🌴"}
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

        {/* My Task Requests */}
        <Card className="bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" /> My Task Requests
            </CardTitle>
            <Button onClick={() => navigate("/employee/tasks")} variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Request Task
            </Button>
          </CardHeader>
          <CardContent>
            {myTaskRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed border-border rounded-xl bg-card/10">
                <FileCheck className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm font-medium">No task requests</p>
                <p className="text-xs opacity-75 mt-0.5">You can submit custom task requests to admins</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {myTaskRequests.map((item: any) => {
                  const statusColors: Record<string, string> = {
                    PENDING: "bg-amber-500/10 text-amber-500",
                    APPROVED: "bg-emerald-500/10 text-emerald-500",
                    REJECTED: "bg-rose-500/10 text-rose-500",
                  };
                  return (
                    <div key={item.id} className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-foreground truncate block">{item.title}</span>
                        <Badge className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5", statusColors[item.approvalStatus] ?? "bg-slate-500/10 text-slate-500")}>
                          {item.approvalStatus}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span>Project: {item.projectName || "None"}</span>
                        <span>{item.createdAt ? format(new Date(item.createdAt), "dd MMM yyyy") : ""}</span>
                      </div>
                      {item.rejectionReason && item.approvalStatus === "REJECTED" && (
                        <div className="p-2.5 rounded bg-rose-950/20 border border-rose-500/20 text-[10px] text-rose-400 font-medium">
                          <span className="font-bold">Rejection reason:</span> {item.rejectionReason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 7: Recent Activity & Content Calendar ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> My Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {safeStats.recentActivity?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activities found</p>
            ) : (
              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                {safeStats.recentActivity?.map((activity: any) => (
                  <div key={activity.id} className="flex gap-3 items-start text-xs border-b border-border/30 pb-3 last:border-0 last:pb-0">
                    <span className="text-base shrink-0">
                      {activity.type === "project" ? "💼" : activity.type === "leave" ? "🌴" : "📋"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/90 font-medium leading-relaxed">{activity.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(activity.createdAt), "dd MMM yyyy, hh:mm a")}</p>
                    </div>
                  </div>
                ))}
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
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/employee/content-calendar")}>
                Calendar <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {myProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border">
                <Flame className="h-8 w-8 mb-2 opacity-30 text-orange-500" />
                <p className="text-sm font-medium">No projects found.</p>
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
                      onClick={() => navigate("/employee/content-calendar")}
                      className={cn(
                        "flex flex-col items-center gap-1 p-1.5 rounded-lg border cursor-pointer transition-colors hover:border-primary/40",
                        isCurrentDay ? "bg-primary/5 border-primary/30" : "border-border bg-card/50"
                      )}
                    >
                      <p className={cn("text-[9px] font-semibold uppercase", isCurrentDay ? "text-primary font-black" : "text-muted-foreground")}>
                        {format(day, "EEE")}
                      </p>
                      <p className="text-sm font-bold font-heading leading-none text-foreground">
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
    </div>
  );
}
