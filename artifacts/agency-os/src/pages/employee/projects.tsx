import { useState } from "react";
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useListClients,
  useListUsers,
  getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import {
  canManageModule,
  isManagerOrAdminRole,
  hasModuleAccess,
  hasExplicitModuleAccess,
} from "@/lib/permissions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/common/SearchBar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProjectDetailModal } from "@/components/projects/project-detail-modal";
import {
  FolderKanban,
  Calendar,
  Clock,
  CheckCircle2,
  PlayCircle,
  ArrowRight,
  Check,
  Sparkles,
  Building2,
  Plus,
  User,
  Users,
  Flag,
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

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  MEDIUM: { label: "Medium", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  URGENT: { label: "Urgent", className: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
};

export default function EmployeeProjectsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "assigned">("all");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Creation modal states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectData, setNewProjectData] = useState({
    name: "",
    clientId: "",
    assignedTo: "",
    priority: "MEDIUM",
    status: "NOT_STARTED",
    startDate: "",
    dueDate: "",
    description: "",
    assignmentDescription: "",
  });

  // Completion modal states
  const [completeProjectTarget, setCompleteProjectTarget] = useState<any | null>(null);
  const [completionNotesText, setCompletionNotesText] = useState("");

  const { data: projects, isLoading } = useListProjects();
  const { data: clients } = useListClients(undefined, {
    query: { enabled: Boolean(user) } as any,
  });
  const { data: users } = useListUsers({
    query: { enabled: Boolean(user) } as any,
  });

  // Permission check: managers, admins, or users granted access to projects module
  const canManageProjects = Boolean(
    isManagerOrAdminRole(user) ||
    canManageModule(user, "projects") ||
    hasModuleAccess(user?.allowedModules, "projects") ||
    hasExplicitModuleAccess(user?.allowedModules, "projects")
  );

  // Filter projects assigned to logged-in employee (primary assignee or co-assignee)
  const myProjects = (projects ?? []).filter((p: any) => {
    const isLead =
      p.assignedTo === user?.id ||
      p.assigned_to === user?.id ||
      p.assignedTo === user?.name ||
      p.assigned_to === user?.name;
    const isCoAssignee =
      (Array.isArray(p.coAssignees) && (p.coAssignees.includes(user?.id) || p.coAssignees.includes(user?.name))) ||
      (Array.isArray(p.co_assignees) && (p.co_assignees.includes(user?.id) || p.co_assignees.includes(user?.name))) ||
      (Array.isArray(p.teamMembers) && (p.teamMembers.includes(user?.id) || p.teamMembers.includes(user?.name)));
    return isLead || isCoAssignee;
  });

  const displayProjects = canManageProjects
    ? (viewFilter === "all" ? (projects ?? []) : myProjects)
    : (myProjects.length > 0
        ? myProjects
        : (projects ?? []).filter((p: any) =>
            p.assignedTo === user?.id ||
            p.assigned_to === user?.id ||
            p.assignedTo === user?.name ||
            p.assigned_to === user?.name
          ));

  const filteredProjects = displayProjects.filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      (p.clientName && p.clientName.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const createProjectMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project created successfully!");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setCreateDialogOpen(false);
        resetCreateForm();
      },
      onError: (err: any) => toast.error(err?.message || "Failed to create project"),
    },
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

  const resetCreateForm = () => {
    setNewProjectData({
      name: "",
      clientId: "",
      assignedTo: "",
      priority: "MEDIUM",
      status: "NOT_STARTED",
      startDate: "",
      dueDate: "",
      description: "",
      assignmentDescription: "",
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    createProjectMutation.mutate({
      data: {
        name: newProjectData.name.trim(),
        clientId: newProjectData.clientId && newProjectData.clientId !== "none" ? newProjectData.clientId : null,
        assignedTo: newProjectData.assignedTo && newProjectData.assignedTo !== "none" ? newProjectData.assignedTo : null,
        priority: newProjectData.priority,
        status: newProjectData.status,
        startDate: newProjectData.startDate || null,
        dueDate: newProjectData.dueDate || null,
        description: newProjectData.description.trim() || null,
        assignmentDescription: newProjectData.assignmentDescription.trim() || null,
      } as any,
    });
  };

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

    updateProjectMutation.mutate(
      {
        id: completeProjectTarget.id,
        data: {
          status: "COMPLETED",
          completionNotes: completionNotesText.trim() || "Project completed",
          completionPercentage: 100,
        } as any,
      },
      {
        onSuccess: () => {
          toast.success("🎉 Project marked as Completed!");
          setCompleteProjectTarget(null);
          setCompletionNotesText("");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to complete project");
        },
      }
    );
  };

  // Stats calculation
  const totalDisplay = displayProjects.length;
  const totalInProgress = displayProjects.filter((p: any) => p.status === "IN_PROGRESS").length;
  const totalCompleted = displayProjects.filter((p: any) => p.status === "COMPLETED").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            {canManageProjects
              ? (viewFilter === "all" ? "Projects Workspace" : "My Assigned Projects")
              : "My Assigned Projects"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canManageProjects
              ? "Oversee company projects, add new projects, assign team members, and track completions"
              : "Manage progress, update work status, and submit project completions"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageProjects && (
            <Button
              onClick={() => {
                resetCreateForm();
                setCreateDialogOpen(true);
              }}
              size="sm"
              className="gap-1.5 font-bold shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground h-9"
            >
              <Plus className="h-4 w-4" /> Add Project
            </Button>
          )}

          <div className="w-full sm:w-64">
            <SearchBar
              placeholder="Search projects…"
              value={search}
              onChange={setSearch}
            />
          </div>
        </div>
      </div>

      {/* View Switcher Tabs (for Managers / Project Permitted users) */}
      {canManageProjects && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/80 w-fit">
            <Button
              variant={viewFilter === "all" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-semibold rounded-lg",
                viewFilter === "all" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewFilter("all")}
            >
              All Projects ({projects?.length || 0})
            </Button>
            <Button
              variant={viewFilter === "assigned" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-3 text-xs font-semibold rounded-lg",
                viewFilter === "assigned" ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewFilter("assigned")}
            >
              My Assigned ({myProjects.length})
            </Button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-l-4 border-l-primary border-border rounded-xl p-4 scale-hover shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {canManageProjects && viewFilter === "all" ? "Total Projects" : "Projects Assigned"}
            </p>
            <p className="text-2xl font-bold font-heading text-foreground mt-1">{totalDisplay}</p>
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
          <h3 className="text-lg font-semibold text-foreground">
            {canManageProjects && viewFilter === "all" ? "No projects found" : "No assigned projects found"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {search
              ? "No projects match your search query."
              : canManageProjects
                ? "There are currently no projects in this view. Click below to add a new project."
                : "You currently do not have any projects assigned."}
          </p>

          {canManageProjects && (
            <Button
              onClick={() => {
                resetCreateForm();
                setCreateDialogOpen(true);
              }}
              className="mt-4 gap-1.5 font-semibold"
            >
              <Plus className="h-4 w-4" /> Create New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p: any) => {
            const statusKey = p.status || "NOT_STARTED";
            const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.NOT_STARTED;
            const priorityConfig = PRIORITY_CONFIG[p.priority || "MEDIUM"] || PRIORITY_CONFIG.MEDIUM;
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
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold border", priorityConfig.className)}>
                          {priorityConfig.label}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold border", statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    )}

                    {/* Assignee pill */}
                    {p.assignedEmployeeName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span>Assigned to: <strong className="text-foreground">{p.assignedEmployeeName}</strong></span>
                      </div>
                    )}

                    {/* Status Progress Bar */}
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-muted-foreground uppercase flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-primary" /> Progress
                        </span>
                        <span className="text-primary">{progressPct}%</span>
                      </div>

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

                    {(statusKey === "IN_PROGRESS" || (canManageProjects && statusKey !== "COMPLETED")) && (
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
        isAdmin={canManageProjects}
      />

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-heading">
              <FolderKanban className="h-5 w-5 text-primary" /> Create New Project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define project deliverables, link to a client, assign a team member, and establish timelines.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Project Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Website Redesign & Brand Launch"
                value={newProjectData.name}
                onChange={(e) => setNewProjectData({ ...newProjectData, name: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client (Optional)</Label>
                <Select
                  value={newProjectData.clientId}
                  onValueChange={(val) => setNewProjectData({ ...newProjectData, clientId: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Internal / No Client --</SelectItem>
                    {(clients ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Primary Assignee</Label>
                <Select
                  value={newProjectData.assignedTo}
                  onValueChange={(val) => setNewProjectData({ ...newProjectData, assignedTo: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Assign team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Unassigned --</SelectItem>
                    {user && (
                      <SelectItem value={user.id}>
                        Assign to Me ({user.name || user.email})
                      </SelectItem>
                    )}
                    {(users ?? [])
                      .filter((u: any) => u.id !== user?.id)
                      .map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.systemRole || u.role || "Team"})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <Select
                  value={newProjectData.priority}
                  onValueChange={(val) => setNewProjectData({ ...newProjectData, priority: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Initial Status</Label>
                <Select
                  value={newProjectData.status}
                  onValueChange={(val) => setNewProjectData({ ...newProjectData, status: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="PLANNING">Planning</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="ON_HOLD">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Start Date</Label>
                <Input
                  type="date"
                  value={newProjectData.startDate}
                  onChange={(e) => setNewProjectData({ ...newProjectData, startDate: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Due Date</Label>
                <Input
                  type="date"
                  value={newProjectData.dueDate}
                  onChange={(e) => setNewProjectData({ ...newProjectData, dueDate: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Project Scope & Description</Label>
              <Textarea
                rows={3}
                placeholder="High-level objectives, deliverables, and scope overview..."
                value={newProjectData.description}
                onChange={(e) => setNewProjectData({ ...newProjectData, description: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Instructions for Assignee (Optional)</Label>
              <Textarea
                rows={2}
                placeholder="Specific guidance, link to assets, initial action items..."
                value={newProjectData.assignmentDescription}
                onChange={(e) => setNewProjectData({ ...newProjectData, assignmentDescription: e.target.value })}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createProjectMutation.isPending || !newProjectData.name.trim()}
                className="font-bold gap-1.5"
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
