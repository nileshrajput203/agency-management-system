import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Download, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle, User,
  ChevronDown, ChevronUp, BarChart3, Search, Sparkles, Check, AlertTriangle,
  Calendar, RefreshCw, Award
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

const getAuthToken = () =>
  localStorage.getItem("agency_token") ||
  localStorage.getItem("token") ||
  localStorage.getItem("auth_token") ||
  localStorage.getItem("agency_jwt_token") ||
  "";

function buildMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

const MONTH_OPTIONS = buildMonthOptions();

interface EmployeeReport {
  employeeId: string;
  employeeName: string;
  email?: string;
  role?: string;
  designation?: string;
  employeeCode?: string | null;
  overallScore?: number;
  grade?: string;
  gradeLabel?: string;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  metrics?: {
    workScore: number;
    attendanceScore: number;
    reportingScore: number;
    productivityScore: number;
  };
  totalAssigned: number;
  completed: number;
  completedOnTime: number;
  delayed: number;
  inProgress: number;
  overdue: number;
  todo: number;
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName: string | null;
    isOverdue: boolean;
    isDelayed: boolean;
  }[];
  attendance: {
    records: number;
    presentDays: number;
    halfDays: number;
    absentDays: number;
    leaveDays: number;
    lateDays: number;
    overtimeMinutes: number;
    attendanceRate: number | null;
  };
  workReports: {
    total: number;
    submitted: number;
    approved: number;
  };
  trackedMinutes: number;
}

interface PerformanceData {
  month: string;
  generatedAt: string;
  employees: EmployeeReport[];
}

function GradeBadge({ grade, label }: { grade?: string; label?: string }) {
  const g = grade || "B";
  const clr =
    g === "A+" ? "bg-emerald-500 text-white border-emerald-600" :
    g === "A"  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" :
    g === "B"  ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300" :
    g === "C"  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300" :
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300";

  return (
    <Badge className={cn("font-bold text-xs px-2.5 py-0.5 border shadow-2xs gap-1", clr)}>
      <Award className="h-3 w-3" />
      {g} {label ? `· ${label}` : ""}
    </Badge>
  );
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score === undefined || score === null) {
    return <Badge variant="outline" className="text-muted-foreground text-xs">Evaluating...</Badge>;
  }
  const clr =
    score >= 85 ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300" :
    score >= 70 ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300" :
    score >= 55 ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300" :
    "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300";

  return (
    <Badge variant="outline" className={cn("font-extrabold text-sm px-2.5 py-0.5 border", clr)}>
      {score}% Score
    </Badge>
  );
}

