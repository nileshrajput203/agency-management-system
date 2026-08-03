import { useState } from "react";
import { useListProjects, useUpdateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/SearchBar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProjectDetailModal } from "@/components/projects/project-detail-modal";
import {
  FolderKanban, Calendar, Clock, CheckCircle2, PlayCircle, ArrowRight, Check, Sparkles, Building2
} from "lucide-react";
import { cn, formatDateOnly } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200" },
  PLANNING: { label: "Planning", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200" },
  ON_HOLD: { label: "On Hold", className: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200" },
};

export default function EmployeeProjectsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Completion modal states
  const [completeProjectTarget, setCompleteProjectTarget] = useState<any | null>(null);
  const [completionNotesText, setCompletionNotesText] = useState("");

  const { data: projects, isLoading } = useListProjects();

  // Filter projects assigned to logged-in employee
  const myProjects = (projects ?? []).filter((p: any) =>
    p.assignedTo === user?.id ||
    p.assignedTo === user?.name ||
    (Array.isArray(p.teamMembers) && p.teamMembers.includes(user?.id))
  );

  const isFullAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(user?.systemRole || user?.role);
  const isDelegatedAdmin = Boolean(user?.isDelegatedAdmin);
  const userAllowedModules = Array.isArray(user?.allowedModules) ? user.allowedModules : [];

  const canManageProjects = isFullAdmin || (isDelegatedAdmin && (userAllowedModules.length === 0 || userAllowedModules.includes("projects")));

  const displayProjects = canManageProjects
    ? (projects ?? [])
    : (myProjects.length > 0 ? myProjects : (projects ?? []).filter((p: any) => p.assignedTo === user?.id || p.assignedTo === user?.name));

  const filteredProjects = displayProjects.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.clientName && p.clientName.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const updateProjectMutation = useUpdateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project updated successfully");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || "Failed to update project"),
    },
  });

  // Employee Start Project action
  const handleStartProject = (e: React.MouseEvent, p: any) => {
    e.stopPropagation();
    updateProjectMutation.mutate({
      id: p.id,
      data: {
        status: "IN_PROGRESS",
        completionPercentage: Math.max(p.completionPercentage || p.completion || 0, 25),
      } as any,
    });
  };

  // Open complete confirmation modal
  const handleOpenCompleteModal = (e: React.MouseEvent, p: any) => {
    e.stopPropagation();
    setCompleteProjectTarget(p);
    setCompletionNotesText(p.completionNotes || "");
  };

  // Confirm complete project
  const handleConfirmComplete = () => {
    if (!completeProjectTarget) return;
    if (!completionNotesText.trim()) {
      toast.error("Please provide a completion summary note.");
      return;
    }

    updateProjectMutation.mutate(
      {
        id: completeProjectTarget.id,
        data: {
          status: "COMPLETED",
          completionNotes: completionNotesText.trim(),
          completionPercentage: 100,
        } as any,
      },
      {
        onSuccess: () => {
          setCompleteProjectTarget(null);
          setCompletionNotesText("");
        },
      }
    );
  };

  // Employee Dashboard Summary Stats
  const totalAssigned = displayProjects.length;
  const totalInProgress = displayProjects.filter((p: any) => p.status === "IN_PROGRESS").length;
  const totalCompleted = displayProjects.filter((p: any) => p.status === "COMPLETED").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" /> My Assigned Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage progress, update work status, and submit project completions
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SearchBar
            placeholder="Search projects…"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {/* Employee Dashboard Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-l-4 border-l-primary border-border rounded-xl p-4 scale-hover shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Projects Assigned</p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">{totalAssigned}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <FolderKanban className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-l-4 border-l-blue-500 border-border rounded-xl p-4 scale-hover shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">{totalInProgress}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <PlayCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-card border border-l-4 border-l-emerald-500 border-border rounded-xl p-4 scale-hover shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed Projects</p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">{totalCompleted}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Project Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-36" /></CardContent></Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl p-8">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No assigned projects found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {search ? "No projects match your search query." : "You currently do not have any projects assigned."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p: any) => {
            const statusKey = p.status || "NOT_STARTED";
            const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.NOT_STARTED;
            const progressPct = p.completionPercentage ?? p.completion ?? (statusKey === "COMPLETED" ? 100 : statusKey === "IN_PROGRESS" ? 25 : 0);

            return (
              <Card
                key={p.id}
                className="scale-hover border border-border/80 hover:border-primary/50 transition-all cursor-pointer group flex flex-col justify-between"
                onClick={() => setSelectedProject(p)}
              >
                <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
                          {p.name}
                        </h3>
                        {p.clientName && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-primary shrink-0" /> {p.clientName}
                          </p>
                        )}
                      </div>
                      {/* Project Progress Badge */}
                      <Badge variant="outline" className={cn("text-[10px] uppercase font-bold shrink-0 border", statusConfig.className)}>
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    )}

                    {/* Employee Status Progress Controls */}
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-muted-foreground uppercase flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-primary" /> Status
                        </span>
                        <span className="text-primary">{progressPct}%</span>
                      </div>

                      {/* Status indicator row */}
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className={cn("flex items-center gap-1 font-medium", statusKey === "NOT_STARTED" ? "text-slate-800 dark:text-slate-200 font-bold" : "text-muted-foreground")}>
                          ○ Not Started
                        </span>
                        <span className={cn("flex items-center gap-1 font-medium", statusKey === "IN_PROGRESS" ? "text-blue-600 dark:text-blue-400 font-bold" : "text-muted-foreground")}>
                          🟡 In Progress
                        </span>
                        <span className={cn("flex items-center gap-1 font-medium", statusKey === "COMPLETED" ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground")}>
                          🟢 Completed
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          style={{ width: `${progressPct}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            progressPct === 100 ? "bg-emerald-500" : "bg-primary"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions & Footer */}
                  <div className="space-y-2 pt-3 border-t border-border/50">
                    {(statusKey === "NOT_STARTED" || statusKey === "PLANNING") && (
                      <Button
                        size="sm"
                        onClick={(e) => handleStartProject(e, p)}
                        disabled={updateProjectMutation.isPending}
                        className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Start Project
                      </Button>
                    )}

                    {statusKey === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        onClick={(e) => handleOpenCompleteModal(e, p)}
                        disabled={updateProjectMutation.isPending}
                        className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Completed
                      </Button>
                    )}

                    {statusKey === "COMPLETED" && (
                      <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Due: {p.dueDate ? formatDateOnly(p.dueDate) : "N/A"}
                      </span>
                      <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                        View Details <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Project Detail Modal */}
      <ProjectDetailModal
        project={selectedProject}
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      />

      {/* Completion Confirmation Dialog */}
      <Dialog open={!!completeProjectTarget} onOpenChange={(open) => !open && setCompleteProjectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-heading text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> Mark Project as Completed
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you have completed all deliverables for <strong>{completeProjectTarget?.name}</strong>?
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
                Summarize what was completed. This will be sent to the admin/manager.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCompleteProjectTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmComplete}
              disabled={updateProjectMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
            >
              <Check className="h-4 w-4" /> Confirm & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
