// @ts-nocheck
import { useState } from "react";
import {
  useListProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useListClients, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import type { ProjectInput } from "@workspace/api-client-react";
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
import { useForm, Controller } from "react-hook-form";
import { Plus, Search, FolderKanban, Trash2, Pencil, Calendar } from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-slate-100 text-slate-700 border-slate-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ON_HOLD: { label: "On Hold", className: "bg-orange-100 text-orange-700 border-orange-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-600" },
  MEDIUM: { label: "Medium", className: "bg-blue-100 text-blue-700" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700" },
  URGENT: { label: "Urgent", className: "bg-rose-100 text-rose-700" },
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data: projects, isLoading } = useListProjects();
  const { data: clients } = useListClients();

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project created");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create project"),
    },
  });

  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project updated");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setDialogOpen(false);
        setEditId(null);
      },
      onError: () => toast.error("Failed to update project"),
    },
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project deleted");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: () => toast.error("Failed to delete project"),
    },
  });

  const { register, handleSubmit, control, reset } = useForm<ProjectInput>({
    // @ts-ignore
    defaultValues: { name: "", status: "NOT_STARTED", priority: "MEDIUM", progress: 0 },
  });

  const openAdd = () => {
    // @ts-ignore
    reset({ name: "", status: "NOT_STARTED", priority: "MEDIUM", progress: 0 });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (p: NonNullable<typeof projects>[number]) => {
    setEditId(p.id);
    reset({
      name: p.name,
      status: p.status ?? "NOT_STARTED",
      priority: p.priority ?? "MEDIUM",
      // @ts-ignore
      progress: p.progress ?? 0,
      clientId: p.clientId ?? undefined,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ProjectInput) => {
    // @ts-ignore
    const payload = { ...data, progress: Number(data.progress) };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const filtered = (projects ?? []).filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5 animated-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects?.length ?? 0} total projects</p>
        </div>
        <Button onClick={openAdd} className="gap-2 btn-micro-anim" data-testid="add-project-btn">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        // @ts-ignore
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as string)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const sc = STATUS_CONFIG[p.status ?? "NOT_STARTED"];
            const pc = PRIORITY_CONFIG[p.priority ?? "MEDIUM"];
            return (
              <Card key={p.id} className="scale-hover">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold line-clamp-2">{p.name}</p>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: p.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {p.clientName && (
                    <p className="text-xs text-muted-foreground">{p.clientName}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={sc.className + " text-[11px]"}>{sc.label}</Badge>
                    <Badge variant="outline" className={pc.className + " text-[11px]"}>{pc.label}</Badge>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{p.progress ?? 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${p.progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  // @ts-ignore
                  {(p.startDate || p.dueDate) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {p.startDate && <span>{format(new Date(p.startDate), "dd MMM")}</span>}
                      // @ts-ignore
                      {p.startDate && p.dueDate && <span>—</span>}
                      // @ts-ignore
                      {p.dueDate && <span>{format(new Date(p.dueDate), "dd MMM yyyy")}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          // @ts-ignore
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input {...register("name", { required: "Required" })} placeholder="Website Redesign" data-testid="project-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select client (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No client</SelectItem>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value ?? "NOT_STARTED"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
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
                <Label>Start Date</Label>
                <Input {...register("startDate")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                // @ts-ignore
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Progress (%)</Label>
              // @ts-ignore
              <Input {...register("progress")} type="number" min={0} max={100} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={3} placeholder="Project description..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="save-project-btn">
                {editId ? "Save Changes" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
