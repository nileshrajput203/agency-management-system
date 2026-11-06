import { useState } from "react";
import { useAuth } from "@/App";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  useListProjects, useListUsers, getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { TaskInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { canManageModule } from "@/lib/permissions";
import { useForm, Controller } from "react-hook-form";
import {
  Plus, Trash2, Calendar, CheckSquare, Clock, AlertCircle, ListTodo, CheckCircle2, Edit3, EyeOff, Eye,
  Users, ChevronDown, ChevronUp, Bell, User, Filter, AlertTriangle, ArrowRight, Check
} from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { cn, formatDateOnly } from "@/lib/utils";
import { SearchBar } from "@/components/common/SearchBar";
import {
  Tooltip, TooltipTrigger, TooltipContent
} from "@/components/ui/tooltip";
import { COLUMNS, PRIORITY_CONFIG, COL_STYLE, isCompletedTask, sortTasksByDueDate } from "./task-constants";
import { TaskActionDialogs } from "./task-action-dialogs";

export function AdminTasksView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState("TODO");
  const [dragging, setDragging] = useState<string | null>(null);

  // View tabs: "board" (All Tasks), "pending" (Approval Queue), "team-workload" (Daily Tasks & Team Workload), "requests" (My Requests Tracker)
  const [viewTab, setViewTab] = useState<"board" | "pending" | "team-workload" | "requests">("board");
  const [teamTaskFilter, setTeamTaskFilter] = useState<"TODAY" | "PENDING" | "OVERDUE" | "MEMBERS">("TODAY");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isNotifyingManagers, setIsNotifyingManagers] = useState(false);

  const handleNotifyManagersOfToday = async () => {
    setIsNotifyingManagers(true);
    try {
      const res = await fetch("/api/tasks/notify-daily-summary", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error("Failed to send notification");
      toast.success(`📢 Managers notified of all today's tasks (${data.totalToday} due today, ${data.totalOverdue} overdue)!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to notify managers");
    } finally {
      setIsNotifyingManagers(false);
    }
  };

  const [hideCompleted, setHideCompleted] = useState(true);

  // Dialog/modal states for administrative actions
  const [selectedTaskForActionState, setSelectedTaskForAction] = useState<any | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState("");
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [adminEditDialogOpen, setAdminEditDialogOpen] = useState(false);

  const handleOpenAdminEditDialog = (task: any) => {
    setSelectedTaskForAction(task);
    setAdminEditDialogOpen(true);
  };

  const handleConfirmAdminEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTaskForAction) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const objective = formData.get("objective") as string;
    const requirements = formData.get("requirements") as string;
    const deliverables = formData.get("deliverables") as string;
    const notes = formData.get("notes") as string;
    const startDate = formData.get("startDate") as string || null;
    const priority = formData.get("priority") as string;
    const status = formData.get("status") as string;
    const rawProjectId = formData.get("projectId") as string;
    const projectId = (!rawProjectId || rawProjectId === "none") ? null : rawProjectId;
    const rawSubprojectId = formData.get("subprojectId") as string;
    const subprojectId = (!rawSubprojectId || rawSubprojectId === "none") ? null : rawSubprojectId;
    const rawAssigneeId = formData.get("assigneeId") as string;
    const assigneeId = (!rawAssigneeId || rawAssigneeId === "unassigned") ? null : rawAssigneeId;
    const dueDate = formData.get("dueDate") as string || null;
    const assignmentNote = (formData.get("assignmentNote") as string) || null;
    const rawCoAssignees = formData.get("coAssignees") as string;
    const coAssignees = rawCoAssignees ? JSON.parse(rawCoAssignees) : [];

    updateMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        title,
        description,
        objective,
        requirements,
        deliverables,
        notes,
        assignmentNote,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        priority,
        status,
        projectId,
        subprojectId,
        assigneeId,
        coAssignees,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      } as any,
    }, {
      onSuccess: () => {
        toast.success("Task updated successfully!");
        setAdminEditDialogOpen(false);
      }
    });
  };

  const { data: tasks, isLoading } = useListTasks();
  const selectedTaskForAction = selectedTaskForActionState ? (tasks ?? []).find((t: any) => t.id === selectedTaskForActionState.id) || selectedTaskForActionState : null;
  const { data: projects } = useListProjects();
  const { data: users } = useListUsers({
    query: { enabled: canManageModule(user, "team") } as any,
  });

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        toast.success("Task created successfully");
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create task"),
    },
  });

  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
      onError: () => toast.error("Failed to update task"),
    },
  });

  const deleteMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        toast.success("Task deleted successfully");
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
      onError: () => toast.error("Failed to delete task"),
    },
  });

  const { register, handleSubmit, control, reset, setValue } = useForm<TaskInput>({
    defaultValues: { title: "", status: "TODO", priority: "MEDIUM" },
  });

  const openAdd = (status: string) => {
    setDefaultStatus(status);
    reset({ title: "", status, priority: "MEDIUM" });
    setDialogOpen(true);
  };

  const onSubmit = (data: TaskInput) => {
    createMutation.mutate({ data });
  };

  const handleDrop = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ id: taskId, data: { status: newStatus } as any });
  };

  const handleApproveTask = (taskId: string, requesterId?: string | null) => {
    updateMutation.mutate({
      id: taskId,
      data: {
        approvalStatus: "APPROVED",
        assigneeId: requesterId || user?.id,
      } as any,
    }, {
      onSuccess: () => {
        toast.success("Task request approved!");
      }
    });
  };

  const handleOpenRejectDialog = (task: any) => {
    setSelectedTaskForAction(task);
    setRejectionReasonText("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedTaskForAction) return;
    updateMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        approvalStatus: "REJECTED",
        rejectionReason: rejectionReasonText || null,
      } as any,
    }, {
      onSuccess: () => {
        toast.success("Task request rejected");
        setRejectDialogOpen(false);
      }
    });
  };

  const handleOpenModifyDialog = (task: any) => {
    setSelectedTaskForAction(task);
    setModifyDialogOpen(true);
  };

  const handleConfirmModify = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTaskForAction) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const objective = formData.get("objective") as string;
    const requirements = formData.get("requirements") as string;
    const deliverables = formData.get("deliverables") as string;
    const notes = formData.get("notes") as string;
    const startDate = formData.get("startDate") as string || null;
    const priority = formData.get("priority") as string;
    const status = formData.get("status") as string;
    const rawProjectId = formData.get("projectId") as string;
    const projectId = (!rawProjectId || rawProjectId === "none") ? null : rawProjectId;
    const rawSubprojectId = formData.get("subprojectId") as string;
    const subprojectId = (!rawSubprojectId || rawSubprojectId === "none") ? null : rawSubprojectId;
    const rawAssigneeId = formData.get("assigneeId") as string;
    const assigneeId = (!rawAssigneeId || rawAssigneeId === "unassigned") ? null : rawAssigneeId;
    const dueDate = formData.get("dueDate") as string || null;
    const assignmentNote = (formData.get("assignmentNote") as string) || null;
    const rawCoAssignees = formData.get("coAssignees") as string;
    const coAssignees = rawCoAssignees ? JSON.parse(rawCoAssignees) : [];

    updateMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        title,
        description,
        objective,
        requirements,
        deliverables,
        notes,
        assignmentNote,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        priority,
        status,
        projectId,
        subprojectId,
        assigneeId,
        coAssignees,
        dueDate: dueDate || null,
        approvalStatus: "MODIFIED",
      } as any,
    }, {
      onSuccess: () => {
        toast.success("Task modified and approved!");
        setModifyDialogOpen(false);
      }
    });
  };

  const activeTasks = (tasks ?? []).filter(
    (t) => t.approvalStatus === "APPROVED" || t.approvalStatus === "MODIFIED" || !t.approvalStatus
  );

  const filteredActive = activeTasks.filter((t) => {
    if (hideCompleted && isCompletedTask(t.status)) return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).assigneeName?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q) ||
        (t as any).subprojectName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const byStatus = (status: string) => sortTasksByDueDate(filteredActive.filter((t) => t.status === status));

  const pendingTasks = (tasks ?? []).filter((t) => t.approvalStatus === "PENDING" || t.approvalStatus === "MANAGER_APPROVED");
  const filteredPending = sortTasksByDueDate(pendingTasks.filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).assigneeName?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q) ||
        (t as any).subprojectName?.toLowerCase().includes(q)
      );
    }
    return true;
  }));

  const myRequests = (tasks ?? []).filter((t) => t.requestedBy === user?.id || (t as any).createdBy === user?.id);
  const filteredRequests = myRequests.filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).assigneeName?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q) ||
        (t as any).subprojectName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalDone = activeTasks.filter((t) => isCompletedTask(t.status)).length;
  const totalInProg = activeTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const totalDueToday = activeTasks.filter((t) => {
    if (isCompletedTask(t.status) || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate();
  }).length;
  const totalOverdue = activeTasks.filter((t) =>
    !isCompletedTask(t.status) && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))
  ).length;

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // All tasks due today across all employees
  const todaysTasksList = (tasks ?? []).filter((t: any) => {
    if (isCompletedTask(t.status)) return false;
    if (!t.dueDate) return false;
    return t.dueDate.startsWith(todayStr);
  });

  // All uncompleted/pending tasks across the agency
  const allPendingTasksList = (tasks ?? []).filter((t: any) => !isCompletedTask(t.status));

  // Overdue tasks across the agency
  const overdueTasksList = (tasks ?? []).filter((t: any) =>
    !isCompletedTask(t.status) && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))
  );

  // Group tasks by team member / employee ("where admin can see how is everyone working")
  const teamWorkloadList = (users ?? []).map((member: any) => {
    const memberId = String(member?.id || member?.user?.id || "");
    const memberTasks = (tasks ?? []).filter((t: any) =>
      String(t.assigneeId || "") === memberId || (Array.isArray(t.coAssignees) && t.coAssignees.map(String).includes(memberId))
    );
    const memberToday = memberTasks.filter((t: any) => !isCompletedTask(t.status) && t.dueDate && String(t.dueDate).startsWith(todayStr));
    const memberPending = memberTasks.filter((t: any) => !isCompletedTask(t.status));
    const memberCompleted = memberTasks.filter((t: any) => isCompletedTask(t.status));
    const memberOverdue = memberTasks.filter((t: any) => !isCompletedTask(t.status) && t.dueDate && isBefore(parseISO(String(t.dueDate).split("T")[0]), startOfDay(new Date())));

    return {
      user: member,
      tasks: memberTasks,
      todayTasks: memberToday,
      pendingTasks: memberPending,
      completedTasks: memberCompleted,
      overdueTasks: memberOverdue,
      totalCount: memberTasks.length,
      completionRate: memberTasks.length > 0 ? Math.round((memberCompleted.length / memberTasks.length) * 100) : 0,
    };
  }).sort((a, b) => b.todayTasks.length - a.todayTasks.length || b.pendingTasks.length - a.pendingTasks.length);

  const taskStatChips = [
    { label: "Approved", value: activeTasks.length, accent: "border-l-primary", icon: <ListTodo className="h-4 w-4" /> },
    { label: "Due Today", value: totalDueToday, accent: "border-l-amber-500", icon: <Calendar className="h-4 w-4" /> },
    { label: "In Progress", value: totalInProg, accent: "border-l-blue-500", icon: <Clock className="h-4 w-4" /> },
    { label: "Completed", value: totalDone, accent: "border-l-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Overdue", value: totalOverdue, accent: totalOverdue > 0 ? "border-l-rose-500" : "border-l-slate-300", icon: <AlertCircle className="h-4 w-4" /> },
  ];

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending</Badge>;
      case "APPROVED":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200">Rejected</Badge>;
      case "MODIFIED":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Modified</Badge>;
      case "MANAGER_APPROVED":
        return <Badge className="bg-violet-100 text-violet-800 border-violet-200">Manager Approved</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200">Approved</Badge>;
    }
  };

  return (
    <div className="p-6 animated-fade-in space-y-6" id="admin-tasks-container">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading">Task Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {viewTab === "board" && `${filteredActive.length} of ${activeTasks.length} active company tasks shown`}
            {viewTab === "pending" && `${filteredPending.length} of ${pendingTasks.length} pending requests shown`}
            {viewTab === "team-workload" && `Tracking ${todaysTasksList.length} tasks due today and ${allPendingTasksList.length} pending tasks across ${teamWorkloadList.length} team members`}
            {viewTab === "requests" && `${filteredRequests.length} of ${myRequests.length} your requests shown`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
            <Button
              variant={viewTab === "board" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewTab("board")}
              className="text-xs font-semibold px-3 py-1.5 h-auto rounded-md"
              id="admin-tab-board"
            >
              All Tasks
            </Button>
            <Button
              variant={viewTab === "pending" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewTab("pending")}
              className="text-xs font-semibold px-3 py-1.5 h-auto rounded-md relative"
              id="admin-tab-pending"
            >
              Approval Queue
              {pendingTasks.length > 0 && (
                <span className="ml-1.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingTasks.length}
                </span>
              )}
            </Button>
            <Button
              variant={viewTab === "team-workload" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewTab("team-workload")}
              className="text-xs font-semibold px-3 py-1.5 h-auto rounded-md relative flex items-center gap-1.5"
              id="admin-tab-team-workload"
            >
              <Users className="h-3.5 w-3.5 text-primary" />
              Team Workload & Daily Tasks
              {totalDueToday > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {totalDueToday} today
                </span>
              )}
            </Button>
            <Button
              variant={viewTab === "requests" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewTab("requests")}
              className="text-xs font-semibold px-3 py-1.5 h-auto rounded-md"
              id="admin-tab-requests"
            >
              My Requests Tracker
            </Button>
          </div>

          <SearchBar placeholder="Search tasks…" value={searchQuery} onChange={setSearchQuery} className="max-w-xs" />
          <Select value={priorityFilter} onValueChange={(val: string) => setPriorityFilter(val ?? "ALL")}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priority</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideCompleted(!hideCompleted)}
            className="gap-2 text-xs"
            title={hideCompleted ? "Show completed tasks" : "Hide completed tasks"}
          >
            {hideCompleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideCompleted ? "Show Done" : "Hide Done"}
          </Button>
          <Button onClick={() => openAdd("TODO")} className="gap-2 btn-micro-anim" id="admin-create-task-btn">
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {taskStatChips.map(({ label, value, accent, icon }) => (
          <div key={label} className={cn("bg-card border border-l-[3px] rounded-xl p-4 scale-hover shadow-xs", accent)}>
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

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <Card key={col.key}><CardContent className="p-4"><Skeleton className="h-48" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <>
          {/* 1. KANBAN BOARD VIEW */}
          {viewTab === "board" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {COLUMNS.map((col) => {
                const colTasks = byStatus(col.key);
                return (
                  <div
                    key={col.key}
                    className={cn("rounded-xl border border-border bg-muted/30 border-t-2 overflow-hidden", COL_STYLE[col.key])}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragging) {
                        handleDrop(dragging, col.key);
                        setDragging(null);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 bg-card/60 border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{col.label}</p>
                        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                          {colTasks.length}
                        </span>
                      </div>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => openAdd(col.key)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="p-2 space-y-2 min-h-16">
                      {colTasks.map((task) => {
                        const pc = PRIORITY_CONFIG[task.priority ?? "MEDIUM"] ?? PRIORITY_CONFIG.MEDIUM;
                        const isOverdue = task.dueDate && task.status !== "DONE" && isBefore(parseISO(task.dueDate), startOfDay(new Date()));
                        const cardEl = (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => setDragging(task.id)}
                            onDragEnd={() => setDragging(null)}
                            className={cn(
                              "bg-card rounded-lg border p-3 shadow-xs cursor-grab active:cursor-grabbing group space-y-2 transition-shadow hover:shadow-sm relative",
                              isOverdue ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/10 border-l-[3px] border-l-rose-400" : "border-border"
                            )}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</p>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleOpenAdminEditDialog(task)}
                                  data-testid={`edit-task-btn-${task.id}`}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteMutation.mutate({ id: task.id })}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {task.projectName && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded inline-block">{task.projectName}</p>
                                {(task as any).subprojectName && (
                                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5">
                                    ↳ {(task as any).subprojectName}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-border/40">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={cn("text-[10px] border px-1.5 py-0", pc.className)}>
                                  {pc.label}
                                </Badge>
                                {task.approvalStatus === "MODIFIED" && (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300">
                                    Modified
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                {task.dueDate && (
                                  <div className={cn(
                                    "flex items-center gap-1 text-[10px]",
                                    isOverdue ? "text-rose-500 font-semibold" : "text-muted-foreground"
                                  )}>
                                    <Calendar className="h-2.5 w-2.5" />
                                    {formatDateOnly(task.dueDate, "dd MMM")}
                                  </div>
                                )}
                                {task.assigneeName && (
                                  <p className="text-[10px] text-muted-foreground truncate max-w-20">{task.assigneeName}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );

                        return task.description?.trim() ? (
                          <Tooltip key={task.id}>
                            <TooltipTrigger asChild>
                              {cardEl}
                            </TooltipTrigger>
                            <TooltipContent className="z-50 bg-slate-900 border border-slate-800 text-slate-100 dark:bg-slate-950 dark:border-slate-850 p-3 max-w-sm whitespace-pre-wrap rounded-lg shadow-xl leading-relaxed text-xs font-normal">
                              <div className="font-semibold text-slate-400 mb-1 border-b border-slate-800 pb-1">Description</div>
                              {task.description}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          cardEl
                        );
                      })}

                      {colTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                          <CheckSquare className="h-6 w-6 mb-1.5" />
                          <p className="text-xs font-medium">No tasks</p>
                          <p className="text-[10px] mt-0.5">Drag here or click +</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. PENDING REQUESTS / APPROVAL QUEUE */}
          {viewTab === "pending" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="admin-pending-requests-view">
              {filteredPending.map((task) => {
                const pc = PRIORITY_CONFIG[task.priority ?? "MEDIUM"] ?? PRIORITY_CONFIG.MEDIUM;
                return (
                  <Card key={task.id} className="border border-amber-200 dark:border-amber-950/40 bg-amber-50/10 dark:bg-amber-950/5 hover:shadow-xs transition-shadow">
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 uppercase text-[9px] tracking-wider px-1.5 py-0.5 font-bold">
                              Pending Approval
                            </Badge>
                            {task.priority && (
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5 font-semibold", pc.className)}>
                                {pc.label}
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-base font-semibold leading-snug pt-1">{task.title}</h3>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMutation.mutate({ id: task.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3 bg-muted/30 p-2.5 rounded-lg border border-border/30 font-normal">
                          {task.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-border/40 pt-3">
                        <div>
                          <span className="text-muted-foreground block font-medium">Requested By</span>
                          <span className="font-semibold text-foreground">{task.requestedByName || "Unknown"}</span>
                          {task.requestedByEmail && <span className="text-[10px] text-muted-foreground block truncate">{task.requestedByEmail}</span>}
                        </div>
                        <div>
                          <span className="text-muted-foreground block font-medium">Requested Date</span>
                          <span className="font-semibold text-foreground">
                            {task.requestedAt ? format(new Date(task.requestedAt), "dd MMM yyyy, hh:mm a") : "N/A"}
                          </span>
                        </div>
                        {task.projectName && (
                          <div className="col-span-2 mt-1">
                            <span className="text-muted-foreground block font-medium">Project</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground">{task.projectName}</span>
                              {(task as any).subprojectName && (
                                <span className="text-[11px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-medium">
                                  ↳ {(task as any).subprojectName}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="col-span-2 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground font-medium">Due Date:</span>
                            <span className="font-semibold text-foreground">{format(new Date(task.dueDate), "dd MMM yyyy")}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-border/40 flex-wrap justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenModifyDialog(task)}
                          className="text-xs h-8 px-2.5 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/20"
                        >
                          Modify & Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRejectDialog(task)}
                          className="text-xs h-8 px-2.5 text-rose-600 hover:bg-rose-50 border-rose-200 hover:border-rose-300 dark:text-rose-400 dark:hover:bg-rose-950/20"
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveTask(task.id, task.requestedBy)}
                          className="text-xs h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 font-medium"
                        >
                          Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredPending.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <CheckSquare className="h-8 w-8 mb-2 opacity-55" />
                  <p className="text-sm font-medium">All caught up! No pending requests to review.</p>
                </div>
              )}
            </div>
          )}

          {/* 3. TEAM WORKLOAD & DAILY TASKS VIEW (Where Admin & Manager see all daily & pending tasks and how everyone is working) */}
          {viewTab === "team-workload" && (
            <div className="space-y-6" id="admin-team-workload-view">
              {/* Top Action Bar & Quick Metrics */}
              <div className="bg-card border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Filter View:</span>
                  <Button
                    size="sm"
                    variant={teamTaskFilter === "TODAY" ? "default" : "outline"}
                    onClick={() => setTeamTaskFilter("TODAY")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Today's Tasks ({todaysTasksList.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={teamTaskFilter === "PENDING" ? "default" : "outline"}
                    onClick={() => setTeamTaskFilter("PENDING")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    All Pending ({allPendingTasksList.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={teamTaskFilter === "OVERDUE" ? "default" : "outline"}
                    onClick={() => setTeamTaskFilter("OVERDUE")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    Overdue ({overdueTasksList.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={teamTaskFilter === "MEMBERS" ? "default" : "outline"}
                    onClick={() => setTeamTaskFilter("MEMBERS")}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Team Workload Matrix ({teamWorkloadList.length})
                  </Button>
                </div>

                {/* 1-Click Notify Managers of Today's Tasks */}
                <Button
                  size="sm"
                  onClick={handleNotifyManagersOfToday}
                  disabled={isNotifyingManagers}
                  className="h-8 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shadow-xs shrink-0"
                  title="Sends an in-app briefing notification of all today's tasks and pending workloads to all managers"
                >
                  <Bell className="h-3.5 w-3.5 fill-current" />
                  Notify Managers of Today's Tasks
                </Button>
              </div>

              {/* View 3A: Team Member Work Performance Grid ("Where admin can see how is everyone working") */}
              {(teamTaskFilter === "MEMBERS" || teamTaskFilter === "TODAY") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold font-heading flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Employee Workload & Performance Breakdown
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      Click any employee to inspect their assigned tasks
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {teamWorkloadList.map((member) => {
                      const memberId = (member as any).id || member.user?.id;
                      const isExpanded = expandedUserId === memberId;
                      const hasActiveWork = member.todayTasks.length > 0 || member.pendingTasks.length > 0;

                      return (
                        <Card
                          key={memberId}
                          className={cn(
                            "border transition-all bg-card overflow-hidden shadow-2xs hover:border-primary/40",
                            member.overdueTasks.length > 0 ? "border-rose-300 dark:border-rose-900/50" : "border-border"
                          )}
                        >
                          <div className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0 border border-primary/20">
                                  {member.user.name?.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "U"}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-sm text-foreground truncate">{member.user.name}</h4>
                                  <p className="text-[11px] text-muted-foreground truncate">{member.user.email}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium">
                                      {member.user.systemRole || member.user.role || "Team Member"}
                                    </Badge>
                                    {member.user.department && (
                                      <span className="text-[10px] text-muted-foreground">• {member.user.department}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <Badge
                                className={cn(
                                  "text-[10px] px-2 py-0.5 font-bold shrink-0",
                                  member.todayTasks.length > 0
                                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                    : hasActiveWork
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                )}
                              >
                                {member.todayTasks.length > 0
                                  ? `${member.todayTasks.length} Due Today`
                                  : hasActiveWork
                                  ? `${member.pendingTasks.length} Active`
                                  : "All Done"}
                              </Badge>
                            </div>

                            {/* Stat counts bar */}
                            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t text-center">
                              <div className="p-1.5 rounded bg-muted/40">
                                <span className="text-[10px] text-muted-foreground block">Today</span>
                                <span className={cn("text-xs font-bold", member.todayTasks.length > 0 ? "text-amber-600 font-extrabold" : "text-foreground")}>
                                  {member.todayTasks.length}
                                </span>
                              </div>
                              <div className="p-1.5 rounded bg-muted/40">
                                <span className="text-[10px] text-muted-foreground block">Pending</span>
                                <span className="text-xs font-bold text-foreground">{member.pendingTasks.length}</span>
                              </div>
                              <div className="p-1.5 rounded bg-muted/40">
                                <span className="text-[10px] text-muted-foreground block">Overdue</span>
                                <span className={cn("text-xs font-bold", member.overdueTasks.length > 0 ? "text-rose-600 font-extrabold" : "text-foreground")}>
                                  {member.overdueTasks.length}
                                </span>
                              </div>
                              <div className="p-1.5 rounded bg-muted/40">
                                <span className="text-[10px] text-muted-foreground block">Done</span>
                                <span className="text-xs font-bold text-emerald-600">{member.completedTasks.length}</span>
                              </div>
                            </div>

                            {/* Completion Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>Task Completion</span>
                                <span className="font-bold">{member.completionRate}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                  style={{ width: `${member.completionRate}%` }}
                                />
                              </div>
                            </div>

                            {/* Expand Tasks Toggle Button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedUserId(isExpanded ? null : ((member as any).id || member.user?.id))}
                              className="w-full h-7 text-xs text-muted-foreground hover:text-foreground justify-between px-2 pt-1 border-t"
                            >
                              <span>{isExpanded ? "Hide Assigned Tasks" : `View Assigned Tasks (${member.tasks.length})`}</span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </Button>
                          </div>

                          {/* Expanded Task List for this Employee */}
                          {isExpanded && (
                            <div className="bg-muted/20 border-t p-3 space-y-2 max-h-60 overflow-y-auto">
                              {member.tasks.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">No tasks assigned.</p>
                              ) : (
                                member.tasks.map((t: any) => {
                                  const isDueToday = t.dueDate && t.dueDate.startsWith(todayStr);
                                  const isTaskOverdue = t.dueDate && t.status !== "DONE" && isBefore(parseISO(t.dueDate), startOfDay(new Date()));
                                  return (
                                    <div
                                      key={t.id}
                                      className={cn(
                                        "p-2 rounded-lg border bg-card text-xs flex items-center justify-between gap-2 hover:border-primary/40 transition-colors",
                                        isDueToday && "border-amber-400 bg-amber-500/5",
                                        isTaskOverdue && "border-rose-400 bg-rose-500/5"
                                      )}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <Badge variant="outline" className="text-[9px] px-1 py-0">{t.status}</Badge>
                                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{t.priority}</Badge>
                                          {isDueToday && (
                                            <span className="text-[9px] text-amber-600 font-bold bg-amber-100 dark:bg-amber-950/40 px-1 rounded">
                                              Due Today
                                            </span>
                                          )}
                                        </div>
                                        <p className="font-semibold text-foreground truncate">{t.title}</p>
                                        {t.projectName && (
                                          <div className="flex items-center gap-1.5 truncate">
                                            <p className="text-[10px] text-muted-foreground truncate">{t.projectName}</p>
                                            {(t as any).subprojectName && (
                                              <span className="text-[9px] text-primary truncate">↳ {(t as any).subprojectName}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                                        onClick={() => handleOpenAdminEditDialog(t)}
                                        title="Edit / Reassign Task"
                                      >
                                        <Edit3 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View 3B: Today's Tasks & Pending Tasks Feed */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-heading flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500" />
                    {teamTaskFilter === "TODAY"
                      ? `Today's Daily Tasks Feed (${todaysTasksList.length})`
                      : teamTaskFilter === "OVERDUE"
                      ? `Overdue Tasks (${overdueTasksList.length})`
                      : `All Pending Tasks Feed (${allPendingTasksList.length})`}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Live operational task feed across all employees
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(teamTaskFilter === "TODAY"
                    ? todaysTasksList
                    : teamTaskFilter === "OVERDUE"
                    ? overdueTasksList
                    : allPendingTasksList
                  ).map((task: any) => {
                    const isDueToday = task.dueDate && task.dueDate.startsWith(todayStr);
                    const isTaskOverdue = task.dueDate && task.status !== "DONE" && isBefore(parseISO(task.dueDate), startOfDay(new Date()));

                    return (
                      <Card
                        key={task.id}
                        className={cn(
                          "border bg-card p-3.5 space-y-2.5 hover:shadow-xs transition-shadow relative",
                          isDueToday ? "border-l-[3px] border-l-amber-500 border-amber-300" : isTaskOverdue ? "border-l-[3px] border-l-rose-500 border-rose-300" : "border-border"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">{task.status}</Badge>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{task.priority}</Badge>
                              {isDueToday && (
                                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] px-1.5 py-0 font-bold">
                                  Due Today
                                </Badge>
                              )}
                              {isTaskOverdue && (
                                <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[9px] px-1.5 py-0 font-bold">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-foreground leading-snug line-clamp-2">{task.title}</h4>
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => handleOpenAdminEditDialog(task)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded border border-border/20">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 text-xs border-t pt-2 text-muted-foreground">
                          <div className="flex items-center gap-1.5 truncate">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-semibold text-foreground truncate">{task.assigneeName || "Unassigned"}</span>
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1 shrink-0 font-medium text-[11px]">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(task.dueDate), "dd MMM")}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}

                  {(teamTaskFilter === "TODAY" ? todaysTasksList : teamTaskFilter === "OVERDUE" ? overdueTasksList : allPendingTasksList).length === 0 && (
                    <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/10">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-70" />
                      <p className="font-semibold text-sm">
                        {teamTaskFilter === "TODAY" ? "All clear! No pending tasks due today." : "No tasks matching this filter."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. MY REQUESTS TRACKER */}
          {viewTab === "requests" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="admin-requests-tracker-view">
              {filteredRequests.map((task) => {
                const pc = PRIORITY_CONFIG[task.priority ?? "MEDIUM"] ?? PRIORITY_CONFIG.MEDIUM;
                const cardEl = (
                  <Card key={task.id} className="border border-border bg-card hover:shadow-xs transition-shadow relative">
                    <div className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getStatusBadge(task.approvalStatus)}
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5", pc.className)}>
                              {pc.label}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-semibold leading-snug pt-1">{task.title}</h3>
                        </div>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={() => handleOpenAdminEditDialog(task)}
                          data-testid={`edit-request-btn-${task.id}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4 pt-0 space-y-2.5 text-xs">
                      {task.description && (
                        <p className="text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded border border-border/20 font-normal">
                          {task.description}
                        </p>
                      )}
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        {task.projectName && (
                          <p className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground">Project:</span> {task.projectName}
                            {(task as any).subprojectName && (
                              <span className="text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded font-medium text-xs">
                                ↳ {(task as any).subprojectName}
                              </span>
                            )}
                          </p>
                        )}
                        {task.dueDate && (
                          <p><span className="font-semibold text-foreground">Due Date:</span> {format(new Date(task.dueDate), "dd MMM yyyy")}</p>
                        )}
                        <p><span className="font-semibold text-foreground">Requested At:</span> {task.requestedAt ? format(new Date(task.requestedAt), "dd MMM yyyy, hh:mm a") : "N/A"}</p>
                        {task.approvalStatus === "REJECTED" && task.rejectionReason && (
                          <div className="mt-2 p-2 rounded bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 text-rose-700 dark:text-rose-300">
                            <span className="font-bold block text-[10px] uppercase tracking-wider mb-0.5">Rejection remarks:</span>
                            {task.rejectionReason}
                          </div>
                        )}
                        {(task.approvalStatus === "APPROVED" || task.approvalStatus === "MODIFIED") && task.approvedByName && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                            Approved by {task.approvedByName} {task.approvedAt ? `on ${format(new Date(task.approvedAt), "dd MMM, hh:mm a")}` : ""}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );

                return task.description?.trim() ? (
                  <Tooltip key={task.id}>
                    <TooltipTrigger asChild>
                      {cardEl}
                    </TooltipTrigger>
                    <TooltipContent className="z-50 bg-slate-900 border border-slate-800 text-slate-100 dark:bg-slate-950 dark:border-slate-850 p-3 max-w-sm whitespace-pre-wrap rounded-lg shadow-xl leading-relaxed text-xs font-normal">
                      <div className="font-semibold text-slate-400 mb-1 border-b border-slate-800 pb-1">Description</div>
                      {task.description}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  cardEl
                );
              })}
              {filteredRequests.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <CheckSquare className="h-8 w-8 mb-2 opacity-55" />
                  <p className="text-sm font-medium">No requests tracked.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ADMIN DIALOGS */}
      <TaskActionDialogs
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        defaultStatus={defaultStatus}
        projects={projects}
        users={users}
        onCreateSubmit={onSubmit}
        isCreatePending={createMutation.isPending}

        rejectDialogOpen={rejectDialogOpen}
        setRejectDialogOpen={setRejectDialogOpen}
        rejectionReasonText={rejectionReasonText}
        setRejectionReasonText={setRejectionReasonText}
        onConfirmReject={handleConfirmReject}
        selectedTaskForAction={selectedTaskForAction}

        modifyDialogOpen={modifyDialogOpen}
        setModifyDialogOpen={setModifyDialogOpen}
        onConfirmModify={handleConfirmModify}

        adminEditDialogOpen={adminEditDialogOpen}
        setAdminEditDialogOpen={setAdminEditDialogOpen}
        onConfirmAdminEdit={handleConfirmAdminEdit}
        isUpdatePending={updateMutation.isPending}
      />
    </div>
  );
}
