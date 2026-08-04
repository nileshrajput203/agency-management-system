import { useState, useEffect } from "react";
import {
  useListProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useListClients, useListUsers, getListProjectsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import {
  Plus, FolderKanban, Trash2, Pencil, Calendar, PlayCircle, CheckCircle2, PauseCircle,
  UserCheck, UserX, Clock, User, AlertCircle, FileText, Check, X, MessageSquare
} from "lucide-react";
import { SearchBar } from "@/components/common/SearchBar";
import { cn, formatDateOnly } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/App";
import { ProjectSubprojects } from "@/components/projects/subprojects-manager";
import { ProjectDetailModal } from "@/components/projects/project-detail-modal";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Not Started", className: "bg-slate-100 text-slate-700 border-slate-200" },
  PLANNING: { label: "Planning", className: "bg-purple-100 text-purple-700 border-purple-200" },
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

const ASSIGNMENT_STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  PENDING: {
    label: "Pending Acceptance",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    icon: Clock,
  },
  ACCEPTED: {
    label: "Accepted",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    icon: UserCheck,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    icon: UserX,
  },
};

interface ProjectFormData {
  name: string;
  description?: string;
  clientId?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  assignedTo?: string;
  assignmentDescription?: string;
  coAssignees?: string[];
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.systemRole === "SUPER_ADMIN" || user?.systemRole === "ADMIN" || user?.systemRole === "MANAGER" || user?.systemRole === "ACCOUNT_MANAGER";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewProjectModalTarget, setViewProjectModalTarget] = useState<any | null>(null);

  // Rejection dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectProjectId, setRejectProjectId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState("");

  // Project Request states (Employee submit & Admin review)
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestProjectId, setRequestProjectId] = useState<string | null>(null);
  const [requestProjectName, setRequestProjectName] = useState("");
  const [requestType, setRequestType] = useState("RESOURCE_NEEDED");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Admin Request Review states
  const [adminRequestsOpen, setAdminRequestsOpen] = useState(false);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const getAuthToken = () =>
    localStorage.getItem("agency_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("agency_jwt_token") ||
    "";

  const fetchAllRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const token = getAuthToken();
      const res = await fetch("/api/projects/requests/all", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllRequests(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllRequests();
    }
  }, [isAdmin]);

  const handleOpenRequestModal = (p: Project) => {
    setRequestProjectId(p.id);
    setRequestProjectName(p.name);
    setRequestType("RESOURCE_NEEDED");
    setRequestTitle("");
    setRequestDescription("");
    setRequestModalOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!requestDescription.trim()) {
      toast.error("Please provide a description for your request");
      return;
    }
    try {
      setIsSubmittingRequest(true);
      const token = getAuthToken();
      const res = await fetch(`/api/projects/${requestProjectId}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          requestType,
          title: requestTitle || (requestType === "RESOURCE_NEEDED" ? "Resource Request" : requestType === "EXTENSION_NEEDED" ? "Deadline Extension Request" : "Modification Request"),
          description: requestDescription.trim(),
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit request");
      }
      toast.success("Request submitted for admin review!");
      setRequestModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: "APPROVED" | "REJECTED", adminNotes?: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/projects/requests/${requestId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, adminNotes })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update request");
      }
      toast.success(`Request ${status.toLowerCase()} successfully!`);
      fetchAllRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to update request");
    }
  };

  const { data: projects, isLoading } = useListProjects();
  const { data: clients } = useListClients();
  const { data: users } = useListUsers();

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project created");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setDialogOpen(false);
      },
      onError: (err: any) => toast.error(err?.message || "Failed to create project"),
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
      onError: (err: any) => toast.error(err?.message || "Failed to update project"),
    },
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        toast.success("Project deleted");
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || "Failed to delete project"),
    },
  });

  const { register, handleSubmit, control, reset } = useForm<ProjectFormData>({
    defaultValues: { name: "", description: "", status: "NOT_STARTED", priority: "MEDIUM" },
  });

  const openAdd = () => {
    reset({
      name: "",
      description: "",
      status: "NOT_STARTED",
      priority: "MEDIUM",
      clientId: "",
      startDate: "",
      dueDate: "",
      assignedTo: "",
      assignmentDescription: "",
    });
    setEditId(null);
    setDialogOpen(true);
  };

  const openEdit = (p: NonNullable<typeof projects>[number]) => {
    console.log("[Projects] Edit action triggered for project ID:", p.id, "Name:", p.name);
    const freshP = (projects ?? []).find((proj) => proj.id === p.id) || p;
    setEditId(freshP.id);
    reset({
      name: freshP.name,
      description: freshP.description ?? "",
      status: freshP.status ?? "NOT_STARTED",
      priority: freshP.priority ?? "MEDIUM",
      clientId: freshP.clientId ?? undefined,
      startDate: freshP.startDate ? freshP.startDate.split("T")[0] : undefined,
      dueDate: freshP.dueDate ? freshP.dueDate.split("T")[0] : undefined,
      assignedTo: freshP.assignedTo ?? undefined,
      assignmentDescription: freshP.assignmentDescription ?? "",
    });
    setDialogOpen(true);
    console.log("[Projects] Edit modal opened. Current editId:", freshP.id);
  };

  const onSubmit = (data: ProjectFormData) => {
    const payload: any = {
      name: data.name,
      description: data.description || null,
      status: data.status || "NOT_STARTED",
      priority: data.priority || "MEDIUM",
      clientId: data.clientId && data.clientId !== "none" && data.clientId !== "" ? data.clientId : null,
      startDate: data.startDate || null,
      dueDate: data.dueDate || null,
      assignedTo: data.assignedTo && data.assignedTo !== "none" && data.assignedTo !== "" ? data.assignedTo : null,
      assignmentDescription: data.assignmentDescription || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const handleAcceptAssignment = (p: NonNullable<typeof projects>[number]) => {
    updateMutation.mutate({
      id: p.id,
      data: { assignmentStatus: "ACCEPTED" } as any,
    });
  };

  const openRejectDialog = (p: NonNullable<typeof projects>[number]) => {
    setRejectProjectId(p.id);
    setRejectionReasonText("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectionReasonText.trim()) {
      toast.error("Rejection reason is mandatory");
      return;
    }
    if (!rejectProjectId) return;

    updateMutation.mutate(
      {
        id: rejectProjectId,
        data: {
          assignmentStatus: "REJECTED",
          rejectionReason: rejectionReasonText.trim(),
        } as any,
      },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          setRejectProjectId(null);
          setRejectionReasonText("");
        },
      }
    );
  };

  const filtered = (projects ?? []).filter((p) => {
    if (statusFilter === "ACTIVE" && (p.status === "COMPLETED" || p.status === "CANCELLED")) return false;
    if (statusFilter !== "ALL" && statusFilter !== "ACTIVE" && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchClient = p.clientName?.toLowerCase().includes(q);
      const matchAssigned = p.assignedEmployeeName?.toLowerCase().includes(q);
      if (!matchName && !matchClient && !matchAssigned) return false;
    }
    return true;
  });

  const totalNotStarted = (projects ?? []).filter((p) => p.status === "NOT_STARTED" || p.status === "PLANNING").length;
  const totalInProgress = (projects ?? []).filter((p) => p.status === "IN_PROGRESS").length;
  const totalCompleted = (projects ?? []).filter((p) => p.status === "COMPLETED").length;
  const totalLate = (projects ?? []).filter((p) => p.dueDate && p.status !== "COMPLETED" && p.status !== "CANCELLED" && new Date(p.dueDate) < new Date()).length;

  const projectStatChips = [
    { label: "Not Started / Planning", value: totalNotStarted, accent: "border-l-slate-400", icon: <FolderKanban className="h-4 w-4" /> },
    { label: "In Progress", value: totalInProgress, accent: "border-l-blue-500", icon: <PlayCircle className="h-4 w-4" /> },
    { label: "Completed", value: totalCompleted, accent: "border-l-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Late / Delayed", value: totalLate, accent: "border-l-rose-500", icon: <Clock className="h-4 w-4" /> },
  ];

  const STATUS_BORDER: Record<string, string> = {
    NOT_STARTED: "border-l-slate-400",
    PLANNING: "border-l-purple-500",
    IN_PROGRESS: "border-l-blue-500",
    UNDER_REVIEW: "border-l-amber-400",
    COMPLETED: "border-l-emerald-500",
    ON_HOLD: "border-l-orange-400",
    CANCELLED: "border-l-rose-400",
  };

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {projects?.length ?? 0} projects shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { fetchAllRequests(); setAdminRequestsOpen(true); }}
            className="gap-2 relative btn-micro-anim"
          >
            <MessageSquare className="h-4 w-4 text-primary" />
            Project Requests
            {allRequests.filter(r => r.status === "PENDING").length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                {allRequests.filter(r => r.status === "PENDING").length}
              </Badge>
            )}
          </Button>
          {isAdmin && (
            <Button onClick={openAdd} className="gap-2 btn-micro-anim" data-testid="add-project-btn">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {projectStatChips.map(({ label, value, accent, icon }) => (
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

      <div className="flex flex-wrap gap-3 items-center">
        <SearchBar
          placeholder="Search projects or assignees…"
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-48 max-w-72"
        />
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? "ACTIVE")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active Projects</SelectItem>
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
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">No projects found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || statusFilter !== "ACTIVE"
              ? "Try adjusting your search or status filter"
              : "All active projects are complete — switch to \"All Statuses\" to see archived ones"}
          </p>
          {!search && statusFilter === "ACTIVE" && isAdmin && (
            <Button onClick={openAdd} className="mt-4 gap-2 btn-micro-anim" size="sm">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const sc = STATUS_CONFIG[p.status ?? "NOT_STARTED"] ?? STATUS_CONFIG.NOT_STARTED;
            const pc = PRIORITY_CONFIG[p.priority ?? "MEDIUM"] ?? PRIORITY_CONFIG.MEDIUM;
            const borderAccent = STATUS_BORDER[p.status ?? "NOT_STARTED"] ?? "border-l-slate-400";
            const isOverdue = p.dueDate && p.status !== "COMPLETED" && p.status !== "CANCELLED" &&
              new Date(p.dueDate) < new Date();

            const isAssignedToMe = p.assignedTo === user?.id;
            const isPendingForMe = isAssignedToMe && p.assignmentStatus === "PENDING";
            const assignStatusInfo = p.assignmentStatus ? ASSIGNMENT_STATUS_CONFIG[p.assignmentStatus.toUpperCase()] : null;
            const AssignIcon = assignStatusInfo?.icon;

            return (
              <Card key={p.id} className={cn("scale-hover border-l-[3px] group flex flex-col justify-between", borderAccent)}>
                <CardContent className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold line-clamp-2 text-sm">{p.name}</p>
                        {p.clientName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.clientName}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                                  data-testid={`edit-project-${p.id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="z-50 bg-slate-900 border border-slate-800 text-slate-100 dark:bg-slate-950 dark:border-slate-850 p-3 max-w-sm whitespace-pre-wrap rounded-lg shadow-xl leading-relaxed text-xs font-normal pointer-events-none">
                                {p.description && p.description.trim() ? p.description : "No description available."}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: p.id })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 items-center">
                      <Badge variant="outline" className={sc.className + " text-[11px] border"}>{sc.label}</Badge>
                      <Badge variant="outline" className={pc.className + " text-[11px]"}>{pc.label}</Badge>
                      {assignStatusInfo && (
                        <Badge variant="outline" className={cn("text-[11px] border gap-1 items-center font-medium", assignStatusInfo.className)}>
                          {AssignIcon && <AssignIcon className="h-3 w-3" />}
                          {assignStatusInfo.label}
                        </Badge>
                      )}
                    </div>

                    {/* Assignment details section */}
                    {(p.assignedEmployeeName || p.assignedTo) && (
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground flex items-center gap-1 font-medium">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            Assigned To:
                          </span>
                          <span className="font-semibold text-foreground truncate">{p.assignedEmployeeName || "Employee"}</span>
                        </div>

                        {p.assignmentDescription && (
                          <div className="pt-1 border-t border-border/40 text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground">Note: </span>
                            {p.assignmentDescription}
                          </div>
                        )}

                        {p.assignmentStatus === "REJECTED" && p.rejectionReason && (
                          <div className="pt-1.5 border-t border-rose-200/60 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 flex items-start gap-1.5 font-medium">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <div>
                              <span>Rejection Reason: </span>
                              <span className="font-normal italic text-rose-700 dark:text-rose-300">{p.rejectionReason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(p.startDate || p.dueDate) && (
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs pt-2 border-t border-border/50",
                        isOverdue ? "text-rose-500 font-medium" : "text-muted-foreground"
                      )}>
                        <Calendar className="h-3 w-3 shrink-0" />
                        {p.startDate && <span>{formatDateOnly(p.startDate, "dd MMM")}</span>}
                        {p.startDate && p.dueDate && <span>—</span>}
                        {p.dueDate && <span>{formatDateOnly(p.dueDate, "dd MMM yyyy")}</span>}
                        {isOverdue && <span className="ml-auto bg-rose-100 text-rose-600 dark:bg-rose-950/40 px-1.5 py-0.5 rounded text-[10px] font-semibold">Overdue</span>}
                      </div>
                    )}
                  </div>

                  {/* Accept / Reject actions for assigned employee */}
                  {isPendingForMe && (
                    <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        Assignment Pending Action
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/50 gap-1 font-semibold"
                          onClick={() => handleAcceptAssignment(p)}
                          disabled={updateMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/50 gap-1 font-semibold"
                          onClick={() => openRejectDialog(p)}
                          disabled={updateMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Subprojects Section */}
                  <ProjectSubprojects projectId={p.id} isAdmin={isAdmin} />

                  {/* Progress & Completion Notes Preview */}
                  <div className="mt-3 pt-2 border-t border-border/50 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-muted-foreground uppercase">Progress</span>
                      <span className="text-primary">{p.completionPercentage ?? p.completion ?? (p.status === "COMPLETED" ? 100 : p.status === "IN_PROGRESS" ? 25 : 0)}%</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${p.completionPercentage ?? p.completion ?? (p.status === "COMPLETED" ? 100 : p.status === "IN_PROGRESS" ? 25 : 0)}%` }}
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          (p.completionPercentage ?? p.completion) === 100 || p.status === "COMPLETED" ? "bg-emerald-500" : "bg-primary"
                        )}
                      />
                    </div>
                  </div>

                  {/* Request Resources & View Monitoring Actions */}
                  <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1 text-muted-foreground hover:text-foreground h-7 px-2"
                      onClick={(e) => { e.stopPropagation(); handleOpenRequestModal(p); }}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Request
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 font-bold h-7 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={(e) => { e.stopPropagation(); setViewProjectModalTarget(p); }}
                    >
                      <Activity className="h-3.5 w-3.5" /> Monitor & Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Project" : "New Project"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input {...register("name", { required: "Required" })} placeholder="Website Redesign" data-testid="project-name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Controller
                  control={control}
                  name="clientId"
                  render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No client</SelectItem>
                        {(clients ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Assigned Employee</Label>
                <Controller
                  control={control}
                  name="assignedTo"
                  render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <SelectTrigger><SelectValue placeholder="Assign employee" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {(users ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name} ({u.systemRole})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
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
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Assignment Description / Notes for Employee</Label>
              <Textarea {...register("assignmentDescription")} rows={2} placeholder="Scope, requirements, or special instructions for the assigned employee..." />
            </div>

            <div className="space-y-1.5">
              <Label>General Description</Label>
              <Textarea {...register("description")} rows={2} placeholder="General project overview..." />
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

      {/* Mandatory Rejection Reason Modal */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5" /> Reject Project Assignment
            </DialogTitle>
            <DialogDescription>
              Please provide a clear reason for rejecting this project assignment. The project creator and administrators will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            <Label className="font-semibold">Rejection Reason <span className="text-rose-500">*</span></Label>
            <Textarea
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
              placeholder="Explain why you are unable to take on this project assignment..."
              rows={4}
              className="border-rose-200 focus:border-rose-400 focus:ring-rose-400"
            />
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={updateMutation.isPending || !rejectionReasonText.trim()}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Submit Request Modal */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Request Resource or Modification
            </DialogTitle>
            <DialogDescription>
              Submit a request for "{requestProjectName}". Nothing changes immediately until an administrator approves your request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESOURCE_NEEDED">Need Additional Resources (e.g. Designer, QA, Backend)</SelectItem>
                  <SelectItem value="EXTENSION_NEEDED">Need Deadline Extension</SelectItem>
                  <SelectItem value="CLARIFICATION_NEEDED">Need Scope / Client Clarification</SelectItem>
                  <SelectItem value="MODIFICATION_REQUESTED">Request Project Modification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Subject / Title (Optional)</Label>
              <Input
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="e.g. Need one more designer for UI components"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Details / Justification <span className="text-rose-500">*</span></Label>
              <Textarea
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                placeholder="Explain what resources or changes are required and why..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={isSubmittingRequest || !requestDescription.trim()}>
              {isSubmittingRequest ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Requests Review Dialog */}
      <Dialog open={adminRequestsOpen} onOpenChange={setAdminRequestsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Project Requests Manager
            </DialogTitle>
            <DialogDescription>
              Review resource and project modification requests submitted by team members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-3">
            {isLoadingRequests ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading project requests...</div>
            ) : allRequests.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl">
                No project requests found.
              </div>
            ) : (
              <div className="space-y-3">
                {allRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-xl border bg-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{req.title || req.requestType}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              req.status === "PENDING"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : req.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-rose-100 text-rose-700 border-rose-200"
                            )}
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Project: <strong className="text-foreground">{req.projectName}</strong> | Submitted by: <strong className="text-foreground">{req.requesterName}</strong>
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""}
                      </span>
                    </div>

                    <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap">
                      {req.description}
                    </p>

                    {req.adminNotes && (
                      <div className="text-xs text-muted-foreground bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-md border border-blue-200/50">
                        <strong>Admin Note:</strong> {req.adminNotes}
                      </div>
                    )}

                    {isAdmin && req.status === "PENDING" && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
                          onClick={() => {
                            const note = prompt("Admin note for rejection (optional):");
                            handleUpdateRequestStatus(req.id, "REJECTED", note || undefined);
                          }}
                        >
                          Reject Request
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => {
                            const note = prompt("Admin note for approval (optional):");
                            handleUpdateRequestStatus(req.id, "APPROVED", note || undefined);
                          }}
                        >
                          Approve Request
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Detail & Monitoring Modal */}
      <ProjectDetailModal
        project={viewProjectModalTarget}
        open={!!viewProjectModalTarget}
        onOpenChange={(open) => !open && setViewProjectModalTarget(null)}
        isAdmin={isAdmin}
      />
    </div>
  );
}
