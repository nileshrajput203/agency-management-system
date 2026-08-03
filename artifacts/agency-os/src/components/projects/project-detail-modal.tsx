import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ProjectSubprojects } from "@/components/projects/subprojects-manager";
import {
  FolderKanban, Calendar, Clock, CheckCircle2, PlayCircle, RotateCcw,
  User, Building2, AlertCircle, FileText, Activity, Send, Check, Sparkles
} from "lucide-react";
import { cn, formatDateOnly } from "@/lib/utils";
import { toast } from "sonner";
import { useUpdateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_CONFIG: Record<string, { label: string; className: string; color: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300", color: "gray" },
  PLANNING: { label: "Planning", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300", color: "purple" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300", color: "blue" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300", color: "amber" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300", color: "emerald" },
  ON_HOLD: { label: "On Hold", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300", color: "orange" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300", color: "rose" },
};

interface ProjectDetailModalProps {
  project: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function ProjectDetailModal({ project, open, onOpenChange, isAdmin = false }: ProjectDetailModalProps) {
  const qc = useQueryClient();
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completionNotesText, setCompletionNotesText] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");

  const updateMutation = useUpdateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || "Failed to update project"),
    },
  });

  if (!project) return null;

  const currentStatus = project.status || "NOT_STARTED";
  const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.NOT_STARTED;
  const progressPct = project.completionPercentage ?? project.completion ?? (currentStatus === "COMPLETED" ? 100 : currentStatus === "IN_PROGRESS" ? 25 : 0);
  const isOverdue = project.dueDate && currentStatus !== "COMPLETED" && currentStatus !== "CANCELLED" && new Date(project.dueDate) < new Date();

  // Handle Start Project action
  const handleStartProject = () => {
    updateMutation.mutate(
      {
        id: project.id,
        data: {
          status: "IN_PROGRESS",
          completionPercentage: Math.max(progressPct, 25),
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("Project started! Status set to In Progress.");
        },
      }
    );
  };

  // Open complete modal
  const openCompleteModal = () => {
    setCompletionNotesText(project.completionNotes || "");
    setCompleteModalOpen(true);
  };

  // Confirm complete project
  const handleConfirmComplete = () => {
    if (!completionNotesText.trim()) {
      toast.error("Please provide a brief completion summary before marking completed.");
      return;
    }

    updateMutation.mutate(
      {
        id: project.id,
        data: {
          status: "COMPLETED",
          completionNotes: completionNotesText.trim(),
          completionPercentage: 100,
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("Project marked as COMPLETED! Manager notified.");
          setCompleteModalOpen(false);
        },
      }
    );
  };

  // Admin Reopen project
  const handleReopenProject = () => {
    updateMutation.mutate(
      {
        id: project.id,
        data: {
          status: "IN_PROGRESS",
          completionPercentage: 25,
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("Project reopened and set back to In Progress.");
        },
      }
    );
  };

  // Save updated notes
  const handleSaveNotes = () => {
    if (!notesInput.trim()) return;
    updateMutation.mutate(
      {
        id: project.id,
        data: {
          completionNotes: notesInput.trim(),
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("Completion notes updated");
          setEditingNotes(false);
        },
      }
    );
  };

  const timelineEvents: any[] = Array.isArray(project.activityTimeline) && project.activityTimeline.length > 0
    ? project.activityTimeline
    : [
        {
          id: "1",
          type: "ASSIGNED",
          actorName: project.assignedEmployeeName || "Employee",
          message: `Project assigned to ${project.assignedEmployeeName || "Employee"}`,
          timestamp: project.assignmentActionAt || project.createdAt,
        },
        ...(project.startedAt ? [{
          id: "2",
          type: "STARTED",
          actorName: project.assignedEmployeeName || "Employee",
          message: "Started project work",
          timestamp: project.startedAt,
        }] : []),
        ...(project.completedAt ? [{
          id: "3",
          type: "COMPLETED",
          actorName: project.assignedEmployeeName || "Employee",
          message: "Marked project as COMPLETED",
          notes: project.completionNotes,
          timestamp: project.completedAt,
        }] : []),
      ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto space-y-6">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-6 w-6 text-primary shrink-0" />
                  <DialogTitle className="text-xl font-bold font-heading">{project.name}</DialogTitle>
                </div>
                {project.clientName && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> Client: <span className="font-medium text-foreground">{project.clientName}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn("text-xs uppercase font-bold px-3 py-1", statusConfig.className)}>
                  {statusConfig.label}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs uppercase font-bold">Overdue</Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Employee Status Controls */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Project Status & Workflow
              </Label>
              <span className="text-xs font-bold text-primary">{progressPct}% Complete</span>
            </div>

            {/* Status Option Pills */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (currentStatus !== "NOT_STARTED") {
                    updateMutation.mutate({ id: project.id, data: { status: "NOT_STARTED" } as any });
                  }
                }}
                disabled={updateMutation.isPending}
                className={cn(
                  "p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all",
                  currentStatus === "NOT_STARTED"
                    ? "bg-slate-200 border-slate-400 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-bold shadow-xs"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-slate-400" /> ○ Not Started
              </button>

              <button
                type="button"
                onClick={handleStartProject}
                disabled={updateMutation.isPending}
                className={cn(
                  "p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all",
                  currentStatus === "IN_PROGRESS"
                    ? "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 font-bold shadow-xs"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" /> 🟡 In Progress
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentStatus !== "COMPLETED") {
                    openCompleteModal();
                  }
                }}
                disabled={updateMutation.isPending}
                className={cn(
                  "p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all",
                  currentStatus === "COMPLETED"
                    ? "bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold shadow-xs"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> 🟢 Completed
              </button>
            </div>

            {/* Quick Action Bar */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {(currentStatus === "NOT_STARTED" || currentStatus === "PLANNING") && (
                <Button onClick={handleStartProject} disabled={updateMutation.isPending} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  <PlayCircle className="h-4 w-4" /> Start Project
                </Button>
              )}

              {currentStatus === "IN_PROGRESS" && (
                <Button onClick={openCompleteModal} disabled={updateMutation.isPending} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Mark as Completed
                </Button>
              )}

              {currentStatus === "COMPLETED" && (
                <div className="w-full flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Project is Completed
                  </span>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={handleReopenProject} disabled={updateMutation.isPending} className="h-7 text-xs gap-1 border-emerald-300 hover:bg-emerald-100">
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen Project
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 pt-2">
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    progressPct === 100 ? "bg-emerald-500" : progressPct > 30 ? "bg-blue-500" : "bg-amber-500"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Key Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-card border border-border">
              <p className="text-muted-foreground font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-primary" /> Assigned To
              </p>
              <p className="font-bold text-foreground mt-1 truncate">{project.assignedEmployeeName || "Unassigned"}</p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border">
              <p className="text-muted-foreground font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Due Date
              </p>
              <p className="font-bold text-foreground mt-1">{project.dueDate ? formatDateOnly(project.dueDate, "dd MMM yyyy") : "N/A"}</p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border">
              <p className="text-muted-foreground font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" /> Started On
              </p>
              <p className="font-bold text-foreground mt-1">{project.startedAt ? formatDateOnly(project.startedAt, "dd MMM yyyy") : "Not Started"}</p>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border">
              <p className="text-muted-foreground font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Completed On
              </p>
              <p className="font-bold text-foreground mt-1">{project.completedAt ? formatDateOnly(project.completedAt, "dd MMM yyyy") : "Pending"}</p>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">Project Description</Label>
              <div className="p-3 rounded-xl bg-card border border-border text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {project.description}
              </div>
            </div>
          )}

          {/* Completion Notes Section */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> Completion Notes & Deliverables Summary
              </Label>
              {!editingNotes && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-primary"
                  onClick={() => {
                    setNotesInput(project.completionNotes || "");
                    setEditingNotes(true);
                  }}
                >
                  {project.completionNotes ? "Edit Notes" : "Add Notes"}
                </Button>
              )}
            </div>

            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Summary of deliverables, links to creatives, or completion status..."
                  className="text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)} className="h-7 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateMutation.isPending} className="h-7 text-xs font-semibold">
                    Save Notes
                  </Button>
                </div>
              </div>
            ) : project.completionNotes ? (
              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {project.completionNotes}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/20 border border-dashed border-border text-xs text-muted-foreground italic">
                No completion notes entered yet.
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3 border-t border-border pt-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-primary" /> Employee Activity Timeline
            </Label>

            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {timelineEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="relative flex items-start justify-between gap-3 text-xs">
                  <span className="absolute -left-[17px] top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div>
                    <p className="font-semibold text-foreground">{evt.message || evt.type}</p>
                    {evt.actorName && (
                      <p className="text-[11px] text-muted-foreground">By {evt.actorName}</p>
                    )}
                    {evt.notes && (
                      <p className="mt-1 p-2 rounded bg-muted/40 text-[11px] italic text-foreground/90">{evt.notes}</p>
                    )}
                  </div>
                  {evt.timestamp && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDateOnly(evt.timestamp, "dd MMM yyyy, HH:mm")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Subprojects & Milestones Manager */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Subprojects & Milestones
            </h4>
            <ProjectSubprojects projectId={project.id} isAdmin={isAdmin} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation & Completion Notes Dialog */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-heading text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> Mark Project as Completed
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you have completed all tasks and deliverables for <strong>{project.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">
                Completion Summary / Notes <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                rows={3}
                value={completionNotesText}
                onChange={(e) => setCompletionNotesText(e.target.value)}
                placeholder="e.g. Completed all assigned reels. Uploaded final creatives. Delivered source files."
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Summarize what was accomplished. This will be visible to managers.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCompleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmComplete}
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
            >
              <Check className="h-4 w-4" /> Confirm & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
