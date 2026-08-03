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
import { COLUMNS } from "./task-constants";
import { useForm, Controller } from "react-hook-form";
import type { TaskInput } from "@workspace/api-client-react";

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
  const { register, handleSubmit, control, setValue } = useForm<TaskInput>({
    defaultValues: {
      status: defaultStatus,
      priority: "MEDIUM",
    },
  });

  return (
    <>
      {/* ADMIN ADD/CREATE DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 mt-2">
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
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Controller control={control} name="assigneeId" render={({ field }) => (
                  <Select value={field.value || "unassigned"} onValueChange={(val) => field.onChange(val === "unassigned" ? "" : val)}>
                    <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
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
          <form onSubmit={onConfirmModify} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" defaultValue={selectedTaskForAction?.title || ""} required />
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select name="assigneeId" defaultValue={selectedTaskForAction?.assigneeId || "unassigned"}>
                  <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="space-y-1.5">
              <Label>Deliverables</Label>
              <Textarea name="deliverables" rows={2} defaultValue={selectedTaskForAction?.deliverables || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={selectedTaskForAction?.notes || ""} />
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
          <form onSubmit={onConfirmAdminEdit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input name="title" defaultValue={selectedTaskForAction?.title || ""} required />
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select name="assigneeId" defaultValue={selectedTaskForAction?.assigneeId || "unassigned"}>
                  <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {(users ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="space-y-1.5">
              <Label>Deliverables</Label>
              <Textarea name="deliverables" rows={2} defaultValue={selectedTaskForAction?.deliverables || ""} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={selectedTaskForAction?.notes || ""} />
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