function downloadCSV(data: PerformanceData) {
  const rows = [
    [
      "Employee", "Designation", "Grade", "Overall Score (%)", "Summary",
      "Total Assigned Tasks", "Completed Tasks", "On Time Tasks", "Delayed Tasks", "Overdue Tasks",
      "Attendance Rate (%)", "Present Days", "Late Days", "Leave Days", "Absent Days", "Overtime (min)",
      "Tracked Hours", "Work Reports Submitted", "Work Reports Approved"
    ],
    ...data.employees.map(e => [
      e.employeeName,
      e.designation || e.role || "Team Member",
      e.grade || "B",
      e.overallScore ?? "",
      e.summary || "",
      e.totalAssigned,
      e.completed,
      e.completedOnTime,
      e.delayed,
      e.overdue,
      e.attendance.attendanceRate ?? "",
      e.attendance.presentDays,
      e.attendance.lateDays,
      e.attendance.leaveDays,
      e.attendance.absentDays,
      e.attendance.overtimeMinutes,
      (e.trackedMinutes / 60).toFixed(1),
      e.workReports.submitted,
      e.workReports.approved,
    ]),
  ];
  const csv = rows.map(r => r.map(value => {
    const rawCell = String(value ?? "");
    const cell = /^[=+\-@]/.test(rawCell) ? `'${rawCell}` : rawCell;
    return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  }).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `performance-report-${data.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PerformanceReportPage() {
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery<PerformanceData>({
    queryKey: ["performance-report", month],
    queryFn: async () => {
      const res = await fetch(`/api/performance/monthly?month=${month}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const toggle = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const monthLabel = MONTH_OPTIONS.find(o => o.value === month)?.label ?? month;

  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    return data.employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        emp.employeeName.toLowerCase().includes(q) ||
        (emp.designation && emp.designation.toLowerCase().includes(q)) ||
        (emp.role && emp.role.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (gradeFilter === "ALL") return true;
      if (gradeFilter === "A") return emp.grade === "A+" || emp.grade === "A";
      if (gradeFilter === "B") return emp.grade === "B";
      if (gradeFilter === "ATTENTION") return emp.grade === "C" || emp.grade === "Needs Attention";
      return true;
    });
  }, [data?.employees, searchQuery, gradeFilter]);

  const avgScore = useMemo(() => {
    if (!data?.employees?.length) return 0;
    const total = data.employees.reduce((acc, curr) => acc + (curr.overallScore ?? 80), 0);
    return Math.round(total / data.employees.length);
  }, [data?.employees]);

  return (
    <div className="p-4 sm:p-6 space-y-6 animated-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Employee Performance Reports
            </h1>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1 text-[11px] font-semibold">
              <Sparkles className="h-3 w-3" /> Auto-Generated
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Automated comprehensive evaluations synthesizing task execution, attendance punctuality, work reports, and logged hours for {monthLabel}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-xs gap-1.5"
            title="Refresh live metrics"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Sync
          </Button>

          {data && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => downloadCSV(data)}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Chips */}
      {data && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Employees Tracked",
              value: data.employees.length,
              accent: "border-l-primary",
              icon: <User className="h-4 w-4" />,
              sub: "Active team profiles"
            },
            {
              label: "Average Performance",
              value: `${avgScore}%`,
              accent: "border-l-blue-500",
              icon: <Award className="h-4 w-4" />,
              sub: `${data.employees.filter(e => (e.overallScore ?? 0) >= 82).length} top performers`
            },
            {
              label: "Task Deliveries",
              value: data.employees.reduce((s, e) => s + e.completed, 0),
              accent: "border-l-emerald-500",
              icon: <CheckCircle2 className="h-4 w-4" />,
              sub: `${data.employees.reduce((s, e) => s + e.totalAssigned, 0)} total assigned`
            },
            {
              label: "Overdue Backlog",
              value: data.employees.reduce((s, e) => s + e.overdue, 0),
              accent: "border-l-rose-500",
              icon: <AlertCircle className="h-4 w-4" />,
              sub: "Requires priority follow-up"
            },
          ].map(({ label, value, accent, icon, sub }) => (
            <div key={label} className={cn("bg-card border border-l-[3px] rounded-xl p-3.5 shadow-2xs", accent)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-xl font-bold font-heading mt-1">{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">{icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Grade Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee by name, designation, or role..."
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline">Grade:</span>
          {[
            { id: "ALL", label: "All Grades" },
            { id: "A", label: "Top (A/A+)" },
            { id: "B", label: "Solid (B)" },
            { id: "ATTENTION", label: "Needs Focus" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setGradeFilter(tab.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0",
                gradeFilter === tab.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full rounded-xl" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-rose-400" />
          <p className="font-semibold text-sm">Failed to generate performance report</p>
          <p className="text-xs mt-1">Make sure the database connection is active and try refreshing.</p>
        </div>
      )}

      {/* Empty State */}
      {data && !isLoading && filteredEmployees.length === 0 && (
        <div className="text-center py-16 border border-dashed rounded-xl p-8 bg-card">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-sm">No employee reports match your filters</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try adjusting your search term or grade filters for {monthLabel}.
          </p>
        </div>
      )}

      {/* Employee Performance Cards */}
      {data && !isLoading && filteredEmployees.map((emp) => {
        const isExpanded = !!expanded[emp.employeeId];
        const completionRate = emp.totalAssigned > 0
          ? Math.round((emp.completed / emp.totalAssigned) * 100)
          : 100;

        return (
          <Card key={emp.employeeId} className="overflow-hidden border border-border shadow-2xs transition-all hover:border-primary/30">
            <CardHeader className="pb-3 bg-muted/15 border-b border-border/50">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Employee Info */}
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {emp.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base font-bold">{emp.employeeName}</CardTitle>
                      <GradeBadge grade={emp.grade} label={emp.gradeLabel} />
                      <ScoreBadge score={emp.overallScore} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {emp.designation || emp.role || "Team Member"} {emp.employeeCode ? `· ${emp.employeeCode}` : ""} · {emp.totalAssigned} tasks · {emp.attendance.presentDays} days active in {monthLabel}
                    </p>
                  </div>
                </div>

                {/* Score & Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => toggle(emp.employeeId)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? "Hide Details" : "View Details & Tasks"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Automated Qualitative Summary */}
              {emp.summary && (
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-3.5 text-xs text-foreground/90 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-primary uppercase text-[10px] tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" /> Auto-Generated Performance Assessment
                  </div>
                  <p className="leading-relaxed">{emp.summary}</p>

                  {/* Strengths & Improvements tags */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-primary/10">
                    {emp.strengths && emp.strengths.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Key Strengths
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {emp.strengths.map((s, idx) => (
                            <span key={idx} className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-md font-medium border border-emerald-500/20">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {emp.improvements && emp.improvements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Recommendations
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {emp.improvements.map((imp, idx) => (
                            <span key={idx} className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-medium border border-amber-500/20">
                              {imp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4 Multi-Factor Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-center">
                {/* 1. Task Delivery */}
                <div className="bg-muted/30 border border-border/70 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Task Delivery</p>
                    <p className="text-lg font-bold font-heading mt-1 text-emerald-600 dark:text-emerald-400">
                      {emp.completed} / {emp.totalAssigned}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 space-y-0.5">
                    <p>{emp.completedOnTime} on-time · {emp.delayed} delayed</p>
                    <p className={emp.overdue > 0 ? "text-rose-600 font-semibold" : ""}>
                      {emp.overdue > 0 ? `⚠️ ${emp.overdue} overdue` : "Zero overdue backlog"}
                    </p>
                  </div>
                </div>

                {/* 2. Attendance & Punctuality */}
                <div className="bg-muted/30 border border-border/70 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Attendance Rate</p>
                    <p className="text-lg font-bold font-heading mt-1 text-blue-600 dark:text-blue-400">
                      {emp.attendance.attendanceRate === null ? "No records" : `${emp.attendance.attendanceRate}%`}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 space-y-0.5">
                    <p>{emp.attendance.presentDays} present · {emp.attendance.halfDays} half-day</p>
                    <p>{emp.attendance.lateDays} late · {emp.attendance.leaveDays} leave</p>
                  </div>
                </div>

                {/* 3. Logged Working Time */}
                <div className="bg-muted/30 border border-border/70 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Productivity Time</p>
                    <p className="text-lg font-bold font-heading mt-1 text-purple-600 dark:text-purple-400">
                      {(emp.trackedMinutes / 60).toFixed(1)} hrs
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 space-y-0.5">
                    <p>{emp.attendance.overtimeMinutes} mins overtime</p>
                    <p>Logged activity duration</p>
                  </div>
                </div>

                {/* 4. Operational Work Reports */}
                <div className="bg-muted/30 border border-border/70 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Work Reports</p>
                    <p className="text-lg font-bold font-heading mt-1 text-amber-600 dark:text-amber-400">
                      {emp.workReports.approved} / {emp.workReports.total}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 space-y-0.5">
                    <p>{emp.workReports.submitted} submitted</p>
                    <p>{emp.workReports.approved} manager-approved</p>
                  </div>
                </div>
              </div>

              {/* Delivery Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Deliverables Completion Progress</span>
                  <span className="font-semibold">{completionRate}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      completionRate >= 80 ? "bg-emerald-500" :
                      completionRate >= 50 ? "bg-amber-500" :
                      "bg-rose-500"
                    )}
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

              {/* Expanded Date-Wise Task Breakdown */}
              {isExpanded && (
                <div className="border-t border-border/60 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      Date-Wise Task Breakdown ({emp.tasks.length} items)
                    </p>
                    <span className="text-[10px] text-muted-foreground">Arranged chronologically by due date</span>
                  </div>

                  {emp.tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">No tasks assigned for this period.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {emp.tasks.map(task => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg border transition-colors",
                            task.isOverdue ? "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20" :
                            task.isDelayed ? "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20" :
                            task.status === "DONE" ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/15" :
                            "border-border bg-card"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              task.status === "DONE" ? "bg-emerald-500" :
                              task.status === "IN_PROGRESS" ? "bg-blue-500" :
                              "bg-slate-400"
                            )} />
                            <span className="truncate font-medium">{task.title}</span>
                            {task.projectName && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 hidden sm:block">
                                📁 {task.projectName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.isDelayed && (
                              <Badge variant="outline" className="text-[9px] px-1.5 bg-amber-50 text-amber-700 border-amber-300">
                                Delayed
                              </Badge>
                            )}
                            {task.isOverdue && (
                              <Badge variant="outline" className="text-[9px] px-1.5 bg-rose-50 text-rose-700 border-rose-300">
                                Overdue
                              </Badge>
                            )}
                            {task.dueDate ? (
                              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">No deadline</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
