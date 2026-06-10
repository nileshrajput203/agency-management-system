// @ts-nocheck
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { Plus, Trash2, Calendar, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "DONE", label: "Done" },
];

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200" },
  MEDIUM: { label: "Medium", className: "bg-blue-100 text-blue-700 border-blue-200" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200" },
  URGENT: { label: "Urgent", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const COL_STYLE: Record<string, string> = {
  TODO: "border-t-slate-300",
  IN_PROGRESS: "border-t-blue-400",
  IN_REVIEW: "border-t-amber-400",
  DONE: "border-t-emerald-400",
};

export default function TasksPage() {
  const qc = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState("TODO");
  const [dragging, setDragging] = useState<string | null>(null);

  const { data: tasks, isLoading } = useListTasks();
  const { data: projects } = useListProjects();
  const { data: users } = useListUsers();

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        toast.success("Task created");
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
      onError: () => toast.error("Failed to move task"),
    },
  });

  const deleteMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        toast.success("Task deleted");
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
      },
    },
  });

  const { register, handleSubmit, control, reset } = useForm<TaskInput>({
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
    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const filtered = (tasks ?? []).filter((t) => {
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    return true;
  });

  const byStatus = (status: string) => filtered.filter((t) => t.status === status);

  return (
    <div className="p-6 animated-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tasks?.length ?? 0} total tasks</p>
        </div>
        <div className="flex items-center gap-3">
          // @ts-ignore
          <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val as string)}>
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
          <Button onClick={() => openAdd("TODO")} className="gap-2 btn-micro-anim" data-testid="add-task-btn">
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <Card key={col.key}><CardContent className="p-4"><Skeleton className="h-48" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colTasks = byStatus(col.key);
            return (
              <div
                key={col.key}
                className={cn("rounded-xl border border-border bg-muted/30 border-t-2", COL_STYLE[col.key])}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) {
                    handleDrop(dragging, col.key);
                    setDragging(null);
                  }
                }}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{col.label}</p>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {colTasks.length}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => openAdd(col.key)}
                    data-testid={`add-task-${col.key}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="p-2 space-y-2 min-h-16">
                  {colTasks.map((task) => {
                    const pc = PRIORITY_CONFIG[task.priority ?? "MEDIUM"];
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDragging(task.id)}
                        onDragEnd={() => setDragging(null)}
                        className="bg-card rounded-lg border border-border p-3 shadow-sm cursor-grab active:cursor-grabbing group space-y-2"
                        data-testid={`task-card-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate({ id: task.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {task.projectName && (
                          <p className="text-[11px] text-muted-foreground">{task.projectName}</p>
                        )}

                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={cn("text-[10px] border px-1.5 py-0", pc.className)}>
                            {pc.label}
                          </Badge>
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Calendar className="h-2.5 w-2.5" />
                              {format(new Date(task.dueDate), "dd MMM")}
                            </div>
                          )}
                        </div>

                        {task.assigneeName && (
                          <p className="text-[11px] text-muted-foreground">{task.assigneeName}</p>
                        )}
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/50">
                      <CheckSquare className="h-5 w-5 mb-1" />
                      <p className="text-xs">Drop tasks here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input {...register("title", { required: "Required" })} placeholder="Task title" data-testid="task-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value ?? defaultStatus} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Controller control={control} name="projectId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No project</SelectItem>
                      {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Controller control={control} name="assigneeId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input {...register("dueDate")} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={3} placeholder="Task details..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-task-btn">
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
