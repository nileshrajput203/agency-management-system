import { useState } from "react";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  useListProjects, getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { TaskInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  Plus, Trash2, Calendar, CheckSquare, CheckCircle2, Edit3, FileText, EyeOff, Eye
} from "lucide-react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/common/SearchBar";
import { useAuth } from "@/App";
import {
  Tooltip, TooltipTrigger, TooltipContent
} from "@/components/ui/tooltip";
import { COLUMNS, PRIORITY_CONFIG, isCompletedTask, sortTasksByDueDate } from "./task-constants";

export function EmployeeTasksView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [employeeEditDialogOpen, setEmployeeEditDialogOpen] = useState(false);
  const [selectedTaskForActionState, setSelectedTaskForAction] = useState<any | null>(null);
  const [employeeApprovedEditDialogOpen, setEmployeeApprovedEditDialogOpen] = useState(false);

  const handleOpenEmployeeApprovedEditDialog = (task: any) => {
    setSelectedTaskForAction(task);
    setEmployeeApprovedEditDialogOpen(true);
  };

  const handleConfirmEmployeeApprovedEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTaskForAction) return;
    const formData = new FormData(e.currentTarget);
    const description = formData.get("description") as string;
    const selectedStatus = formData.get("status") as string;
    const status = isCompletedTask(selectedStatus) ? "IN_REVIEW" : selectedStatus;

    updateRequestMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        description,
        status,
      } as any,
    }, {
      onSuccess: () => {
        toast.success("Task updated successfully!");
        setEmployeeApprovedEditDialogOpen(false);
      }
    });
  };

  const { data: tasks, isLoading } = useListTasks();
  const selectedTaskForAction = selectedTaskForActionState ? (tasks ?? []).find((t: any) => t.id === selectedTaskForActionState.id) || selectedTaskForActionState : null;
  const { data: projects } = useListProjects();

  const createRequestMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        toast.success("Task Request Submitted. Waiting for Admin Approval.");
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        reset({ title: "", status: "TODO", priority: "MEDIUM", description: "" });
        setRequestDialogOpen(false);
      },
      onError: () => toast.error("Failed to submit task request"),
    },
  });

  const updateRequestMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
      onError: () => toast.error("Failed to update task request"),
    },
  });

  const deleteRequestMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        toast.success("Task request deleted successfully");
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
      onError: () => toast.error("Failed to delete task request"),
    },
  });

  const { register, handleSubmit, control, reset, setValue } = useForm<TaskInput>({
    defaultValues: { title: "", status: "TODO", priority: "MEDIUM" },
  });

  const openRequestDialog = () => {
    reset({ title: "", status: "TODO", priority: "MEDIUM", description: "" });
    setRequestDialogOpen(true);
  };

  const onSubmitRequest = (data: TaskInput) => {
    createRequestMutation.mutate({ data });
  };

  const handleUpdateStatus = (taskId: string, newStatus: string) => {
    const requestedStatus = isCompletedTask(newStatus) ? "IN_REVIEW" : newStatus;
    updateRequestMutation.mutate({
      id: taskId,
      data: { status: requestedStatus } as any,
    }, {
      onSuccess: () => {
        toast.success(requestedStatus === "IN_REVIEW" && isCompletedTask(newStatus)
          ? "Task submitted for manager review"
          : "Task status updated");
      }
    });
  };

  const handleOpenEmployeeEditDialog = (task: any) => {
    setSelectedTaskForAction(task);
    setEmployeeEditDialogOpen(true);
  };

  const handleConfirmEmployeeEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTaskForAction) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const priority = formData.get("priority") as string;
    const rawProjectId = formData.get("projectId") as string;
    const projectId = (!rawProjectId || rawProjectId === "none") ? null : rawProjectId;
    const dueDate = formData.get("dueDate") as string || null;

    updateRequestMutation.mutate({
      id: selectedTaskForAction.id,
      data: {
        title,
        description,
        priority,
        projectId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      } as any,
    }, {
      onSuccess: () => {
        toast.success("Task request updated successfully!");
        setEmployeeEditDialogOpen(false);
      }
    });
  };

  const assignedTasks = (tasks ?? []).filter(
    (t) => t.assigneeId === user?.id && (t.approvalStatus === "APPROVED" || t.approvalStatus === "MODIFIED" || !t.approvalStatus)
  );

  const filteredAssigned = sortTasksByDueDate(assignedTasks.filter((t) => {
    // Completed work is rendered in its own section below.
    if (isCompletedTask(t.status)) return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q)
      );
    }
    return true;
  }));
  const completedAssigned = sortTasksByDueDate(
    assignedTasks.filter((t) => isCompletedTask(t.status))
  );

  const myRequests = (tasks ?? []).filter((t) => t.requestedBy === user?.id);

  const filteredRequests = sortTasksByDueDate(myRequests.filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        (t as any).projectName?.toLowerCase().includes(q)
      );
    }
    return true;
  }));

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">Pending Approval</Badge>;
      case "APPROVED":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">Rejected</Badge>;
      case "MODIFIED":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900">Modified</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">Approved</Badge>;
    }
  };

  return (
    <div className="p-6 animated-fade-in space-y-8" id="employee-workspace-container">
      {/* 1. HEADER SECTION */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">My Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personal task workspace for <span className="font-semibold text-primary">{user?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SearchBar placeholder="Search my tasks…" value={searchQuery} onChange={setSearchQuery} className="max-w-xs" />
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
          <Button onClick={openRequestDialog} className="gap-2 btn-micro-anim bg-primary hover:bg-primary/95 font-semibold" id="employee-request-task-btn">
            <Plus className="h-4 w-4" /> Request Task
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 2. MY ASSIGNED TASKS (LEFT / LARGER COL) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-lg font-bold font-heading text-foreground">My Assigned Tasks</h2>
              </div>
              <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5">
                {filteredAssigned.length} Tasks
              </Badge>
            </div>

            <div className="space-y-3" id="employee-assigned-tasks-list">
              {filteredAssigned.map((task) => {
                const pc = PRIORITY_CONFIG[task.priority ?? "MEDIUM"] ?? PRIORITY_CONFIG.MEDIUM;
                const isOverdue = task.dueDate && !isCompletedTask(task.status) && isBefore(parseISO(task.dueDate), startOfDay(new Date()));
                const cardEl = (
                  <Card
                    key={task.id}
                    className={cn(
                      "transition-all duration-200 border bg-card hover:shadow-xs group relative",
                      isOverdue ? "border-rose-300 dark:border-rose-900/60 bg-rose-50/10 dark:bg-rose-950/5 border-l-[3px] border-l-rose-500" : "border-border"
                    )}
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", pc.className)}>
                              {pc.label}
                            </Badge>
                            {task.projectName && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                                {task.projectName}
                              </Badge>
                            )}
                            {task.approvalStatus === "MODIFIED" && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] px-1.5 py-0 dark:bg-blue-950/40 dark:text-blue-400">
                                Modified by Admin
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-base font-semibold leading-snug pt-1 text-foreground">{task.title}</h3>
                        </div>

                        {/* Interactive Status Selector & Edit Button */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEmployeeApprovedEditDialog(task)}
                            data-testid={`employee-edit-btn-${task.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Select
                            value={task.status ?? "TODO"}
                            onValueChange={(newVal) => handleUpdateStatus(task.id, newVal)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COLUMNS.map((c) => (
                                <SelectItem key={c.key} value={c.key} className="text-xs">
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/30 font-normal">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-border/40 text-muted-foreground flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="font-semibold text-foreground">Assigned by:</span>
                          <span>Admin</span>
                        </div>

                        {task.dueDate && (
                          <div className={cn(
                            "flex items-center gap-1.5 text-[11px]",
                            isOverdue ? "text-rose-600 font-semibold" : ""
                          )}>
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Due {format(new Date(task.dueDate), "dd MMM yyyy")}</span>
                            {isOverdue && <span className="bg-rose-100 text-rose-700 text-[9px] px-1 rounded-full uppercase font-bold tracking-wider dark:bg-rose-950 dark:text-rose-400">Overdue</span>}
                          </div>
                        )}
                      </div>
                    </div>
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

              {filteredAssigned.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/60 bg-muted/10 border border-dashed rounded-xl">
                  <CheckCircle2 className="h-10 w-10 mb-2 opacity-50 text-emerald-500" />
                  <p className="text-sm font-bold text-foreground">All Caught Up!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">No tasks assigned to you right now.</p>
                </div>
              )}
              {!hideCompleted && completedAssigned.length > 0 && (
                <div className="pt-4 mt-4 border-t border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Completed Tasks
                    </h3>
                    <Badge variant="outline" className="text-[10px]">{completedAssigned.length}</Badge>
                  </div>
                  {completedAssigned.map((task) => (
                    <Card key={task.id} className="border border-emerald-200/70 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10 opacity-75">
                      <div className="p-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium line-through text-muted-foreground">{task.title}</p>
                        {task.dueDate && <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(task.dueDate), "dd MMM yyyy")}</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. MY TASK REQUESTS TRACKER (RIGHT / SMALLER COL) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500 shrink-0" />
                <h2 className="text-lg font-bold font-heading text-foreground">My Requests Tracker</h2>
              </div>
              <Badge variant="outline" className="font-semibold text-xs px-2.5 py-0.5">
                {filteredRequests.length} Requests
              </Badge>
            </div>

            <div className="space-y-3" id="employee-requests-list">
              {filteredRequests.map((task) => {
                const pc = PRIORITY_CONFIG[task.priority ?? "MEDIUM"] ?? PRIORITY_CONFIG.MEDIUM;
                const isPending = task.approvalStatus === "PENDING";
                const cardEl = (
                  <Card key={task.id} className="border border-border bg-card hover:shadow-xs transition-shadow relative">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getStatusBadge(task.approvalStatus)}
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase font-semibold", pc.className)}>
                              {pc.label}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-semibold leading-snug pt-1 text-foreground">{task.title}</h3>
                        </div>

                        {/* Edit & Delete actions ONLY on Pending Requests */}
                        {isPending && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEmployeeEditDialog(task)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteRequestMutation.mutate({ id: task.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/10 p-2 rounded-lg border border-border/20 font-normal">
                          {task.description}
                        </p>
                      )}

                      <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                        {task.projectName && (
                          <p><span className="font-semibold text-foreground">Project:</span> {task.projectName}</p>
                        )}
                        {task.dueDate && (
                          <p><span className="font-semibold text-foreground">Requested Due Date:</span> {format(new Date(task.dueDate), "dd MMM yyyy")}</p>
                        )}
                        <p><span className="font-semibold text-foreground">Submitted At:</span> {task.requestedAt ? format(new Date(task.requestedAt), "dd MMM yyyy, hh:mm a") : "N/A"}</p>

                        {/* Rejection Remarks display */}
                        {task.approvalStatus === "REJECTED" && task.rejectionReason && (
                          <div className="mt-2.5 p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950 text-rose-700 dark:text-rose-300">
                            <span className="font-bold block text-[10px] uppercase tracking-wider mb-0.5">Rejection remarks:</span>
                            {task.rejectionReason}
                          </div>
                        )}

                        {/* Admin approval info */}
                        {(task.approvalStatus === "APPROVED" || task.approvalStatus === "MODIFIED") && task.approvedByName && (
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                            Approved by {task.approvedByName} {task.approvedAt ? `on ${format(new Date(task.approvedAt), "dd MMM, hh:mm a")}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
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
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50 bg-muted/5 border border-dashed rounded-xl">
                  <FileText className="h-8 w-8 mb-1.5 opacity-40 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">No Requests Found</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Submit a task request via the "+ Request Task" button.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE REQUEST TASK DIALOG */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitRequest)} className="space-y-4 mt-2">
            <WriteWithAI
              context="task"
              onFill={(fields) => {
                if (fields.title) setValue("title", fields.title, { shouldDirty: true });
                if (fields.description) setValue("description", fields.description, { shouldDirty: true });
                if (fields.priority) setValue("priority", fields.priority, { shouldDirty: true });
                if (fields.dueDate) setValue("dueDate", fields.dueDate, { shouldDirty: true });
              }}
            />
            <div className="space-y-1.5">
              <Label>Task Title</Label>
              <Input {...register("title", { required: "Required" })} placeholder="What task needs to be completed?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Controller control={control} name="priority" render={({ field }) => (
                  <Select value={field.value ?? "MEDIUM"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Controller control={control} name="projectId" render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <div className="h-10 px-3 py-2 rounded-md border border-input bg-muted/50 text-sm flex items-center select-none text-muted-foreground font-medium">
                  {user?.name || "Assign to myself"}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description / Motivation</Label>
              <Textarea {...register("description")} rows={3} placeholder="Provide details or motivation for this task request..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createRequestMutation.isPending} className="font-semibold bg-primary hover:bg-primary/95 text-primary-foreground">
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EMPLOYEE EDIT PENDING REQUEST DIALOG */}
      <Dialog open={employeeEditDialogOpen} onOpenChange={setEmployeeEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task Request</DialogTitle>
          </DialogHeader>
          <form key={selectedTaskForAction?.id} onSubmit={handleConfirmEmployeeEdit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Task Title</Label>
              <Input name="title" defaultValue={selectedTaskForAction?.title || ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select name="priority" defaultValue={selectedTaskForAction?.priority || "MEDIUM"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select name="projectId" defaultValue={selectedTaskForAction?.projectId || "none"}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input name="dueDate" type="date" defaultValue={selectedTaskForAction?.dueDate ? selectedTaskForAction.dueDate.split("T")[0] : ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Description / Motivation</Label>
              <Textarea name="description" rows={3} defaultValue={selectedTaskForAction?.description || ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEmployeeEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateRequestMutation.isPending} className="font-semibold">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EMPLOYEE EDIT APPROVED TASK DIALOG */}
      <Dialog open={employeeApprovedEditDialogOpen} onOpenChange={setEmployeeApprovedEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Approved Task</DialogTitle>
          </DialogHeader>
          <form key={selectedTaskForAction?.id} onSubmit={handleConfirmEmployeeApprovedEdit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Task Title (Locked)</Label>
              <Input value={selectedTaskForAction?.title || ""} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority (Locked)</Label>
                <Input value={selectedTaskForAction?.priority || "MEDIUM"} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <Label>Project (Locked)</Label>
                <Input value={selectedTaskForAction?.projectName || "No Project"} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select name="status" defaultValue={selectedTaskForAction?.status || "TODO"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date (Locked)</Label>
                <Input type="date" value={selectedTaskForAction?.dueDate ? selectedTaskForAction.dueDate.split("T")[0] : ""} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" rows={4} defaultValue={selectedTaskForAction?.description || ""} placeholder="Add details or progress updates..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEmployeeApprovedEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateRequestMutation.isPending} className="font-semibold bg-primary hover:bg-primary/95 text-primary-foreground">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
