import { useState, useEffect } from "react";
import { SearchBar } from "@/components/common/SearchBar";
import {
  useListContentPosts, useCreateContentPost, useUpdateContentPost, useDeleteContentPost,
  getListContentPostsQueryKey, useListClients, useListUsers,
  useCreateCalendarShare, useListCalendarShares,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { canManageModule, isManagerOrAdminRole, isSuperAdminRole } from "@/lib/permissions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, ChevronLeft, ChevronRight, Calendar, Trash2, Link2,
  Share2, Copy, Check, FileText, CheckCircle2, Clock, AlertTriangle, RotateCcw, Building2,
  Download, FileX, Sheet, Printer, Film, Zap, User, UserPlus, UserCheck,
  LayoutGrid, Image as ImageIcon, Play, Eye,
} from "lucide-react";
import { MediaLightbox, isMediaImage, isMediaVideo } from "@/components/ui/media-lightbox";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG, PLATFORM_ICON, DAYS, emptyDraft, buildShareUrl, getPostDateKey,
  PostRecord, PanelState, isPastDate, getPostAttachmentUrl, triggerFileDownload, isNeedsRevision,
} from "@/components/content/content-constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ContentShareDialog } from "@/components/content/content-share-dialog";
import { ContentPostDrawer } from "@/components/content/content-post-drawer";
import { PCApprovalStudio } from "@/components/content/pc-approval-studio";
import { esc, openPrintWindow } from "@/lib/pdf-print";

async function copyShareLink(url: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Fall through to the copy fallback for browsers that deny clipboard access.
  }
  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  return copied;
}

