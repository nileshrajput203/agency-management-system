import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { MultiAssigneePicker } from "@/components/common/MultiAssigneePicker";
import { COLUMNS, isCompletedTask } from "./task-constants";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useEffect, useState } from "react";
import type { TaskInput } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Layers, Plus, RefreshCw, FolderKanban } from "lucide-react";
import { useAuth } from "@/App";
import { isManagerOrAdminRole } from "@/lib/permissions";
import { TaskDeliverablesUploader } from "./task-deliverables-uploader";

interface SubprojectItem {
  id: string;
  projectId: string;
  projectName?: string | null;
  name: string;
  status?: string | null;
}

interface TaskActionDialogsProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  defaultStatus: string;
  projects?: Array<{ id: string; name: string }>;
  users?: Array<{ id: string; name: string }>;
  onCreateSubmit: (data: TaskInput) => void;
  isCreatePending: boolean;

  rejectDialogOpen: boolean;
  setRejectDialogOpen: (open: boolean) => void;
  rejectionReasonText: string;
  setRejectionReasonText: (text: string) => void;
  onConfirmReject: () => void;
  selectedTaskForAction: any;

  modifyDialogOpen: boolean;
  setModifyDialogOpen: (open: boolean) => void;
  onConfirmModify: (e: React.FormEvent<HTMLFormElement>) => void;

  adminEditDialogOpen: boolean;
  setAdminEditDialogOpen: (open: boolean) => void;
  onConfirmAdminEdit: (e: React.FormEvent<HTMLFormElement>) => void;
  isUpdatePending: boolean;
}

