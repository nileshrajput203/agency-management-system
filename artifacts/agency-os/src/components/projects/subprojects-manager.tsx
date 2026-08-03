import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Layers, ChevronDown, Calendar, Eye, User, FileText, Target, CheckSquare, Package, StickyNote } from "lucide-react";
import { cn, formatDateOnly } from "@/lib/utils";

export interface Subproject {
  id: string;
  projectId: string;
  name: string;
  status?: string;
  priority?: string;
  description?: string;
  objective?: string;
  requirements?: string;
  deliverables?: string;
  notes?: string;
  startDate?: string;
  dueDate?: string;
  assignedTo?: string;
  assignedEmployeeName?: string;
  createdAt: string;
}

interface SubprojectFormData {
  name: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  description?: string;
  objective?: string;
  requirements?: string;
  deliverables?: string;
  notes?: string;
  startDate?: string;
  dueDate?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-slate-100 text-slate-700 border-slate-200" },
  PLANNING: { label: "Planning", className: "bg-purple-100 text-purple-700 border-purple-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ON_HOLD: { label: "On Hold", className: "bg-orange-100 text-orange-700 border-orange-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

function getAuthHeaders(json = true) {
  const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || localStorage.getItem("auth_token") || "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export function ProjectSubprojects({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingSubproject, setEditingSubproject] = useState<Subproject | null>(null);
  const [viewingSubproject, setViewingSubproject] = useState<Subproject | null>(null);

  const qc = useQueryClient();

  const { data: subprojects, isLoading } = useQuery<Subproject[]>({
    queryKey: ["subprojects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/subprojects`, {
        headers: getAuthHeaders(false),
      });
      if (!res.ok) throw new Error("Failed to load subprojects");
      return res.json();
    },
    enabled: expanded,
  });

  const { data: users } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch("/api/users", { headers: getAuthHeaders(false) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: dialogOpen && isAdmin,
  });

