import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Download, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle, User,
  ChevronDown, ChevronUp, BarChart3,
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
}

interface PerformanceData {
  month: string;
  generatedAt: string;
  employees: EmployeeReport[];
}

function performanceScore(emp: EmployeeReport): number {
  if (emp.totalAssigned === 0) return 100;
  const completionRate = emp.completed / emp.totalAssigned;
  const onTimeRate = emp.completed > 0 ? emp.completedOnTime / emp.completed : 1;
  const overduepenalty = emp.overdue / emp.totalAssigned;
  return Math.round((completionRate * 0.5 + onTimeRate * 0.35 - overduepenalty * 0.15) * 100);
}

function ScoreBadge({ score }: { score: number }) {
  const clr =
    score >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    score >= 50 ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-rose-100 text-rose-700 border-rose-200";
  return (
    <Badge variant="outline" className={cn("font-bold text-sm px-2.5 py-0.5 border", clr)}>
      {score}%
    </Badge>
  );
}

function downloadCSV(data: PerformanceData) {
  const rows = [
    ["Employee", "Total Assigned", "Completed", "On Time", "Delayed", "In Progress", "Overdue", "Score (%)"],
    ...data.employees.map(e => [
      e.employeeName, e.totalAssigned, e.completed, e.completedOnTime,
      e.delayed, e.inProgress, e.overdue, performanceScore(e),
    ]),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `performance-report-${data.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PerformanceReportPage() {
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError } = useQuery<PerformanceData>({
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

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Monthly Performance Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Employee task completion &amp; delay analysis for {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <Button variant="outline" className="gap-2" onClick={() => downloadCSV(data)}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      {data && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Employees Tracked", value: data.employees.length, accent: "border-l-primary", icon: <User className="h-4 w-4" /> },
            { label: "Total Tasks", value: data.employees.reduce((s, e) => s + e.totalAssigned, 0), accent: "border-l-blue-500", icon: <Clock className="h-4 w-4" /> },
            { label: "Completed", value: data.employees.reduce((s, e) => s + e.completed, 0), accent: "border-l-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
            { label: "Overdue", value: data.employees.reduce((s, e) => s + e.overdue, 0), accent: "border-l-rose-500", icon: <AlertCircle className="h-4 w-4" /> },
          ].map(({ label, value, accent, icon }) => (
            <div key={label} className={cn("bg-card border border-l-[3px] rounded-xl p-4 shadow-xs", accent)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold font-heading mt-1">{value}</p>
                </div>
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mx-auto mb-3 text-rose-400" />
          <p className="font-semibold">Failed to load report</p>
          <p className="text-sm mt-1">Make sure the database is connected and try again.</p>
        </div>
      )}

      {/* Empty */}
      {data && !isLoading && data.employees.length === 0 && (
        <div className="text-center py-20">
          <BarChart3 className="h-10 w-10 mx-auto mb-4 text-muted-foreground/40" />
          <p className="font-semibold">No task data for {monthLabel}</p>
          <p className="text-sm text-muted-foreground mt-1">
            No tasks were assigned or due during this month.
          </p>
        </div>
      )}

      {/* Employee cards */}
      {data && !isLoading && data.employees.map((emp) => {
        const score = performanceScore(emp);
        const isExpanded = !!expanded[emp.employeeId];
        const completion = emp.totalAssigned > 0
          ? Math.round((emp.completed / emp.totalAssigned) * 100)
          : 0;

        return (
          <Card key={emp.employeeId} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {emp.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{emp.employeeName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{emp.totalAssigned} tasks assigned in {monthLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    {score >= 80 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : score >= 50 ? (
                      <TrendingDown className="h-4 w-4 text-amber-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-rose-500" />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">Performance</span>
                  </div>
                  <ScoreBadge score={score} />
                  <Button
                    variant="ghost" size="sm"
                    className="text-xs gap-1 text-muted-foreground"
                    onClick={() => toggle(emp.employeeId)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? "Collapse" : "Details"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0 space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                {[
                  { label: "Completed", value: emp.completed, cls: "text-emerald-600" },
                  { label: "On Time", value: emp.completedOnTime, cls: "text-blue-600" },
                  { label: "Delayed", value: emp.delayed, cls: "text-amber-600" },
                  { label: "In Progress", value: emp.inProgress, cls: "text-purple-600" },
                  { label: "Overdue", value: emp.overdue, cls: "text-rose-600" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-muted/50 rounded-lg p-2">
                    <p className={cn("text-xl font-bold font-heading", cls)}>{value}</p>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {/* Completion bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Completion rate</span>
                  <span className="font-semibold">{completion}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      completion >= 80 ? "bg-emerald-500" :
                      completion >= 50 ? "bg-amber-500" :
                      "bg-rose-500"
                    )}
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>

              {/* Expanded task list */}
              {isExpanded && (
                <div className="border-t border-border/50 pt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Tasks this month</p>
                  {emp.tasks.map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-lg border",
                        task.isOverdue ? "border-rose-200 bg-rose-50/50 dark:bg-rose-950/10" :
                        task.isDelayed ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" :
                        task.status === "DONE" ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10" :
                        "border-border bg-muted/20"
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
                            {task.projectName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {task.isDelayed && <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-50 text-amber-700 border-amber-200">Late</Badge>}
                        {task.isOverdue && <Badge variant="outline" className="text-[10px] px-1.5 bg-rose-50 text-rose-700 border-rose-200">Overdue</Badge>}
                        {task.dueDate && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
