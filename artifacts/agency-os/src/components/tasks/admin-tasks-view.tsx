import { useState } from "react";
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
import { useForm, Controller } from "react-hook-form";
import {
  Plus, Trash2, Calendar, CheckSquare, Clock, AlertCircle, ListTodo, CheckCircle2, Edit3, EyeOff, Eye
} from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { cn, formatDateOnly } from "@/lib/utils";
import { SearchBar } from "@/components/common/SearchBar";
import { useAuth } from "@/App";
import {
  Tooltip, TooltipTrigger, TooltipContent
} from "@/components/ui/tooltip";
import { COLUMNS, PRIORITY_CONFIG, COL_STYLE } from "./task-constants";
import { TaskActionDialogs } from "./task-action-dialogs";

export function AdminTasksView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState("TODO");
  const [dragging, setDragging] = useState<string | null>(null);

  // View tabs: "board" (All Tasks), "pending" (Approval Queue), "requests" (My Requests Tracker)
  const [viewTab, setViewTab] = useState<"board" | "pending" | "requests">("board");
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
    const rawAssigneeId = formData.get("assigneeId") as string;
    const assigneeId = (!rawAssigneeId || rawAssigneeId === "unassigned") ? null : rawAssigneeId;
    const dueDate = formData.get("dueDate") as string || null;

    updateMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        title,
        description,
        objective,
        requirements,
        deliverables,
        notes,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        priority,
        status,
        projectId,
        assigneeId,
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
  const { data: users } = useListUsers();

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
    const rawAssigneeId = formData.get("assigneeId") as string;
    const assigneeId = (!rawAssigneeId || rawAssigneeId === "unassigned") ? null : rawAssigneeId;
    const dueDate = formData.get("dueDate") as string || null;

    updateMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        title,
        description,
        objective,
        requirements,
        deliverables,
        notes,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        priority,
        status,
        projectId,
        assigneeId,
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
    if (hideCompleted && t.status === "DONE") return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).assigneeName?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const byStatus = (status: string) => filteredActive.filter((t) => t.status === status);

  const pendingTasks = (tasks ?? []).filter((t) => t.approvalStatus === "PENDING");
  const filteredPending = pendingTasks.filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).assigneeName?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const myRequests = (tasks ?? []).filter((t) => t.requestedBy === user?.id || (t as any).createdBy === user?.id);
  const filteredRequests = myRequests.filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).assigneeName?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalDone = activeTasks.filter((t) => t.status === "DONE").length;
  const totalInProg = activeTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const totalOverdue = activeTasks.filter((t) =>
    t.status !== "DONE" && t.dueDate && isBefore(parseISO(t.dueDate), startOfDay(new Date()))
  ).length;

  const taskStatChips = [
    { label: "Active Tasks", value: activeTasks.length, accent: "border-l-primary", icon: <ListTodo className="h-4 w-4" /> },
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
          <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val ?? "ALL")}>
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
                              <p className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded inline-block">{task.projectName}</p>
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
                            <span className="font-semibold text-foreground">{task.projectName}</span>
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

          {/* 3. MY REQUESTS TRACKER */}
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
                          <p><span className="font-semibold text-foreground">Project:</span> {task.projectName}</p>
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