  const { register, handleSubmit, control, reset } = useForm<SubprojectFormData>({
    defaultValues: { name: "", status: "NOT_STARTED", priority: "MEDIUM" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SubprojectFormData) => {
      const res = await fetch(`/api/projects/${projectId}/subprojects`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create subproject");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Subproject created");
      qc.invalidateQueries({ queryKey: ["subprojects", projectId] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to create subproject"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SubprojectFormData }) => {
      const res = await fetch(`/api/projects/${projectId}/subprojects/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(true),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update subproject");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Subproject updated");
      qc.invalidateQueries({ queryKey: ["subprojects", projectId] });
      setDialogOpen(false);
      setEditingSubproject(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update subproject"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${projectId}/subprojects/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(false),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete subproject");
      }
    },
    onSuccess: () => {
      toast.success("Subproject deleted");
      qc.invalidateQueries({ queryKey: ["subprojects", projectId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete subproject"),
  });

  const openAdd = () => {
    if (!isAdmin) return;
    setEditingSubproject(null);
    reset({
      name: "",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      assignedTo: "",
      description: "",
      objective: "",
      requirements: "",
      deliverables: "",
      notes: "",
      startDate: "",
      dueDate: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (sub: Subproject) => {
    if (!isAdmin) return;
    setEditingSubproject(sub);
    reset({
      name: sub.name,
      status: sub.status || "NOT_STARTED",
      priority: sub.priority || "MEDIUM",
      assignedTo: sub.assignedTo || "",
      description: sub.description || "",
      objective: sub.objective || "",
      requirements: sub.requirements || "",
      deliverables: sub.deliverables || "",
      notes: sub.notes || "",
      startDate: sub.startDate ? sub.startDate.split("T")[0] : "",
      dueDate: sub.dueDate ? sub.dueDate.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const openViewDetails = (sub: Subproject) => {
    setViewingSubproject(sub);
    setViewDialogOpen(true);
  };

  const onSubmit = (data: SubprojectFormData) => {
    if (!isAdmin) return;
    if (editingSubproject) {
      updateMutation.mutate({ id: editingSubproject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="pt-2 border-t border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-xs h-7 px-2 gap-1.5 font-medium text-muted-foreground hover:text-foreground"
          data-testid={`toggle-subprojects-${projectId}`}
        >
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>Subprojects {subprojects ? `(${subprojects.length})` : ""}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && "rotate-180")} />
        </Button>

        {expanded && isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={openAdd}
            className="h-6 px-2 text-[11px] gap-1 font-medium"
            data-testid={`add-subproject-btn-${projectId}`}
          >
            <Plus className="h-3 w-3" /> Add Subproject
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-1.5 pl-1 pt-1">
          {isLoading ? (
            <Skeleton className="h-8 w-full rounded-md" />
          ) : !subprojects || subprojects.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1 px-2">No subprojects created yet.</p>
          ) : (
            subprojects.map((sub) => {
              const sc = STATUS_CONFIG[sub.status ?? "NOT_STARTED"] ?? STATUS_CONFIG.NOT_STARTED;
              return (
                <div
                  key={sub.id}
                  onClick={() => openViewDetails(sub)}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/40 text-xs hover:bg-muted/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">{sub.name}</span>
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border shrink-0", sc.className)}>
                      {sc.label}
                    </Badge>
                    {sub.assignedEmployeeName && (
                      <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1 shrink-0">
                        <User className="h-3 w-3" />
                        {sub.assignedEmployeeName}
                      </span>
                    )}
                    {sub.dueDate && (
                      <span className="text-[11px] text-muted-foreground hidden md:flex items-center gap-1 shrink-0">
                        <Calendar className="h-3 w-3" />
                        {formatDateOnly(sub.dueDate, "dd MMM")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => openViewDetails(sub)}
                      title="View Subproject Details"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(sub)}
                          title="Edit Subproject"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(sub.id)}
                          title="Delete Subproject"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW SUBPROJECT DETAILS DIALOG (READ-ONLY FOR ALL, ESPECIALLY EMPLOYEES) */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                {viewingSubproject?.name}
              </DialogTitle>
              {viewingSubproject?.status && (
                <Badge variant="outline" className={cn("text-xs border px-2 py-0.5", STATUS_CONFIG[viewingSubproject.status]?.className)}>
                  {STATUS_CONFIG[viewingSubproject.status]?.label || viewingSubproject.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {viewingSubproject && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</p>
                  <p className="font-medium capitalize mt-0.5">{viewingSubproject.priority?.toLowerCase() || "Medium"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Employee</p>
                  <p className="font-medium mt-0.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {viewingSubproject.assignedEmployeeName || "Unassigned"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Date</p>
                  <p className="font-medium mt-0.5">{viewingSubproject.startDate ? formatDateOnly(viewingSubproject.startDate, "dd MMM yyyy") : "Not set"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</p>
                  <p className="font-medium mt-0.5">{viewingSubproject.dueDate ? formatDateOnly(viewingSubproject.dueDate, "dd MMM yyyy") : "Not set"}</p>
                </div>
              </div>

              {viewingSubproject.description && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" /> Description
                  </p>
                  <p className="text-sm bg-muted/20 p-2.5 rounded-md border border-border/40 whitespace-pre-wrap">{viewingSubproject.description}</p>
                </div>
              )}

              {viewingSubproject.objective && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-primary" /> Objective
                  </p>
                  <p className="text-sm bg-muted/20 p-2.5 rounded-md border border-border/40 whitespace-pre-wrap">{viewingSubproject.objective}</p>
                </div>
              )}

              {viewingSubproject.requirements && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CheckSquare className="h-3.5 w-3.5 text-primary" /> Requirements
                  </p>
                  <p className="text-sm bg-muted/20 p-2.5 rounded-md border border-border/40 whitespace-pre-wrap">{viewingSubproject.requirements}</p>
                </div>
              )}

              {viewingSubproject.deliverables && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-primary" /> Deliverables
                  </p>
                  <p className="text-sm bg-muted/20 p-2.5 rounded-md border border-border/40 whitespace-pre-wrap">{viewingSubproject.deliverables}</p>
                </div>
              )}

              {viewingSubproject.notes && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <StickyNote className="h-3.5 w-3.5 text-primary" /> Notes
                  </p>
                  <p className="text-sm bg-muted/20 p-2.5 rounded-md border border-border/40 whitespace-pre-wrap">{viewingSubproject.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            {isAdmin && viewingSubproject && (
              <Button onClick={() => { setViewDialogOpen(false); openEdit(viewingSubproject); }}>
                Edit Subproject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT SUBPROJECT DIALOG (ADMIN ONLY) */}
      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSubproject ? "Edit Subproject" : "Add Subproject"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Subproject Name *</Label>
                <Input
                  {...register("name", { required: true })}
                  placeholder="e.g. Module A, Reel 1..."
                  data-testid="subproject-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value || "NOT_STARTED"} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Controller
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value || "MEDIUM"} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Assigned Employee</Label>
                <Controller
                  control={control}
                  name="assignedTo"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select assigned employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {(users ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" {...register("startDate")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" {...register("dueDate")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea {...register("description")} placeholder="Brief overview or description..." rows={2} />
              </div>

              <div className="space-y-1.5">
                <Label>Objective</Label>
                <Textarea {...register("objective")} placeholder="Core goals or objective of this subproject..." rows={2} />
              </div>

              <div className="space-y-1.5">
                <Label>Requirements</Label>
                <Textarea {...register("requirements")} placeholder="Technical or functional requirements..." rows={2} />
              </div>

              <div className="space-y-1.5">
                <Label>Deliverables</Label>
                <Textarea {...register("deliverables")} placeholder="Expected outputs or deliverables..." rows={2} />
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea {...register("notes")} placeholder="Additional notes or references..." rows={2} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingSubproject ? "Save Changes" : "Create Subproject"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