export function TaskActionDialogs({
  dialogOpen,
  setDialogOpen,
  defaultStatus,
  projects,
  users,
  onCreateSubmit,
  isCreatePending,

  rejectDialogOpen,
  setRejectDialogOpen,
  rejectionReasonText,
  setRejectionReasonText,
  onConfirmReject,
  selectedTaskForAction,

  modifyDialogOpen,
  setModifyDialogOpen,
  onConfirmModify,

  adminEditDialogOpen,
  setAdminEditDialogOpen,
  onConfirmAdminEdit,
  isUpdatePending,
}: TaskActionDialogsProps) {
  const { user } = useAuth();
  const isManager = isManagerOrAdminRole(user);

  const { register, handleSubmit, control, setValue, reset } = useForm<any>({
    defaultValues: {
      status: defaultStatus,
      priority: "MEDIUM",
      projectId: "",
      subprojectId: "",
    },
  });

  const watchProjectId = useWatch({ control, name: "projectId" });

  // Subprojects state
  const [subprojects, setSubprojects] = useState<SubprojectItem[]>([]);
  const [loadingSubprojects, setLoadingSubprojects] = useState(false);

  // Quick Add Subproject modal
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTargetProject, setQuickAddTargetProject] = useState<{ id: string; name: string } | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddContext, setQuickAddContext] = useState<"create" | "modify" | "edit">("create");

  // Modify dialog states
  const [modifyProjectId, setModifyProjectId] = useState<string>("");
  const [modifySubprojectId, setModifySubprojectId] = useState<string>("");
  const [modifyStatus, setModifyStatus] = useState<string>("TODO");
  const [modifyPriority, setModifyPriority] = useState<string>("MEDIUM");
  const [modifyAssigneeId, setModifyAssigneeId] = useState<string>("unassigned");

  // Admin edit dialog states
  const [editProjectId, setEditProjectId] = useState<string>("");
  const [editSubprojectId, setEditSubprojectId] = useState<string>("");
  const [editAssigneeId, setEditAssigneeId] = useState<string>("unassigned");
  const [editStatus, setEditStatus] = useState<string>("TODO");
  const [editPriority, setEditPriority] = useState<string>("MEDIUM");

  // coAssignees state per dialog
  const [createCoAssignees, setCreateCoAssignees] = useState<string[]>([]);
  const [modifyCoAssignees, setModifyCoAssignees] = useState<string[]>([]);
  const [editCoAssignees, setEditCoAssignees] = useState<string[]>([]);
  const [modifyDeliverables, setModifyDeliverables] = useState<string>("");
  const [editDeliverables, setEditDeliverables] = useState<string>("");

  const fetchSubprojects = async () => {
    const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
    if (!token) return;
    try {
      setLoadingSubprojects(true);
      const res = await fetch("/api/projects/subprojects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSubprojects(data);
        }
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setLoadingSubprojects(false);
    }
  };

  useEffect(() => {
    if (dialogOpen || modifyDialogOpen || adminEditDialogOpen) {
      fetchSubprojects();
    }
  }, [dialogOpen, modifyDialogOpen, adminEditDialogOpen]);

  useEffect(() => {
    if (dialogOpen) {
      reset({ title: "", status: defaultStatus, priority: "MEDIUM", projectId: "", subprojectId: "" });
      setCreateCoAssignees([]);
    }
  }, [dialogOpen, defaultStatus, reset]);

  useEffect(() => {
    if (!selectedTaskForAction) return;
    const coAssignees = Array.isArray(selectedTaskForAction.coAssignees)
      ? selectedTaskForAction.coAssignees
      : [];
    if (modifyDialogOpen) {
      setModifyCoAssignees(coAssignees);
      setModifyProjectId(selectedTaskForAction.projectId || "none");
      setModifySubprojectId(selectedTaskForAction.subprojectId || "none");
      setModifyStatus(isCompletedTask(selectedTaskForAction.status) ? "DONE" : (selectedTaskForAction.status || "TODO"));
      setModifyPriority(selectedTaskForAction.priority || "MEDIUM");
      setModifyAssigneeId(selectedTaskForAction.assigneeId || "unassigned");
      setModifyDeliverables(selectedTaskForAction.deliverables || "");
    }
    if (adminEditDialogOpen) {
      setEditCoAssignees(coAssignees);
      setEditProjectId(selectedTaskForAction.projectId || "none");
      setEditSubprojectId(selectedTaskForAction.subprojectId || "none");
      setEditAssigneeId(selectedTaskForAction.assigneeId || "unassigned");
      const initialStatus = isCompletedTask(selectedTaskForAction.status)
        ? (isManager ? "DONE" : "IN_REVIEW")
        : (selectedTaskForAction.status || "TODO");
      setEditStatus(!isManager && (initialStatus === "DONE" || initialStatus === "COMPLETED") ? "IN_REVIEW" : initialStatus);
      setEditPriority(selectedTaskForAction.priority || "MEDIUM");
      setEditDeliverables(selectedTaskForAction.deliverables || "");
    }
  }, [selectedTaskForAction?.id, modifyDialogOpen, adminEditDialogOpen]);

  // Wrap create submit to inject coAssignees
  const handleCreateSubmit = (data: TaskInput) => {
    onCreateSubmit({ ...data, coAssignees: createCoAssignees } as any);
  };

  const handleQuickAddSubproject = async () => {
    if (!quickAddTargetProject || !quickAddName.trim()) {
      toast.error("Please enter a subproject name");
      return;
    }
    setIsQuickAdding(true);
    try {
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
      const res = await fetch(`/api/projects/${quickAddTargetProject.id}/subprojects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: quickAddName.trim(),
          status: "IN_PROGRESS",
          priority: "MEDIUM",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create subproject");
      }

      const created = await res.json();
      setSubprojects((prev) => [...prev, created]);

      if (quickAddContext === "create") {
        setValue("subprojectId", created.id, { shouldDirty: true });
      } else if (quickAddContext === "modify") {
        setModifySubprojectId(created.id);
      } else if (quickAddContext === "edit") {
        setEditSubprojectId(created.id);
      }

      toast.success(`Subproject "${created.name}" created and assigned!`);
      setQuickAddName("");
      setQuickAddOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create subproject");
    } finally {
      setIsQuickAdding(false);
    }
  };

  return (
    <>
      {/* QUICK ADD SUBPROJECT MODAL */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Quick Add Subproject
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Add a new module/subproject under <strong>{quickAddTargetProject?.name || "the project"}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subproject Name *</Label>
              <Input
                placeholder="e.g. Video Editing, Color Grading, Sprint 1"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleQuickAddSubproject} disabled={isQuickAdding || !quickAddName.trim()}>
              {isQuickAdding ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create & Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADMIN ADD/CREATE DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCreateCoAssignees([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleCreateSubmit)} className="space-y-4 mt-2">
            <WriteWithAI
              context="task"
              onFill={(fields) => {
                if (fields.title) setValue("title", fields.title, { shouldDirty: true });
                if (fields.description) setValue("description", fields.description, { shouldDirty: true });
                if (fields.priority) setValue("priority", fields.priority as any, { shouldDirty: true });
                if (fields.dueDate) setValue("dueDate", fields.dueDate, { shouldDirty: true });
              }}
            />
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input {...register("title", { required: "Required" })} placeholder="Task title" />
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

            {/* Project & Subproject Selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Controller control={control} name="projectId" render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(val: string) => {
                      const pVal = val === "none" ? "" : val;
                      field.onChange(pVal);
                      setValue("subprojectId", "", { shouldDirty: true });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Subproject (Module)</Label>
                  {watchProjectId && (
                    <button
                      type="button"
                      onClick={() => {
                        const proj = (projects ?? []).find((p) => p.id === watchProjectId);
                        setQuickAddTargetProject(proj ? { id: proj.id, name: proj.name } : null);
                        setQuickAddContext("create");
                        setQuickAddOpen(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Quick Add
                    </button>
                  )}
                </div>
                <Controller control={control} name="subprojectId" render={({ field }) => {
                  const filtered = subprojects.filter((sp) => sp.projectId === watchProjectId);
                  return (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(val: string) => field.onChange(val === "none" ? "" : val)}
                      disabled={!watchProjectId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={watchProjectId ? "Select subproject" : "Select project first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General / No Subproject</SelectItem>
                        {filtered.map((sp) => (
                          <SelectItem key={sp.id} value={sp.id}>
                            ↳ {sp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Primary Assignee</Label>
              <Controller control={control} name="assigneeId" render={({ field }) => (
                <Select value={field.value || "unassigned"} onValueChange={(val: string) => field.onChange(val === "unassigned" ? "" : val)}>
                  <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            <div className="relative">
              <MultiAssigneePicker
                users={users ?? []}
                value={createCoAssignees}
                onChange={setCreateCoAssignees}
                label="Additional Assignees"
                placeholder="Select additional team members…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input {...register("startDate")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={2} placeholder="Task details..." />
            </div>
            <div className="space-y-1.5">
              <Label>Objective</Label>
              <Textarea {...register("objective")} rows={2} placeholder="Core goal or objective..." />
            </div>
            <div className="space-y-1.5">
              <Label>Requirements</Label>
              <Textarea {...register("requirements")} rows={2} placeholder="Key requirements..." />
            </div>
            <div className="space-y-1.5">
              <Label>Deliverables</Label>
              <Textarea {...register("deliverables")} rows={2} placeholder="Expected deliverables..." />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Additional notes..." />
            </div>
            <div className="space-y-1.5">
              <Label>Assignment Note <span className="text-muted-foreground text-xs">(visible to assignee)</span></Label>
              <Textarea {...register("assignmentNote" as any)} rows={2} placeholder="Reminder or instruction for the assignee…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatePending} className="font-semibold">Create Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADMIN REJECT REMARKS DIALOG */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Task Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Provide optional remarks for rejecting the task request <strong>"{selectedTaskForAction?.title}"</strong>.
            </p>
            <div className="space-y-1.5">
              <Label>Rejection Remarks</Label>
              <Textarea
                placeholder="Remarks why this is rejected..."
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={onConfirmReject} disabled={isUpdatePending} className="font-semibold">
                Confirm Rejection
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADMIN MODIFY & APPROVE DIALOG */}
      <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modify & Approve Task Request</DialogTitle>
          </DialogHeader>
          <form key={`modify-${selectedTaskForAction?.id ?? "empty"}`} onSubmit={onConfirmModify} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" defaultValue={selectedTaskForAction?.title || ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={modifyStatus} onValueChange={setModifyStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={modifyPriority} onValueChange={setModifyPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Project & Subproject */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select
                  value={modifyProjectId}
                  onValueChange={(val: string) => {
                    setModifyProjectId(val);
                    setModifySubprojectId("none");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Subproject (Module)</Label>
                  {modifyProjectId && modifyProjectId !== "none" && (
                    <button
                      type="button"
                      onClick={() => {
                        const proj = (projects ?? []).find((p) => p.id === modifyProjectId);
                        setQuickAddTargetProject(proj ? { id: proj.id, name: proj.name } : null);
                        setQuickAddContext("modify");
                        setQuickAddOpen(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Quick Add
                    </button>
                  )}
                </div>
                <Select
                  value={modifySubprojectId}
                  onValueChange={setModifySubprojectId}
                  disabled={!modifyProjectId || modifyProjectId === "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={modifyProjectId && modifyProjectId !== "none" ? "Select subproject" : "Select project first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / No Subproject</SelectItem>
                    {subprojects
                      .filter((sp) => sp.projectId === modifyProjectId)
                      .map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          ↳ {sp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hidden fields for explicit FormData delivery */}
            <input type="hidden" name="status" value={modifyStatus} />
            <input type="hidden" name="priority" value={modifyPriority} />
            <input type="hidden" name="projectId" value={modifyProjectId} />
            <input type="hidden" name="subprojectId" value={modifySubprojectId} />
            <input type="hidden" name="assigneeId" value={modifyAssigneeId} />

            <div className="space-y-1.5">
              <Label>Primary Assignee</Label>
              <Select value={modifyAssigneeId} onValueChange={setModifyAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* hidden input carries co-assignees as JSON for the native form handler */}
            <input type="hidden" name="coAssignees" value={JSON.stringify(modifyCoAssignees)} />
            <div className="relative">
              <MultiAssigneePicker
                users={users ?? []}
                value={modifyCoAssignees}
                onChange={setModifyCoAssignees}
                label="Additional Assignees"
                placeholder="Select additional team members…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" defaultValue={selectedTaskForAction?.startDate ? selectedTaskForAction.startDate.split("T")[0] : ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input name="dueDate" type="date" defaultValue={selectedTaskForAction?.dueDate ? selectedTaskForAction.dueDate.split("T")[0] : ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" rows={2} defaultValue={selectedTaskForAction?.description || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Objective</Label>
              <Textarea name="objective" rows={2} defaultValue={selectedTaskForAction?.objective || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Requirements</Label>
              <Textarea name="requirements" rows={2} defaultValue={selectedTaskForAction?.requirements || ""} />
            </div>
            {/* Work & Design Deliverables Upload Section */}
            <TaskDeliverablesUploader
              taskId={selectedTaskForAction?.id}
              initialAttachments={selectedTaskForAction?.attachments || []}
              deliverableLink={modifyDeliverables}
              onDeliverableLinkChange={setModifyDeliverables}
              onAttachmentsChange={(newAtts) => {
                if (selectedTaskForAction) {
                  selectedTaskForAction.attachments = newAtts;
                }
              }}
            />

            <div className="space-y-1.5">
              <Label>Deliverables (Notes or External Link)</Label>
              <Textarea
                name="deliverables"
                rows={2}
                value={modifyDeliverables}
                onChange={(e) => setModifyDeliverables(e.target.value)}
                placeholder="Link or details of expected deliverables..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={selectedTaskForAction?.notes || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Assignment Note <span className="text-muted-foreground text-xs">(reminder for assignee)</span></Label>
              <Textarea name="assignmentNote" rows={2} defaultValue={selectedTaskForAction?.assignmentNote || ""} placeholder="Instruction or reminder for the assignee…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModifyDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdatePending} className="font-semibold">Modify & Approve</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ADMIN EDIT EXISTING TASK DIALOG */}
      <Dialog open={adminEditDialogOpen} onOpenChange={setAdminEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form key={`edit-${selectedTaskForAction?.id ?? "empty"}`} onSubmit={onConfirmAdminEdit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" defaultValue={selectedTaskForAction?.title || ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(val: string) => {
                    if (!isManager && (val === "DONE" || val === "COMPLETED")) {
                      setEditStatus("IN_REVIEW");
                      toast.info("Completed tasks require manager approval. Selected 'Send for Review'.");
                    } else {
                      setEditStatus(val);
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.filter((c) => isManager || c.key !== "DONE").map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.key === "IN_REVIEW" && !isManager ? "Send for Review" : c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isManager && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Completed tasks require manager approval. Select "Send for Review" when finished.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hidden fields for explicit FormData delivery */}
            <input type="hidden" name="status" value={editStatus} />
            <input type="hidden" name="priority" value={editPriority} />

            {/* Project & Subproject */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select
                  value={editProjectId}
                  onValueChange={(val: string) => {
                    setEditProjectId(val);
                    setEditSubprojectId("none");
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Subproject (Module)</Label>
                  {editProjectId && editProjectId !== "none" && (
                    <button
                      type="button"
                      onClick={() => {
                        const proj = (projects ?? []).find((p) => p.id === editProjectId);
                        setQuickAddTargetProject(proj ? { id: proj.id, name: proj.name } : null);
                        setQuickAddContext("edit");
                        setQuickAddOpen(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Quick Add
                    </button>
                  )}
                </div>
                <Select
                  value={editSubprojectId}
                  onValueChange={setEditSubprojectId}
                  disabled={!editProjectId || editProjectId === "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={editProjectId && editProjectId !== "none" ? "Select subproject" : "Select project first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / No Subproject</SelectItem>
                    {subprojects
                      .filter((sp) => sp.projectId === editProjectId)
                      .map((sp) => (
                        <SelectItem key={sp.id} value={sp.id}>
                          ↳ {sp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Explicit hidden inputs for FormData retrieval */}
            <input type="hidden" name="projectId" value={editProjectId} />
            <input type="hidden" name="subprojectId" value={editSubprojectId} />
            <input type="hidden" name="assigneeId" value={editAssigneeId} />

            <div className="space-y-1.5">
              <Label>Primary Assignee</Label>
              <Select value={editAssigneeId} onValueChange={setEditAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* hidden input carries co-assignees as JSON for the native form handler */}
            <input type="hidden" name="coAssignees" value={JSON.stringify(editCoAssignees)} />
            <div className="relative">
              <MultiAssigneePicker
                users={users ?? []}
                value={editCoAssignees}
                onChange={setEditCoAssignees}
                label="Additional Assignees"
                placeholder="Select additional team members…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" defaultValue={selectedTaskForAction?.startDate ? selectedTaskForAction.startDate.split("T")[0] : ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input name="dueDate" type="date" defaultValue={selectedTaskForAction?.dueDate ? selectedTaskForAction.dueDate.split("T")[0] : ""} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" rows={2} defaultValue={selectedTaskForAction?.description || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Objective</Label>
              <Textarea name="objective" rows={2} defaultValue={selectedTaskForAction?.objective || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Requirements</Label>
              <Textarea name="requirements" rows={2} defaultValue={selectedTaskForAction?.requirements || ""} />
            </div>
            {/* Work & Design Deliverables Upload Section */}
            <TaskDeliverablesUploader
              taskId={selectedTaskForAction?.id}
              initialAttachments={selectedTaskForAction?.attachments || []}
              deliverableLink={modifyDeliverables}
              onDeliverableLinkChange={setModifyDeliverables}
              onAttachmentsChange={(newAtts) => {
                if (selectedTaskForAction) {
                  selectedTaskForAction.attachments = newAtts;
                }
              }}
            />

            <div className="space-y-1.5">
              <Label>Deliverables (Notes or External Link)</Label>
              <Textarea
                name="deliverables"
                rows={2}
                value={modifyDeliverables}
                onChange={(e) => setModifyDeliverables(e.target.value)}
                placeholder="Link or details of expected deliverables..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={selectedTaskForAction?.notes || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Assignment Note <span className="text-muted-foreground text-xs">(reminder for assignee)</span></Label>
              <Textarea name="assignmentNote" rows={2} defaultValue={selectedTaskForAction?.assignmentNote || ""} placeholder="Instruction or reminder for the assignee…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isUpdatePending} className="font-semibold">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
