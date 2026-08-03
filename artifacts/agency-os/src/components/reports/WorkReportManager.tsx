import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Archive,
  RefreshCw,
  Eye,
  Download,
  Trash2,
  Send,
  Edit3,
  History,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Printer,
  Unlock,
  Check,
  X,
  UserCheck,
  FileCheck2,
  Building,
  Layers,
  ArrowLeft,
  Calendar,
  Mail,
  Briefcase,
  Award,
  Target,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

async function downloadWorkReportPdf(reportId: string, title?: string) {
  try {
    const token = typeof window !== "undefined" ? (localStorage.getItem("agency_token") || localStorage.getItem("token")) : null;
    toast.info("Preparing PDF...");
    const res = await fetch(`/api/work-reports/${reportId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || `Failed to download PDF (${res.status})`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    const cleanTitle = title ? title.replace(/[^a-zA-Z0-9_-]/g, "_") : `Work_Report_${reportId}`;
    link.download = `${cleanTitle}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Open object URL in new tab for instant view/print
    window.open(url, "_blank");

    toast.success("PDF downloaded successfully!");
  } catch (err: any) {
    console.error("Error downloading PDF:", err);
    toast.error(err.message || "Failed to download PDF");
  }
}

export function WorkReportManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  const token = typeof window !== "undefined" ? (localStorage.getItem("agency_token") || localStorage.getItem("token")) : null;

  // Fetch reports list
  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/work-reports"],
    queryFn: async () => {
      const res = await fetch("/api/work-reports", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch work reports");
      return res.json();
    },
  });

  // Fetch detailed report when selected
  const { data: selectedReport, refetch: refetchReport } = useQuery({
    queryKey: ["/api/work-reports", selectedReportId],
    queryFn: async () => {
      if (!selectedReportId) return null;
      const res = await fetch(`/api/work-reports/${selectedReportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch report details");
      return res.json();
    },
    enabled: !!selectedReportId,
  });

  // Role helper
  const role = String(user?.role || user?.systemRole || "").toUpperCase();
  const isManagerOrAdmin = ["ADMIN", "SUPER_ADMIN", "MANAGER", "DIRECTOR", "LEAD"].includes(role);

  // Stats calculation
  const totalReports = reports.length;
  const pendingReview = reports.filter((r: any) => r.status === "Submitted" || r.status === "Resubmitted" || r.status === "Under Review").length;
  const needsChangesCount = reports.filter((r: any) => r.status === "Needs Changes").length;
  const approvedCount = reports.filter((r: any) => r.status === "Approved").length;
  const draftCount = reports.filter((r: any) => r.status === "Draft").length;

  // Filter reports
  const filteredReports = reports.filter((r: any) => {
    const matchesSearch =
      r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.clientHandled?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "my") return r.userId === user?.id;
    if (activeTab === "pending") return ["Submitted", "Resubmitted", "Under Review"].includes(r.status);
    if (activeTab === "changes") return r.status === "Needs Changes";
    if (activeTab === "approved") return r.status === "Approved";
    if (activeTab === "archived") return r.status === "Archived";
    return r.status !== "Archived";
  });

  // Create Draft Mutation
  const createDraftMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/work-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create report draft");
      return res.json();
    },
    onSuccess: (newReport) => {
      toast.success("Work report draft created!");
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
      setSelectedReportId(newReport.id);
      setIsEditorOpen(true);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete Report Mutation (for report list cards)
  const deleteReportListMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await fetch(`/api/work-reports/${reportId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete work report");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Work report deleted.");
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Helper status badge renderer
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold px-2.5 py-0.5 text-xs">Approved</Badge>;
      case "Submitted":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold px-2.5 py-0.5 text-xs">Submitted</Badge>;
      case "Resubmitted":
        return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-semibold px-2.5 py-0.5 text-xs">Resubmitted</Badge>;
      case "Under Review":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-semibold px-2.5 py-0.5 text-xs">Under Review</Badge>;
      case "Needs Changes":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold px-2.5 py-0.5 text-xs">Needs Changes</Badge>;
      case "Archived":
        return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 font-semibold px-2.5 py-0.5 text-xs">Archived</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 font-semibold px-2.5 py-0.5 text-xs">Draft</Badge>;
    }
  };

  // IF A REPORT IS SELECTED -> RENDER FULL-PAGE VIEW
  if (selectedReportId) {
    return (
      <div className="p-4 md:p-6 w-full max-w-none">
        <WorkReportEditorView
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedReportId(null);
          }}
          reportId={selectedReportId}
          report={selectedReport}
          isManagerOrAdmin={isManagerOrAdmin}
          currentUserId={user?.id}
          onRefresh={() => {
            refetch();
            refetchReport();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 w-full max-w-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FileCheck2 className="h-8 w-8 text-primary" />
            Employee Work Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track monthly project entries, manager reviews, version history, and approval workflows.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => {
              createDraftMutation.mutate({
                title: `Work Report - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
                period: "Monthly",
                employeeName: user?.name,
                employeeDesignation: user?.role || "Team Member",
              });
            }}
            disabled={createDraftMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold px-5"
          >
            <Plus className="h-4 w-4 mr-2" /> Create Work Report
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="bg-card/60 border-border/80 shadow-xs hover:border-primary/30 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Reports</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{totalReports}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/80 shadow-xs hover:border-blue-500/30 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pending Review</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{pendingReview}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/80 shadow-xs hover:border-amber-500/30 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Needs Changes</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{needsChangesCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/80 shadow-xs hover:border-emerald-500/30 transition-all">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Approved</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/80 shadow-xs hover:border-slate-500/30 transition-all col-span-2 sm:col-span-1">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-slate-500/10 text-slate-500 shrink-0">
              <Edit3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Drafts</p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">{draftCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content & Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0 w-full">
        <div className="flex flex-col md:flex-row gap-6 items-start w-full">
          {/* Left Vertical Filter Panel */}
          <div className="w-full md:w-64 lg:w-72 shrink-0 md:sticky md:top-6 space-y-4 bg-card/60 border border-border/80 rounded-xl p-4 shadow-xs">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Filter Reports</p>
              <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1 w-full">
                <TabsTrigger
                  value="all"
                  className="w-full justify-start text-xs font-medium px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold transition-all"
                >
                  <FileText className="h-4 w-4 mr-2 shrink-0 text-muted-foreground group-data-[state=active]:text-primary" />
                  All Reports
                </TabsTrigger>
                <TabsTrigger
                  value="my"
                  className="w-full justify-start text-xs font-medium px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold transition-all"
                >
                  <UserCheck className="h-4 w-4 mr-2 shrink-0 text-muted-foreground group-data-[state=active]:text-primary" />
                  My Reports
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="w-full justify-between text-xs font-medium px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-blue-500" />
                    Pending Review
                  </span>
                  {pendingReview > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                      {pendingReview}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="changes"
                  className="w-full justify-between text-xs font-medium px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold transition-all"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    Needs Changes
                  </span>
                  {needsChangesCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {needsChangesCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="approved"
                  className="w-full justify-start text-xs font-medium px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold transition-all"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 shrink-0 text-emerald-500" />
                  Approved
                </TabsTrigger>
                <TabsTrigger
                  value="archived"
                  className="w-full justify-start text-xs font-medium px-3 py-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold transition-all"
                >
                  <Archive className="h-4 w-4 mr-2 shrink-0 text-slate-500" />
                  Archived
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="pt-3 border-t border-border/60 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block px-1">
                Search Reports
              </label>
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search reports or staff..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Report Cards Grid */}
          <div className="flex-1 w-full min-w-0">
            <TabsContent value={activeTab} className="mt-0 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading work reports...
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="text-center py-16 border rounded-xl bg-card/30">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-base font-semibold text-foreground">No reports found</p>
                  <p className="text-xs text-muted-foreground mt-1">There are no reports matching your active filter criteria.</p>
                </div>
              ) : (
                /* 2-Column Responsive Grid Layout occupying available width */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full">
                  {filteredReports.map((report: any) => (
                    <Card
                      key={report.id}
                      className="w-full border border-border/80 bg-card hover:border-primary/40 hover:shadow-md transition-all rounded-xl p-5 md:p-6 flex flex-col justify-between min-h-[280px] space-y-4"
                    >
                      <div className="space-y-3.5">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
                          <div className="space-y-1">
                            <h3 className="text-base font-bold text-foreground tracking-tight line-clamp-1">
                              {report.title}
                            </h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="font-semibold text-foreground">{report.employeeName || "Team Member"}</span>
                              <span>•</span>
                              <span>{report.employeeDesignation || "Employee"}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {renderStatusBadge(report.status)}
                            <Badge variant="outline" className="font-mono text-[11px] px-2 py-0.5 border-border">
                              v{report.currentVersion}
                            </Badge>
                          </div>
                        </div>

                        {/* Structured Summary Info Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Reporting Period</span>
                            <span className="font-semibold text-foreground text-xs block mt-0.5">{report.period || "Monthly"}</span>
                          </div>

                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Projects Logged</span>
                            <span className="font-semibold text-foreground text-xs block mt-0.5">
                              {Array.isArray(report.projects) ? report.projects.length : 0} projects
                            </span>
                          </div>

                          <div>
                            <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-bold">Clients Handled</span>
                            <span className="font-semibold text-foreground text-xs block mt-0.5 truncate">
                              {report.clientHandled || "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Contextual Notices */}
                        {report.reopenRequested && (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span className="truncate">Reopen requested: &quot;{report.reopenReason}&quot;</span>
                          </div>
                        )}

                        {report.status === "Needs Changes" && report.managerFeedback && (
                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                            <div className="line-clamp-2">
                              <strong className="font-semibold">Manager Feedback:</strong> {report.managerFeedback}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions Footer */}
                      <div className="pt-3 flex items-center justify-between gap-2 border-t border-border/40 mt-auto">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            onClick={() => {
                              setSelectedReportId(report.id);
                              setIsEditorOpen(true);
                            }}
                            size="sm"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold px-3.5 h-8 gap-1.5"
                          >
                            {["Draft", "Needs Changes"].includes(report.status) && (report.userId === user?.id || isManagerOrAdmin) ? (
                              <>
                                <Edit3 className="h-3.5 w-3.5" /> Edit Report
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" /> View Report
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadWorkReportPdf(report.id, report.title)}
                            className="text-xs font-medium px-3.5 h-8 gap-1.5 border-border hover:bg-muted"
                          >
                            <Download className="h-3.5 w-3.5 text-primary" /> Download PDF
                          </Button>
                        </div>

                        {(report.userId === user?.id || isManagerOrAdmin) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this work report?")) {
                                deleteReportListMutation.mutate(report.id);
                              }
                            }}
                            disabled={deleteReportListMutation.isPending}
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2.5 gap-1.5 ml-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

// ─── WORK REPORT FULL PAGE EDITOR / VIEW ──────────────────────────────
function WorkReportEditorView({
  onClose,
  reportId,
  report,
  isManagerOrAdmin,
  currentUserId,
  onRefresh,
}: {
  onClose: () => void;
  reportId: string;
  report: any;
  isManagerOrAdmin: boolean;
  currentUserId?: string;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const token = typeof window !== "undefined" ? (localStorage.getItem("agency_token") || localStorage.getItem("token")) : null;

  // Fetch projects list for project selection dropdown
  const { data: systemProjects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [formData, setFormData] = useState<any>({
    title: "",
    period: "Monthly",
    startDate: "",
    endDate: "",
    employeeName: "",
    employeeDesignation: "",
    clientHandled: "",
    projects: [],
    selfAssessment: "",
    summary: "",
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>("");
  const [isRequestChangesOpen, setIsRequestChangesOpen] = useState<boolean>(false);
  const [managerFeedbackInput, setManagerFeedbackInput] = useState<string>("");
  const [projectCommentsInput, setProjectCommentsInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (report) {
      const rawProjects = Array.isArray(report.projects) ? report.projects : [];
      const normalizedProjects = rawProjects.map((p: any) => ({
        id: p.id || crypto.randomUUID(),
        projectId: p.projectId ? String(p.projectId) : "none",
        projectName: p.projectName || "",
        clientName: p.clientName || "",
        taskDescription: p.taskDescription || "",
        completionPercentage: typeof p.completionPercentage === "number" ? p.completionPercentage : (Number(p.completionPercentage) || 0),
        hoursSpent: typeof p.hoursSpent === "number" ? p.hoursSpent : (Number(p.hoursSpent) || 0),
        status: p.status || "In Progress",
        managerComment: p.managerComment || "",
      }));

      setFormData({
        title: report.title || "",
        period: report.period || "Monthly",
        startDate: report.startDate || "",
        endDate: report.endDate || "",
        employeeName: report.employeeName || "",
        employeeDesignation: report.employeeDesignation || "",
        clientHandled: report.clientHandled || "",
        projects: normalizedProjects,
        selfAssessment: report.selfAssessment || "",
        summary: report.summary || "",
      });
    }
  }, [report]);

  // Save Draft Mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save draft");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Work report draft saved.");
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Submit / Resubmit Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      // First save latest form data
      await fetch(`/api/work-reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const res = await fetch(`/api/work-reports/${reportId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to submit report");
      }
      return res.json();
    },
    onSuccess: (updated) => {
      toast.success(`Report ${updated.status === "Resubmitted" ? "resubmitted" : "submitted"} successfully!`);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Mark Under Review Mutation
  const underReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-reports/${reportId}/review-status`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Report marked as Under Review");
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-reports/${reportId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to approve report");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Report approved!");
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Request Changes Mutation
  const requestChangesMutation = useMutation({
    mutationFn: async () => {
      const projectComments = Object.entries(projectCommentsInput).map(([projectId, comment]) => ({
        projectId,
        comment,
      }));

      const res = await fetch(`/api/work-reports/${reportId}/request-changes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          managerFeedback: managerFeedbackInput,
          projectComments,
        }),
      });
      if (!res.ok) throw new Error("Failed to request changes");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Changes requested from employee.");
      setIsRequestChangesOpen(false);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Request Reopen Mutation
  const requestReopenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-reports/${reportId}/request-reopen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reopenReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to request reopening");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Reopening requested. Waiting for Manager approval.");
      setIsReopenModalOpen(false);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Review Reopen Request Mutation
  const reviewReopenMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      const res = await fetch(`/api/work-reports/${reportId}/review-reopen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to review reopening request");
      return res.json();
    },
    onSuccess: (_, action) => {
      toast.success(`Reopen request ${action === "approve" ? "approved" : "rejected"}.`);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Archive / Restore Mutation
  const toggleArchiveMutation = useMutation({
    mutationFn: async (endpoint: "archive" | "restore") => {
      const res = await fetch(`/api/work-reports/${reportId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to ${endpoint} report`);
      return res.json();
    },
    onSuccess: (_, endpoint) => {
      toast.success(`Report ${endpoint === "archive" ? "archived" : "restored"}.`);
      onRefresh();
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete Draft Mutation
  const deleteDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-reports/${reportId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete draft");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Draft report deleted.");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["/api/work-reports"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!report) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading work report details...
      </div>
    );
  }

  const isOwner = report.userId === currentUserId;
  const status = report.status;
  const isEditable = isManagerOrAdmin || (isOwner && (status === "Draft" || status === "Needs Changes"));

  const totalHours = formData.projects.reduce((acc: number, p: any) => acc + (Number(p.hoursSpent) || 0), 0);
  const completedCount = formData.projects.filter((p: any) => p.status === "Completed" || Number(p.completionPercentage) === 100).length;

  const addProject = () => {
    const newProj = {
      id: crypto.randomUUID(),
      projectId: "none",
      projectName: "",
      clientName: "",
      taskDescription: "",
      completionPercentage: 0,
      hoursSpent: 0,
      status: "In Progress",
      managerComment: "",
    };
    setFormData((prev: any) => ({
      ...prev,
      projects: [...prev.projects, newProj],
    }));
  };

  const removeProject = (id: string) => {
    setFormData((prev: any) => ({
      ...prev,
      projects: prev.projects.filter((p: any) => p.id !== id),
    }));
  };

  const updateProject = (id: string, field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      projects: prev.projects.map((p: any) => (p.id === id ? { ...p, [field]: value } : p)),
    }));
  };

  const renderStatusBadge = (st: string) => {
    switch (st) {
      case "Approved":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold px-3 py-1">Approved</Badge>;
      case "Submitted":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-semibold px-3 py-1">Submitted</Badge>;
      case "Resubmitted":
        return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 font-semibold px-3 py-1">Resubmitted</Badge>;
      case "Under Review":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-semibold px-3 py-1">Under Review</Badge>;
      case "Needs Changes":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold px-3 py-1">Needs Changes</Badge>;
      case "Archived":
        return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 font-semibold px-3 py-1">Archived</Badge>;
      default:
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20 font-semibold px-3 py-1">Draft</Badge>;
    }
  };

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground pl-0 hover:bg-transparent"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Work Reports
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              {report.title}
            </h1>
            {renderStatusBadge(status)}
            <Badge variant="outline" className="text-xs font-mono">v{report.currentVersion}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-primary" />
              <strong>{report.employeeName}</strong> ({report.employeeDesignation || "Team Member"})
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Period: <strong className="text-foreground">{report.period}</strong>
            </span>
            {report.userEmail && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {report.userEmail}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            className="text-xs"
          >
            <History className="h-3.5 w-3.5 mr-1.5" /> Versions ({report.versions?.length || 1})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAuditOpen(true)}
            className="text-xs"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" /> Audit Trail
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadWorkReportPdf(reportId, report?.title)}
            title="Download PDF"
            className="text-xs bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border-purple-500/30 font-semibold"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Status Banners */}
      {status === "Submitted" && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs md:text-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500 shrink-0" />
            <span>This report has been submitted and is currently waiting for Manager review.</span>
          </div>
          {isManagerOrAdmin && (
            <Button
              size="sm"
              onClick={() => underReviewMutation.mutate()}
              disabled={underReviewMutation.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700 h-8 text-xs shrink-0"
            >
              Mark Under Review
            </Button>
          )}
        </div>
      )}

      {status === "Under Review" && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs md:text-sm flex items-center gap-2 shadow-xs">
          <Sparkles className="h-5 w-5 text-purple-500 shrink-0" />
          <span>This report is actively <strong>Under Review</strong> by Management.</span>
        </div>
      )}

      {status === "Needs Changes" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs md:text-sm space-y-1.5 shadow-xs">
          <p className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 shrink-0" /> Manager Requested Changes
          </p>
          <p className="text-xs md:text-sm pl-7 leading-relaxed">{report.managerFeedback}</p>
        </div>
      )}

      {status === "Approved" && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs md:text-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>This report has been formally approved by Management.</span>
          </div>
          {!isManagerOrAdmin && !report.reopenRequested && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsReopenModalOpen(true)}
              className="h-8 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shrink-0"
            >
              <Unlock className="h-3.5 w-3.5 mr-1.5" /> Request Reopening
            </Button>
          )}
        </div>
      )}

      {report.reopenRequested && isManagerOrAdmin && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs md:text-sm space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span><strong>Reopen Requested by Employee:</strong> &quot;{report.reopenReason}&quot;</span>
          </div>
          <div className="flex gap-2 pl-7">
            <Button
              size="sm"
              onClick={() => reviewReopenMutation.mutate("approve")}
              disabled={reviewReopenMutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700 h-8 text-xs"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Approve Reopen (Unlock Report)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reviewReopenMutation.mutate("reject")}
              disabled={reviewReopenMutation.isPending}
              className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Reject Request
            </Button>
          </div>
        </div>
      )}

      {/* 1. Report Details */}
      <Card className="border-border bg-card shadow-xs w-full">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Report Details
          </CardTitle>
          <CardDescription className="text-xs">
            Basic information regarding employee assignment and reporting timeframe.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Report Title</Label>
              <Input
                disabled={!isEditable}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-10 text-sm w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Reporting Period</Label>
              <Select
                disabled={!isEditable}
                value={formData.period}
                onValueChange={(v) => setFormData({ ...formData, period: v })}
              >
                <SelectTrigger className="h-10 text-sm w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Clients Handled</Label>
              <Input
                disabled={!isEditable}
                placeholder="e.g. Acme Corp, Tech Solutions"
                value={formData.clientHandled}
                onChange={(e) => setFormData({ ...formData, clientHandled: e.target.value })}
                className="h-10 text-sm w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Start Date</Label>
              <Input
                type="date"
                disabled={!isEditable}
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="h-10 text-sm w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">End Date</Label>
              <Input
                type="date"
                disabled={!isEditable}
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="h-10 text-sm w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Employee Designation</Label>
              <Input
                disabled={!isEditable}
                value={formData.employeeDesignation}
                onChange={(e) => setFormData({ ...formData, employeeDesignation: e.target.value })}
                className="h-10 text-sm w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Projects & Deliverables */}
      <Card className="border-border bg-card shadow-xs w-full">
        <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" /> Projects & Key Deliverables
            </CardTitle>
            <CardDescription className="text-xs">
              Log project tasks, completion percentages, client names, and time spent.
            </CardDescription>
          </div>
          {isEditable && (
            <Button size="sm" onClick={addProject} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
              <Plus className="h-4 w-4 mr-1.5" /> Add Project Entry
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {formData.projects.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground text-sm space-y-2 bg-muted/20">
              <Building className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-medium">No project entries added yet.</p>
              {isEditable && <p className="text-xs">Click &quot;Add Project Entry&quot; above to log your work deliverables.</p>}
            </div>
          ) : (
            <div className="space-y-6 w-full">
              {formData.projects.map((proj: any, idx: number) => (
                <Card key={proj.id || idx} className="p-5 border border-border bg-card/60 shadow-xs w-full space-y-4 rounded-xl">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <span className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                        {idx + 1}
                      </span>
                      Project Entry #{idx + 1}
                      {proj.projectName && <span className="text-muted-foreground font-normal">• {proj.projectName}</span>}
                    </span>
                    {isEditable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeProject(proj.id)}
                        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    )}
                  </div>

                  {proj.managerComment && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                      💬 <strong>Manager Comment:</strong> {proj.managerComment}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Select Project</Label>
                      <Select
                        disabled={!isEditable}
                        value={
                          proj.projectId && proj.projectId !== "none"
                            ? String(proj.projectId)
                            : systemProjects.find((sys: any) => sys.name?.toLowerCase() === proj.projectName?.toLowerCase())?.id
                            ? String(systemProjects.find((sys: any) => sys.name?.toLowerCase() === proj.projectName?.toLowerCase())!.id)
                            : "none"
                        }
                        onValueChange={(val: string) => {
                          if (val === "none") {
                            updateProject(proj.id, "projectId", "none");
                          } else {
                            const selectedSysProject = systemProjects.find((sys: any) => String(sys.id) === val);
                            if (selectedSysProject) {
                              setFormData((prev: any) => ({
                                ...prev,
                                projects: prev.projects.map((p: any) => {
                                  if (p.id === proj.id) {
                                    return {
                                      ...p,
                                      projectId: String(selectedSysProject.id),
                                      projectName: selectedSysProject.name || p.projectName,
                                      clientName: selectedSysProject.clientName || p.clientName || "",
                                    };
                                  }
                                  return p;
                                }),
                              }));
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 text-sm w-full">
                          <SelectValue placeholder="Select a project..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Project</SelectItem>
                          {systemProjects.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Project Name</Label>
                      <Input
                        disabled={!isEditable}
                        value={proj.projectName}
                        onChange={(e) => updateProject(proj.id, "projectName", e.target.value)}
                        placeholder="e.g. Website Redesign & SEO Campaign"
                        className="h-10 text-sm w-full"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Client Name</Label>
                      <Input
                        disabled={!isEditable}
                        value={proj.clientName}
                        onChange={(e) => updateProject(proj.id, "clientName", e.target.value)}
                        placeholder="e.g. Acme Corp"
                        className="h-10 text-sm w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tasks Executed / Accomplishments</Label>
                    <Textarea
                      disabled={!isEditable}
                      value={proj.taskDescription}
                      onChange={(e) => updateProject(proj.id, "taskDescription", e.target.value)}
                      placeholder="Detail specific tasks executed, key deliverables finished, milestones met, or active items..."
                      className="text-sm min-h-[90px] w-full leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Completion %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        disabled={!isEditable}
                        value={proj.completionPercentage}
                        onChange={(e) => updateProject(proj.id, "completionPercentage", Number(e.target.value))}
                        className="h-10 text-sm w-full"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Hours Spent</Label>
                      <Input
                        type="number"
                        min={0}
                        disabled={!isEditable}
                        value={proj.hoursSpent}
                        onChange={(e) => updateProject(proj.id, "hoursSpent", Number(e.target.value))}
                        className="h-10 text-sm w-full"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Status</Label>
                      <Select
                        disabled={!isEditable}
                        value={proj.status || "In Progress"}
                        onValueChange={(v) => updateProject(proj.id, "status", v)}
                      >
                        <SelectTrigger className="h-10 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="On Hold">On Hold</SelectItem>
                          <SelectItem value="Delayed">Delayed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Attendance & Hours Summary */}
      <Card className="border-border bg-card shadow-xs w-full">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Attendance & Hours Summary
          </CardTitle>
          <CardDescription className="text-xs">
            Summary of hours logged across all projects for this period window.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Logged Work Hours</p>
                <p className="text-2xl font-black text-primary mt-1">{totalHours} hrs</p>
              </div>
              <Clock className="h-8 w-8 text-primary/30" />
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Projects Logged</p>
                <p className="text-2xl font-black text-foreground mt-1">{formData.projects.length}</p>
              </div>
              <Building className="h-8 w-8 text-foreground/30" />
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Completed Deliverables</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Self Assessment */}
      <Card className="border-border bg-card shadow-xs w-full">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> Self Assessment & Key Achievements
          </CardTitle>
          <CardDescription className="text-xs">
            Reflect on performance, highlights, milestones reached, or key achievements.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            disabled={!isEditable}
            value={formData.selfAssessment}
            onChange={(e) => setFormData({ ...formData, selfAssessment: e.target.value })}
            placeholder="Describe key challenges overcome, skills demonstrated, major achievements, or personal reflections..."
            className="text-sm min-h-[120px] w-full leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* 5. Overall Summary & Future Goals */}
      <Card className="border-border bg-card shadow-xs w-full">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Overall Summary & Future Goals
          </CardTitle>
          <CardDescription className="text-xs">
            Outline general performance summary and key objectives for the upcoming month.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Textarea
            disabled={!isEditable}
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            placeholder="Summary of work performance and goals/targets for the next reporting period..."
            className="text-sm min-h-[120px] w-full leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* STICKY FOOTER ACTION BAR */}
      <div className="sticky bottom-0 z-30 bg-card/95 backdrop-blur border-t border-border p-4 shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-3 w-full rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Close / Back
          </Button>

          {isEditable && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteDraftMutation.mutate()}
              disabled={deleteDraftMutation.isPending}
              className="text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Draft
            </Button>
          )}

          {status === "Archived" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleArchiveMutation.mutate("restore")}
              className="text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Restore to Workspace
            </Button>
          )}

          {status !== "Archived" && isOwner && status === "Approved" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleArchiveMutation.mutate("archive")}
              className="text-xs"
            >
              <Archive className="h-3.5 w-3.5 mr-1" /> Archive Report
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadWorkReportPdf(reportId, report?.title)}
            title="Download PDF"
            className="text-xs bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border-purple-500/30 font-semibold"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" /> Download PDF
          </Button>

          {/* Manager Actions */}
          {isManagerOrAdmin && status !== "Approved" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRequestChangesOpen(true)}
                className="text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> Request Changes
              </Button>

              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Report
              </Button>
            </>
          )}

          {/* Employee Draft / Needs Changes Actions */}
          {isEditable && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending}
                className="text-xs font-medium"
              >
                Save Draft
              </Button>

              <Button
                size="sm"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {status === "Needs Changes" ? "Resubmit Report" : "Submit Report"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Version History Modal */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Version History
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every submission creates a snapshot version of the work report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
            {report.versions?.map((v: any) => (
              <div key={v.id} className="p-3 border rounded-lg bg-card/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Version #{v.versionNumber} ({v.statusAtVersion})
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{v.changeSummary}</p>
                <div className="text-[11px] text-muted-foreground/80">
                  Submitted by: {v.submittedByName}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Modal */}
      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Audit Trail & Activity Log
            </DialogTitle>
            <DialogDescription className="text-xs">
              Track who edited, date/time, status transitions, and fields modified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
            {report.auditLogs?.map((log: any) => (
              <div key={log.id} className="p-3 border rounded-lg bg-card/40 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {log.actorName} ({log.actorRole}) - <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                {log.managerComments && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Comment: {log.managerComments}
                  </p>
                )}
                {Array.isArray(log.fieldsChanged) && log.fieldsChanged.length > 0 && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5 mt-1 bg-muted/40 p-2 rounded">
                    <strong>Fields Modified:</strong>
                    {log.fieldsChanged.map((fc: any, i: number) => (
                      <div key={i}>
                        • <code>{fc.field}</code> changed from &quot;{JSON.stringify(fc.oldValue)}&quot; to &quot;{JSON.stringify(fc.newValue)}&quot;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reopen Request Modal */}
      <Dialog open={isReopenModalOpen} onOpenChange={setIsReopenModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Report Reopening</DialogTitle>
            <DialogDescription className="text-xs">
              Approved reports require manager authorization to reopen for editing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Reason for Reopening</Label>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Explain why adjustments or additional entries are needed..."
              className="text-xs min-h-[80px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsReopenModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => requestReopenMutation.mutate()}
              disabled={requestReopenMutation.isPending || !reopenReason.trim()}
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Changes Modal */}
      <Dialog open={isRequestChangesOpen} onOpenChange={setIsRequestChangesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <MessageSquare className="h-5 w-5" /> Request Changes on Report
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide feedback for the employee on what needs correction before approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Overall Feedback / Manager Remarks</Label>
              <Textarea
                value={managerFeedbackInput}
                onChange={(e) => setManagerFeedbackInput(e.target.value)}
                placeholder="e.g. Please update completion percentage for Project Acme and clarify self assessment..."
                className="text-xs min-h-[80px]"
              />
            </div>

            {formData.projects.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Project Specific Comments (Optional)</Label>
                {formData.projects.map((p: any) => (
                  <div key={p.id} className="space-y-1 p-2 border rounded bg-muted/20">
                    <span className="text-xs font-medium">{p.projectName || "Unnamed Project"}</span>
                    <Input
                      placeholder="Comment specifically on this project..."
                      value={projectCommentsInput[p.id] || ""}
                      onChange={(e) =>
                        setProjectCommentsInput({
                          ...projectCommentsInput,
                          [p.id]: e.target.value,
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsRequestChangesOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => requestChangesMutation.mutate()}
              disabled={requestChangesMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700 text-xs"
            >
              Send Feedback & Request Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