export default function ContentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isManagerOrAdmin = Boolean(
    isManagerOrAdminRole(user) ||
    (user as any)?.isDelegatedAdmin ||
    isSuperAdminRole((user as any)?.systemRole ?? (user as any)?.role)
  );

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeClientId, setActiveClientId] = useState<string>("");
  const [shareClientId, setShareClientId] = useState("");
  const [view, setView] = useState<"studio" | "list" | "calendar" | "grid">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("agencyos_content_view");
      if (saved === "list" || saved === "calendar" || saved === "grid") return saved;
      if (saved === "studio" && isManagerOrAdmin) return "studio";
    }
    return isManagerOrAdmin ? "studio" : "calendar";
  });

  const [lightboxState, setLightboxState] = useState<{
    open: boolean;
    items: Array<{ id?: string; url: string; filename?: string; title?: string }>;
    title?: string;
    subtitle?: string;
    post?: any;
  }>({ open: false, items: [] });

  // Strict rule: Employees with content calendar access CANNOT access Studio; only Calendar, Grid, and List
  useEffect(() => {
    if (!user) return;
    if (!isManagerOrAdmin && view === "studio") {
      setView("calendar");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("agencyos_content_view", "calendar");
      }
    }
  }, [isManagerOrAdmin, view, user]);

  const handleSetView = (newView: "studio" | "list" | "calendar" | "grid") => {
    if (newView === "studio" && !isManagerOrAdmin) {
      toast.error("Studio and content approvals are restricted to managers and administrators.");
      return;
    }
    setView(newView);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("agencyos_content_view", newView);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const [draft, setDraft] = useState(emptyDraft());
  const [newComment, setNewComment] = useState("");
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDayViewDate, setSelectedDayViewDate] = useState<string | null>(null);

  const { data: users } = useListUsers();

  const month = format(currentMonth, "yyyy-MM");
  const canViewClientDirectory = canManageModule(user, "clients");
  const { data: clientDirectory, isLoading: isLoadingClientDirectory } = useListClients(undefined, {
    query: { enabled: Boolean(user) && canViewClientDirectory } as any,
  });
  const { data: contentHistory, isLoading: isLoadingContentHistory } = useListContentPosts(undefined, {
    query: { enabled: Boolean(user) && !canViewClientDirectory } as any,
  });
  const { data: posts, isLoading } = useListContentPosts({
    clientId: activeClientId || undefined,
    month: view === "calendar" ? month : undefined,
  });
  // Use the full client list only when the account has Clients access. Content
  // users without it can still choose clients already represented in content.
  const clientHistory = [...(contentHistory ?? []), ...(posts ?? [])];
  const clientChoices = [
    ...(canViewClientDirectory ? clientDirectory ?? [] : []),
    ...clientHistory
      .filter((post: any) => post.clientId)
      .map((post: any) => ({
        id: post.clientId,
        companyName: post.clientName || "Client",
      })),
  ];
  const clients = Array.from(
    new Map(clientChoices.map((client: any) => [client.id, client])).values()
  ) as Array<{ id: string; companyName: string }>;
  const isLoadingClients = canViewClientDirectory
    ? isLoadingClientDirectory
    : Boolean(user) && isLoadingContentHistory;
  const { data: existingShares, refetch: refetchShares } = useListCalendarShares(
    shareClientId ? { clientId: shareClientId } : undefined,
    { query: { enabled: showShareModal && Boolean(shareClientId) } as any },
  );

  const shareClientName = (clients ?? []).find((c: any) => c.id === shareClientId)?.companyName || "";

  const activePost = panel.mode === "edit" && panel.post ? (posts ?? []).find(p => p.id === panel.post.id) || panel.post : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetPostId = params.get("postId") || params.get("id");
    if (targetPostId && posts && posts.length > 0) {
      const match = posts.find((p) => p.id === targetPostId);
      if (match && panel.mode === "closed") {
        openEdit(match as PostRecord);
      }
    }
  }, [posts]);

  const createMutation = useCreateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post created");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setPanel({ mode: "closed" });
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || err?.message || "Failed to create post"),
    },
  });

  const updateMutation = useUpdateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post saved");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        qc.invalidateQueries({ queryKey: ["listContentPosts"] });
      },
      onError: (err: any) => toast.error(err?.response?.data?.message || err?.message || "Failed to save"),
    },
  });

  const deleteMutation = useDeleteContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post deleted");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setPanel({ mode: "closed" });
      },
    },
  });

  const shareMutation = useCreateCalendarShare({
    mutation: {
      onSuccess: async (share) => {
        const url = buildShareUrl(share.shareToken);
        if (await copyShareLink(url)) {
          setCopiedShareId(share.id);
          toast.success("Share link copied to clipboard!");
          setTimeout(() => setCopiedShareId(null), 3000);
        } else {
          toast.error("Share link created, but automatic copying was blocked. Copy it from the link list.");
        }
        qc.invalidateQueries({ queryKey: ["listCalendarShares"] });
      },
      onError: () => toast.error("Failed to generate share link"),
    },
  });

  function openCreate(defaultDate?: string) {
    if (!isManagerOrAdmin) {
      toast.error("Only managers and administrators can create new content posts.");
      return;
    }
    if (defaultDate && isPastDate(defaultDate)) {
      toast.error("Cannot schedule content for past dates. Please select today or a future date.");
      return;
    }
    setDraft(emptyDraft(defaultDate ?? "", activeClientId));
    setNewComment("");
    setPanel({ mode: "create", defaultDate });
  }

  function openEdit(post: PostRecord) {
    const freshPost: any = (posts ?? []).find(p => p.id === post.id) || post;
    setDraft({
      title: freshPost.title ?? "",
      platform: freshPost.platform ?? "INSTAGRAM",
      contentType: freshPost.contentType ?? "POST",
      status: freshPost.status ?? "IDEA",
      caption: freshPost.caption ?? "",
      scheduledAt: freshPost.scheduledAt ?? "",
      shootDate: freshPost.shootDate ?? "",
      clientId: freshPost.clientId ?? "",
      assigneeId: freshPost.assigneeId ?? "",
      assetsLink: freshPost.assetsLink ?? "",
      format: freshPost.format ?? "",
      needsRevision: isNeedsRevision(freshPost.needsRevision),
      approvalStatus: freshPost.approvalStatus ?? "PENDING",
      rejectionNote: freshPost.rejectionNote ?? "",
      customProperties: freshPost.customProperties ?? [],
      comments: freshPost.comments ?? [],
    });
    setNewComment("");
    setPanel({ mode: "edit", post: freshPost as PostRecord });
  }

  const handleQuickAssign = (postId: string, assigneeId: string) => {
    if (!isManagerOrAdmin) {
      toast.error("Only managers and administrators can assign or unassign team members.");
      return;
    }
    const targetUser = (users ?? []).find((u: any) => u.id === assigneeId);
    const targetName = targetUser?.name || "Unassigned";
    updateMutation.mutate(
      {
        id: postId,
        data: {
          assigneeId: assigneeId === "none" || !assigneeId ? null : assigneeId,
        } as any,
      },
      {
        onSuccess: () => {
          if (assigneeId === "none" || !assigneeId) {
            toast.success("Post unassigned");
          } else {
            toast.success(`Task assigned to ${targetName}! Synced with Task Board.`);
          }
        },
      }
    );
  };

  function savePost(overridePayload?: Partial<typeof draft>) {
    const activeDraft = overridePayload ? { ...draft, ...overridePayload } : draft;

    if (activeDraft.scheduledAt && isPastDate(activeDraft.scheduledAt)) {
      if (
        panel.mode === "create" ||
        (panel.mode === "edit" && activePost && activeDraft.scheduledAt !== activePost.scheduledAt)
      ) {
        toast.error("Post Date cannot be earlier than today's date. Please select today or a future date.");
        return;
      }
    }

    if (activeDraft.shootDate && isPastDate(activeDraft.shootDate)) {
      if (
        panel.mode === "create" ||
        (panel.mode === "edit" && activePost && activeDraft.shootDate !== (activePost as any).shootDate)
      ) {
        toast.error("Shoot Date cannot be earlier than today's date. Please select today or a future date.");
        return;
      }
    }

    const payload = {
      title: activeDraft.title || undefined,
      platform: activeDraft.platform,
      contentType: activeDraft.contentType,
      status: activeDraft.status,
      caption: activeDraft.caption || undefined,
      scheduledAt: activeDraft.scheduledAt || undefined,
      shootDate: activeDraft.shootDate || undefined,
      clientId: activeDraft.clientId || null,
      assigneeId: activeDraft.assigneeId && activeDraft.assigneeId !== "none" ? activeDraft.assigneeId : null,
      assetsLink: activeDraft.assetsLink || undefined,
      format: activeDraft.format || undefined,
      needsRevision: String(activeDraft.needsRevision),
      approvalStatus: activeDraft.approvalStatus ?? "PENDING",
      customProperties: activeDraft.customProperties?.length ? activeDraft.customProperties : undefined,
      comments: activeDraft.comments?.length ? activeDraft.comments : undefined,
    };
    if (panel.mode === "create") {
      if (!isManagerOrAdmin) {
        toast.error("Only managers and administrators can create new content posts.");
        return;
      }
      createMutation.mutate({ data: payload as any });
    } else if (panel.mode === "edit" && activePost) {
      if (!isManagerOrAdmin) {
        const deliverableOnlyPayload = {
          assetsLink: activeDraft.assetsLink || undefined,
          comments: activeDraft.comments?.length ? activeDraft.comments : undefined,
        };
        updateMutation.mutate({ id: activePost.id, data: deliverableOnlyPayload as any });
        return;
      }
      updateMutation.mutate({ id: activePost.id, data: payload as any });
    }
  }

  function copyExistingShare(shareToken: string, shareId: string) {
    const url = buildShareUrl(shareToken);
    void copyShareLink(url).then((copied) => {
      if (!copied) {
        toast.error("Clipboard access was blocked. Please copy the link manually.");
        return;
      }
      setCopiedShareId(shareId);
      toast.success("Link copied!");
      setTimeout(() => setCopiedShareId(null), 3000);
    });
  }

  function openShareDialog() {
    setShareClientId(activeClientId);
    setShowShareModal(true);
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  const filteredPosts = (posts ?? []).filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.caption?.toLowerCase().includes(q) ||
      p.platform?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q) ||
      p.clientName?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q)
    );
  }).slice().sort((a, b) => {
    const aDate = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    const bDate = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDate !== bDate) return aDate - bDate;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  const postsByDay: Record<string, PostRecord[]> = {};
  filteredPosts.forEach((p) => {
    if (p.scheduledAt) {
      const dateKey = getPostDateKey(p.scheduledAt);
      if (dateKey) {
        if (!postsByDay[dateKey]) postsByDay[dateKey] = [];
        postsByDay[dateKey]!.push(p as PostRecord);
      }
    }
  });

  const selectedDayPosts = selectedDayViewDate
    ? (posts ?? [])
        .filter((p) => getPostDateKey(p.scheduledAt) === selectedDayViewDate)
        .slice()
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    : [];
  const formattedSelectedDate = selectedDayViewDate
    ? format(new Date(selectedDayViewDate + "T00:00:00"), "EEEE, dd MMMM yyyy")
    : "";

  const isPending = createMutation.isPending || updateMutation.isPending;
  const activeClient = clients?.find((c) => c.id === activeClientId);

  function printCurrentMonth() {
    const showClientColumn = !activeClientId;
    const rows = filteredPosts
      .slice()
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
      .map((post) => {
        const dateKey = post.scheduledAt ? getPostDateKey(post.scheduledAt) : null;
        const dateLabel = dateKey
          ? format(new Date(`${dateKey}T12:00:00`), "EEE, MMM d")
          : "Unscheduled";
        const statusLabel = STATUS_CONFIG[post.status ?? "IDEA"]?.label ?? post.status ?? "Idea";
        const content = [
          post.title ? `<strong>${esc(post.title)}</strong>` : "",
          post.caption ? `<div style="margin-top:4px;color:#475569">${esc(post.caption)}</div>` : "",
        ].filter(Boolean).join("");
        return `<tr>
          <td>${esc(dateLabel)}</td>
          ${showClientColumn ? `<td>${esc(post.clientName || "—")}</td>` : ""}
          <td>${esc(post.platform || "—")}</td>
          <td>${esc(post.format || post.contentType || "—")}</td>
          <td>${esc(statusLabel)}</td>
          <td>${content || "—"}</td>
        </tr>`;
      })
      .join("");
    const columnCount = showClientColumn ? 6 : 5;
    const clientLabel = showClientColumn ? "All clients" : activeClient?.companyName || "Selected client";
    const html = `<div class="page-container" style="padding:32px">
      <h1 style="font-size:24px;color:#1e1b4b">Content Calendar</h1>
      <p style="margin:8px 0 22px;color:#64748b">${esc(format(currentMonth, "MMMM yyyy"))} · ${esc(clientLabel)} · ${filteredPosts.length} post${filteredPosts.length === 1 ? "" : "s"}</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#f1f5f9;text-align:left">
          <th style="padding:9px;border:1px solid #cbd5e1">Date</th>
          ${showClientColumn ? '<th style="padding:9px;border:1px solid #cbd5e1">Client</th>' : ""}
          <th style="padding:9px;border:1px solid #cbd5e1">Platform</th>
          <th style="padding:9px;border:1px solid #cbd5e1">Format</th>
          <th style="padding:9px;border:1px solid #cbd5e1">Status</th>
          <th style="padding:9px;border:1px solid #cbd5e1">Content</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${columnCount}" style="padding:18px;border:1px solid #cbd5e1;text-align:center;color:#64748b">No posts match this month and filter.</td></tr>`}</tbody>
      </table>
    </div>`;
    openPrintWindow(html, `Content Calendar - ${format(currentMonth, "MMMM yyyy")}`);
  }

  const totalPublished   = (posts ?? []).filter((p) => p.status === "PUBLISHED").length;
  const totalScheduled   = (posts ?? []).filter((p) => p.status === "SCHEDULED").length;
  const totalNeedsRevision = (posts ?? []).filter((p) => isNeedsRevision((p as any).needsRevision) || (p as any).approvalStatus === "NEEDS_CHANGES").length;

  const contentStatChips = [
    { label: view === "calendar" ? "Posts This Month" : "Total Posts", value: posts?.length ?? 0,  accent: "border-l-primary",     icon: <FileText className="h-4 w-4" /> },
    { label: "Published",        value: totalPublished,       accent: "border-l-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Scheduled",        value: totalScheduled,       accent: "border-l-blue-500",    icon: <Clock className="h-4 w-4" /> },
    { label: "Needs Revision",   value: totalNeedsRevision,   accent: totalNeedsRevision > 0 ? "border-l-amber-400" : "border-l-slate-300", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  return (
    <div className={cn("animated-fade-in", (view === "studio" && isManagerOrAdmin) ? "p-2 sm:p-3 space-y-2 h-[calc(100vh-68px)] flex flex-col" : "p-6 space-y-6")}>
      {/* Header */}
      {(view === "studio" && isManagerOrAdmin) ? (
        <div className="flex items-center justify-between flex-wrap gap-2 shrink-0 px-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold font-heading flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              <span>PC Approval & Production Studio</span>
            </h1>
            <Badge variant="outline" className="text-xs bg-muted/50">
              {activeClientId ? activeClient?.companyName : "All Clients"} • {posts?.length ?? 0} Posts
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => handleSetView("studio")}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground shadow-xs flex items-center gap-1.5"
              >
                <Film className="h-3.5 w-3.5" /> Studio
              </button>
              <button
                onClick={() => handleSetView("calendar")}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >Calendar</button>
              <button
                onClick={() => handleSetView("grid")}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <LayoutGrid className="h-3 w-3" /> Grid
              </button>
              <button
                onClick={() => handleSetView("list")}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >List</button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={openShareDialog}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Calendar
            </Button>
            {isManagerOrAdmin && (
              <Button onClick={() => openCreate()} size="sm" className="h-8 gap-1.5 text-xs btn-micro-anim">
                <Plus className="h-3.5 w-3.5" /> Add Post
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div>
            <h1 className="text-2xl font-bold font-heading">Content Calendar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeClientId ? `${activeClient?.companyName} — ` : ""}{posts?.length ?? 0} {view === "calendar" ? "posts this month" : "posts in pipeline"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <SearchBar placeholder="Search posts…" value={searchQuery} onChange={setSearchQuery} />
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {isManagerOrAdmin && (
                <button
                  onClick={() => handleSetView("studio")}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Film className="h-3.5 w-3.5" /> Studio
                </button>
              )}
              <button
                onClick={() => handleSetView("calendar")}
                className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", view === "calendar" ? "bg-card shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >Calendar</button>
              <button
                onClick={() => handleSetView("grid")}
                className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1", view === "grid" ? "bg-card shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="h-3 w-3" /> Grid Preview
              </button>
              <button
                onClick={() => handleSetView("list")}
                className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", view === "list" ? "bg-card shadow-xs text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >List</button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={openShareDialog}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Calendar
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={printCurrentMonth}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            {isManagerOrAdmin && (
              <Button onClick={() => openCreate()} size="sm" className="h-8 gap-1.5 text-xs btn-micro-anim">
                <Plus className="h-3.5 w-3.5" /> Add Post
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (view === "studio" && isManagerOrAdmin) ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <PCApprovalStudio
            posts={(posts ?? []) as PostRecord[]}
            clients={clients}
            users={(users ?? []) as any[]}
            onRefresh={() => qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() })}
            onOpenEdit={(post) => openEdit(post)}
          />
        </div>
      ) : (
        <>
          {/* Stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {contentStatChips.map(({ label, value, accent, icon }) => (
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

          {/* Existing share links for this client */}
          {activeClientId && existingShares && existingShares.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {existingShares.map((share) => (
                <div key={share.id} className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5">
                  <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{share.label}</span>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => copyExistingShare(share.shareToken, share.id)}
                  >
                    {copiedShareId === share.id
                      ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Client Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            {/* Month nav on the left */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1.5 shrink-0 mr-2">
              <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-0.5 hover:text-primary">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold min-w-28 text-center">{format(currentMonth, "MMMM yyyy")}</span>
              <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-0.5 hover:text-primary">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveClientId("")}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                  activeClientId === ""
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                All Clients
              </button>
              {(clients ?? []).map((client) => (
                <button
                  key={client.id}
                  onClick={() => setActiveClientId(client.id)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap",
                    activeClientId === client.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {client.companyName}
                </button>
              ))}
            </div>
          </div>

          {view === "list" ? (
        <div className="space-y-2">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{searchQuery ? "No matching posts" : "No posts this month"}</p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? `No posts match "${searchQuery}"`
                  : activeClientId
                  ? `No content for ${activeClient?.companyName} yet — click "Add Post" to get started`
                  : `Click "Add Post" or a calendar date to get started`}
              </p>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const sc = STATUS_CONFIG[post.status ?? "IDEA"] ?? STATUS_CONFIG.IDEA;
              const fileUrl = getPostAttachmentUrl(post);
              return (
                <div
                  key={post.id}
                  className="flex items-start justify-between gap-3 bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => openEdit(post as PostRecord)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5 shrink-0">{PLATFORM_ICON[post.platform ?? "INSTAGRAM"]}</div>
                    <div className="flex-1 min-w-0">
                      {post.title && <p className="text-sm font-semibold truncate">{post.title}</p>}
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <Badge variant="outline" className="text-[11px]">{post.contentType}</Badge>
                        <Badge variant="secondary" className={cn("text-[11px]", sc.className)}>{sc.label}</Badge>
                        {post.scheduledAt && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(post.scheduledAt), "dd MMM, EEE")}
                          </span>
                        )}
                        {!activeClientId && (post as any).clientName && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{(post as any).clientName}</span>
                        )}
                        {(isNeedsRevision((post as any).needsRevision) || (post as any).approvalStatus === "NEEDS_CHANGES") && (
                          <Badge className="text-[11px] bg-amber-500 text-white font-semibold border-amber-600 shadow-2xs">
                            <RotateCcw className="h-3 w-3 mr-1" />Client Revision Requested
                          </Badge>
                        )}
                        {((post as any).format === "CLIENT_IDEA" || (post as any).status === "IDEA") && (
                          <Badge variant="outline" className="text-[11px] text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 font-medium">
                            <Building2 className="h-3 w-3 mr-1" />Client Idea
                          </Badge>
                        )}
                      </div>
                      {post.caption && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{post.caption}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Fast Assign Task to Assignee */}
                    {isManagerOrAdmin ? (
                      <div className="flex items-center gap-1">
                        <Select
                          value={(post as any).assigneeId || "none"}
                          onValueChange={(val) => handleQuickAssign(post.id, val)}
                        >
                          <SelectTrigger className="h-7 text-xs px-2.5 bg-muted/50 border border-primary/20 hover:border-primary rounded-lg font-medium gap-1 min-w-[130px]">
                            <User className="h-3 w-3 text-primary shrink-0" />
                            <SelectValue placeholder="Assign task…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Unassigned --</SelectItem>
                            {(users ?? []).map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name} ({u.systemRole || u.role || "Team"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/50">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">
                          {(users ?? []).find((u: any) => u.id === (post as any).assigneeId)?.name || "Unassigned"}
                        </span>
                      </div>
                    )}

                    {fileUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => triggerFileDownload(fileUrl, post.title || "content-media")}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 italic">
                        <FileX className="h-3 w-3" />
                        No File
                      </span>
                    )}
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: post.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : view === "grid" ? (
        /* Visual Feed / Media Grid Preview */
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-muted/30 border border-border/60 rounded-xl">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Visual Grid Preview</span>
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                {filteredPosts.length} {filteredPosts.length === 1 ? "Post" : "Posts"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span>Click any tile to inspect artwork in full resolution</span>
            </div>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card border border-dashed rounded-2xl">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
              <p className="font-semibold text-base">{searchQuery ? "No matching posts" : "No content scheduled"}</p>
              <p className="text-sm mt-1 text-muted-foreground max-w-sm mx-auto">
                {searchQuery
                  ? `No posts match "${searchQuery}"`
                  : activeClientId
                  ? `No posts with visual assets found for ${activeClient?.companyName}. Click "Add Post" to start scheduling.`
                  : `Click "Add Post" to schedule and attach artwork to your content calendar.`}
              </p>
              {isManagerOrAdmin && (
                <Button onClick={() => openCreate()} size="sm" className="mt-4 gap-1.5 text-xs font-semibold">
                  <Plus className="h-3.5 w-3.5" /> Add Post & Upload Artwork
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredPosts.map((post) => {
                const sc = STATUS_CONFIG[post.status ?? "IDEA"] ?? STATUS_CONFIG.IDEA;
                const pFileUrl = getPostAttachmentUrl(post);
                const hasImage = pFileUrl ? isMediaImage(pFileUrl) : false;
                const hasVideo = pFileUrl ? isMediaVideo(pFileUrl) : false;
                const isRevision = isNeedsRevision((post as any).needsRevision) || (post as any).approvalStatus === "NEEDS_CHANGES";
                const postClient = (clients ?? []).find((c: any) => c.id === post.clientId);

                return (
                  <div
                    key={post.id}
                    onClick={() => {
                      if (pFileUrl) {
                        setLightboxState({
                          open: true,
                          items: [{
                            url: pFileUrl,
                            title: post.title || post.caption || "Content Deliverable",
                            filename: post.title || "artwork",
                          }],
                          title: post.title || post.caption?.slice(0, 30) || "Content Artwork",
                          subtitle: `${postClient?.companyName || "Client"} • ${post.platform || "Instagram"} • ${sc.label}`,
                          post,
                        });
                      } else {
                        openEdit(post as PostRecord);
                      }
                    }}
                    className="group relative aspect-square rounded-2xl overflow-hidden bg-card border border-border/80 hover:border-primary transition-all duration-200 shadow-2xs hover:shadow-lg cursor-pointer flex flex-col justify-between"
                  >
                    {/* Media Background */}
                    {hasImage ? (
                      <img
                        src={pFileUrl!}
                        alt={post.title || "Artwork"}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : hasVideo ? (
                      <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                        <video src={pFileUrl!} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="h-5 w-5 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Non-media fallback card */
                      <div className="absolute inset-0 p-3.5 flex flex-col justify-between bg-gradient-to-br from-primary/5 via-card to-muted/40 select-none">
                        <div className="flex items-center justify-between">
                          <div className="p-1.5 rounded-lg bg-background/80 shadow-2xs border border-border/60">
                            {PLATFORM_ICON[post.platform ?? "INSTAGRAM"]}
                          </div>
                          <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                            {post.contentType || "Post"}
                          </span>
                        </div>
                        <div className="my-auto px-1 text-center">
                          <p className="text-xs font-semibold text-foreground line-clamp-3 leading-snug">
                            {post.title || post.caption || "Draft Idea"}
                          </p>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-2 border-t border-border/40">
                          <span>{post.scheduledAt ? format(new Date(post.scheduledAt), "dd MMM") : "Draft"}</span>
                          <span className="text-primary font-medium group-hover:underline">Edit ➔</span>
                        </div>
                      </div>
                    )}

                    {/* Floating Permanent Header Badges */}
                    <div className="relative z-10 p-2.5 flex items-center justify-between gap-1 pointer-events-none">
                      <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 shadow-xs">
                        {PLATFORM_ICON[post.platform ?? "INSTAGRAM"]}
                        <span className="capitalize">{post.contentType || "Post"}</span>
                      </span>

                      {isRevision ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-amber-500 text-white font-bold border-0 shadow-sm">
                          Revisions
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 font-bold border-0 shadow-sm backdrop-blur-md", sc.className)}>
                          {sc.label}
                        </Badge>
                      )}
                    </div>

                    {/* Hover Dark Overlay with Quick Actions & Details */}
                    <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between text-white">
                      <div className="flex items-center justify-between gap-1">
                        {postClient && (
                          <span className="text-[10px] font-semibold bg-black/50 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                            {postClient.companyName}
                          </span>
                        )}
                        {pFileUrl && (
                          <button
                            type="button"
                            title="Download artwork"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerFileDownload(pFileUrl, post.title || "artwork");
                            }}
                            className="h-6 w-6 rounded-full bg-white/20 hover:bg-white text-white hover:text-black flex items-center justify-center transition-colors ml-auto"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="font-bold text-xs leading-tight line-clamp-2">
                          {post.title || post.caption?.slice(0, 40) || "Untitled Post"}
                        </p>
                        {post.scheduledAt && (
                          <p className="text-[10px] text-white/80 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-primary" />
                            {format(new Date(post.scheduledAt), "EEE, dd MMM yyyy")}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 pt-1">
                          {pFileUrl && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-primary/90 text-primary-foreground font-semibold px-2 py-0.5 rounded shadow-xs">
                              <Eye className="h-2.5 w-2.5" /> Full Zoom
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(post as PostRecord);
                            }}
                            className="text-[10px] text-white/90 underline hover:text-white ml-auto font-medium"
                          >
                            Edit Post
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Calendar Grid */
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-28 border-b border-r border-border bg-muted/10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day), "yyyy-MM-dd");
              const dayPosts = postsByDay[dateStr] ?? [];
              const hasPosts = dayPosts.length > 0;
              return (
                <div
                  key={day}
                  className={cn(
                    "min-h-28 border-b border-r border-border p-1.5 cursor-pointer transition-colors group relative flex flex-col justify-between",
                    hasPosts ? "hover:bg-primary/5" : "hover:bg-muted/30"
                  )}
                  onClick={() => {
                    if (hasPosts) {
                      setSelectedDayViewDate(dateStr);
                    } else if (isManagerOrAdmin) {
                      openCreate(dateStr);
                    }
                  }}
                  title={hasPosts ? `Click date to view all ${dayPosts.length} posts for this day` : isManagerOrAdmin ? "Click to schedule post" : ""}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasPosts) {
                              setSelectedDayViewDate(dateStr);
                            } else if (isManagerOrAdmin) {
                              openCreate(dateStr);
                            }
                          }}
                          className={cn(
                            "text-xs font-bold px-1 py-0.5 rounded hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer",
                            hasPosts ? "text-foreground font-extrabold" : "text-muted-foreground"
                          )}
                          title={hasPosts ? `View all ${dayPosts.length} posts for ${dateStr}` : isManagerOrAdmin ? "Schedule new post" : ""}
                        >
                          {day}
                        </button>
                        {hasPosts && (
                          <button
                            type="button"
                            title={`View all ${dayPosts.length} posts for this day`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDayViewDate(dateStr);
                            }}
                            className="text-[9px] px-1.5 py-0 rounded-full font-bold bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground transition-colors cursor-pointer shadow-2xs"
                          >
                            {dayPosts.length}
                          </button>
                        )}
                      </div>
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          title="Schedule new post for this day"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreate(dateStr);
                          }}
                          className="h-4 w-4 rounded flex items-center justify-center hover:bg-primary/20 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayPosts.slice(0, 3).map((p) => {
                        const isRevision = isNeedsRevision((p as any).needsRevision) || (p as any).approvalStatus === "NEEDS_CHANGES";
                        const pFileUrl = getPostAttachmentUrl(p);
                        const postAssigneeId = (p as any).assigneeId;
                        const assignedUser = (users ?? []).find((u: any) => u.id === postAssigneeId);
                        const assigneeInitials = assignedUser?.name
                          ? assignedUser.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                          : "";
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              "h-6 flex items-center gap-1.5 text-[10px] rounded-md px-1.5 py-0 truncate cursor-pointer transition-colors border group/item",
                              isRevision
                                ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 font-semibold"
                                : "bg-primary/10 border-primary/20 hover:bg-primary/20"
                            )}
                            onClick={(e) => { e.stopPropagation(); openEdit(p as PostRecord); }}
                          >
                            {isRevision ? <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" /> : PLATFORM_ICON[p.platform ?? "INSTAGRAM"]}
                            {pFileUrl && isMediaImage(pFileUrl) && (
                              <img
                                src={pFileUrl}
                                alt="thumb"
                                className="h-3.5 w-3.5 rounded object-cover border border-primary/40 shrink-0 hover:scale-125 transition-transform shadow-2xs"
                                loading="lazy"
                                title="Click to view artwork"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxState({
                                    open: true,
                                    items: [{ url: pFileUrl, title: p.title || p.caption || "Post Media", filename: p.title || "artwork" }],
                                    title: p.title || "Content Artwork",
                                    subtitle: `${p.platform || "Instagram"} • ${p.contentType || "Post"}`,
                                    post: p,
                                  });
                                }}
                              />
                            )}
                            <span className="truncate flex-1 min-w-0 font-medium leading-none">{p.title ?? p.caption?.slice(0, 20) ?? p.contentType}</span>

                            {/* Assignee Indicator: Only managers/admins can reassign */}
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0 relative flex items-center">
                              {isManagerOrAdmin ? (
                                assignedUser ? (
                                  <div
                                    title={`Assigned to: ${assignedUser.name} (Click to reassign)`}
                                    className="h-4 min-w-4 px-1 rounded-full bg-primary/20 hover:bg-primary/30 text-primary font-bold text-[9px] flex items-center justify-center shrink-0 border border-primary/30 relative cursor-pointer"
                                  >
                                    <span>{assigneeInitials}</span>
                                    <select
                                      value={(p as any).assigneeId || "none"}
                                      onChange={(e) => handleQuickAssign(p.id, e.target.value)}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      title={`Assigned to: ${assignedUser.name} (Click to reassign)`}
                                    >
                                      <option value="none">-- Unassigned --</option>
                                      {(users ?? []).map((u: any) => (
                                        <option key={u.id} value={u.id}>
                                          {u.name} ({u.systemRole || u.role || "Team"})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div
                                    title="Click to assign team member"
                                    className="h-4 w-4 rounded-full bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center opacity-0 group-hover/item:opacity-100 relative cursor-pointer transition-opacity"
                                  >
                                    <UserPlus className="h-2.5 w-2.5" />
                                    <select
                                      value="none"
                                      onChange={(e) => handleQuickAssign(p.id, e.target.value)}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      title="Assign team member"
                                    >
                                      <option value="none">-- Assign team member --</option>
                                      {(users ?? []).map((u: any) => (
                                        <option key={u.id} value={u.id}>
                                          {u.name} ({u.systemRole || u.role || "Team"})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )
                              ) : (
                                assignedUser ? (
                                  <div
                                    title={`Assigned to: ${assignedUser.name}`}
                                    className="h-4 min-w-4 px-1 rounded-full bg-primary/20 text-primary font-bold text-[9px] flex items-center justify-center shrink-0 border border-primary/30 pointer-events-none select-none"
                                  >
                                    <span>{assigneeInitials}</span>
                                  </div>
                                ) : null
                              )}
                            </div>

                            {pFileUrl && (
                              <button
                                type="button"
                                title="Download deliverable file"
                                className="h-4 w-4 rounded flex items-center justify-center text-primary/80 hover:text-primary hover:bg-primary/20 transition-colors shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerFileDownload(pFileUrl, p.title || "content-media");
                                }}
                              >
                                <Download className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayViewDate(dateStr);
                          }}
                          className="w-full text-left flex items-center justify-between text-[10px] font-bold text-primary hover:text-primary-foreground hover:bg-primary bg-primary/15 border border-primary/30 px-2 py-1 rounded-md transition-all cursor-pointer group/more shadow-2xs mt-1"
                          title={`Click to view all ${dayPosts.length} posts for this day`}
                        >
                          <span>+{dayPosts.length - 3} more</span>
                          <span className="text-[9px] font-bold underline group-hover/more:text-primary-foreground">
                            View all ({dayPosts.length})
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* Slide-over Panel */}
      <ContentPostDrawer
        panel={panel}
        setPanel={setPanel}
        draft={draft}
        setDraft={setDraft}
        activePost={activePost as PostRecord | null}
        activeClient={activeClient}
        clients={clients}
        clientsLoading={isLoadingClients}
        users={(users ?? []) as any[]}
        isPending={isPending}
        savePost={savePost}
        deleteMutation={deleteMutation}
        newComment={newComment}
        setNewComment={setNewComment}
      />

      {/* Share Calendar Management Modal */}
      <ContentShareDialog
        open={showShareModal}
        onOpenChange={setShowShareModal}
        clientId={shareClientId}
        onClientIdChange={setShareClientId}
        clients={clients ?? []}
        clientsLoading={isLoadingClients}
        clientName={shareClientName}
        existingShares={existingShares}
        shareMutation={shareMutation}
        refetchShares={refetchShares}
      />

      {/* Day Posts View Dialog */}
      <Dialog open={!!selectedDayViewDate} onOpenChange={(open) => !open && setSelectedDayViewDate(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <DialogTitle className="text-base font-bold">
                  {formattedSelectedDate}
                </DialogTitle>
              </div>
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5 font-semibold bg-primary/10 text-primary border border-primary/20">
                {selectedDayPosts.length} {selectedDayPosts.length === 1 ? "Post" : "Posts"} Scheduled
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Review all posts scheduled for this day. Click any post to edit copy, assets, reassign, or update status.
            </DialogDescription>
          </DialogHeader>

          {/* Posts List */}
          <div className="space-y-2.5 my-2">
            {selectedDayPosts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No posts scheduled for this day</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click below to schedule a new post.</p>
              </div>
            ) : (
              selectedDayPosts.map((post) => {
                const isRevision = isNeedsRevision((post as any).needsRevision) || (post as any).approvalStatus === "NEEDS_CHANGES";
                const pFileUrl = getPostAttachmentUrl(post);
                const postAssigneeId = (post as any).assigneeId;
                const assignedUser = (users ?? []).find((u: any) => u.id === postAssigneeId);
                const postClient = (clients ?? []).find((c: any) => c.id === post.clientId);
                const statusCfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;

                return (
                  <div
                    key={post.id}
                    onClick={() => {
                      setSelectedDayViewDate(null);
                      openEdit(post as PostRecord);
                    }}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm group flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                      isRevision
                        ? "bg-amber-50/70 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800"
                        : "bg-card border-border/80 hover:border-primary/50"
                    )}
                  >
                    {/* Left: Artwork Thumbnail / Platform Icon + Title + Client + Caption preview */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {pFileUrl && isMediaImage(pFileUrl) ? (
                        <div
                          className="h-12 w-12 rounded-lg overflow-hidden border border-border/70 shrink-0 bg-muted/40 cursor-pointer hover:border-primary transition-all group/item-thumb shadow-2xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxState({
                              open: true,
                              items: [{ url: pFileUrl, title: post.title || post.caption || "Post Media", filename: post.title || "artwork" }],
                              title: post.title || "Content Artwork",
                              subtitle: `${postClient?.companyName || ""} • ${post.platform || "Instagram"}`,
                              post,
                            });
                          }}
                          title="Click to inspect artwork"
                        >
                          <img src={pFileUrl} alt="Artwork" className="w-full h-full object-cover group-hover/item-thumb:scale-105 transition-transform" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0 text-primary mt-0.5">
                          {isRevision ? (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          ) : (
                            PLATFORM_ICON[post.platform ?? "INSTAGRAM"]
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                            {post.title || post.caption?.slice(0, 40) || "Untitled Post"}
                          </span>
                          <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                            {post.contentType || "Post"}
                          </Badge>
                          {isRevision ? (
                            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                              Needs Changes
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className={cn("text-[10px] capitalize px-1.5 py-0 font-medium", statusCfg.className)}>
                              {statusCfg.label}
                            </Badge>
                          )}
                        </div>

                        {/* Client & Caption snippet */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                          {postClient && (
                            <span className="font-medium text-foreground/80 flex items-center gap-1 shrink-0">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {postClient.companyName}
                            </span>
                          )}
                          {post.caption && (
                            <span className="truncate italic text-[11px] opacity-80">
                              "{post.caption.slice(0, 60)}{post.caption.length > 60 ? "…" : ""}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Assignee Select + Download + Open button */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                      {/* Assignee select: Only manager/admin can change */}
                      {isManagerOrAdmin ? (
                        <Select
                          value={(post as any).assigneeId || "none"}
                          onValueChange={(val) => handleQuickAssign(post.id, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[140px] bg-background/80">
                            <User className="h-3 w-3 mr-1 text-muted-foreground" />
                            <SelectValue placeholder="Assignee" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Unassigned --</SelectItem>
                            {(users ?? []).map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name} ({u.systemRole || u.role || "Team"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/50">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">
                            {(users ?? []).find((u: any) => u.id === (post as any).assigneeId)?.name || "Unassigned"}
                          </span>
                        </div>
                      )}

                      {/* Download attachment */}
                      {pFileUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1 text-primary hover:bg-primary/10 border-primary/30"
                          title="Download attached file"
                          onClick={() => triggerFileDownload(pFileUrl, post.title || "content-media")}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs font-medium"
                        onClick={() => {
                          setSelectedDayViewDate(null);
                          openEdit(post as PostRecord);
                        }}
                      >
                        {isManagerOrAdmin ? "View & Edit" : "View Post"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedDayViewDate(null)}
            >
              Close
            </Button>
            {isManagerOrAdmin && (
              <Button
                type="button"
                className="gap-1.5"
                onClick={() => {
                  const date = selectedDayViewDate;
                  setSelectedDayViewDate(null);
                  if (date) openCreate(date);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Schedule New Post for this Day
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliverable Artwork Lightbox Preview */}
      <MediaLightbox
        open={lightboxState.open}
        onOpenChange={(open) => setLightboxState((prev) => ({ ...prev, open }))}
        items={lightboxState.items}
        title={lightboxState.title}
        subtitle={lightboxState.subtitle}
      />
    </div>
  );
}
