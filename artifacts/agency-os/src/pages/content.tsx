import { useState, useEffect } from "react";
import { SearchBar } from "@/components/common/SearchBar";
import {
  useListContentPosts, useCreateContentPost, useUpdateContentPost, useDeleteContentPost,
  useListClients, getListContentPostsQueryKey,
  useCreateCalendarShare, useListCalendarShares,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, ChevronLeft, ChevronRight, Calendar, Trash2, Link2,
  Share2, Copy, Check, FileText, CheckCircle2, Clock, AlertTriangle, RotateCcw, Building2,
  Download, FileX,
} from "lucide-react";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG, PLATFORM_ICON, DAYS, emptyDraft, buildShareUrl, getPostDateKey,
  PostRecord, PanelState, isPastDate, getPostAttachmentUrl, triggerFileDownload,
} from "@/components/content/content-constants";
import { ContentShareDialog } from "@/components/content/content-share-dialog";
import { ContentPostDrawer } from "@/components/content/content-post-drawer";

export default function ContentPage() {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeClientId, setActiveClientId] = useState<string>("");
  const [view, setView] = useState<"calendar" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const [draft, setDraft] = useState(emptyDraft());
  const [newComment, setNewComment] = useState("");
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const month = format(currentMonth, "yyyy-MM");
  const { data: clients } = useListClients();
  const { data: posts, isLoading } = useListContentPosts({
    clientId: activeClientId || undefined,
    month,
  });
  const { data: existingShares, refetch: refetchShares } = useListCalendarShares(
    activeClientId ? { clientId: activeClientId } : undefined,
  );

  const activeClientObj = (clients ?? []).find((c: any) => c.id === activeClientId);
  const activeClientName = activeClientObj?.companyName || "Client";

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
      onSuccess: (share) => {
        const url = buildShareUrl(share.shareToken);
        navigator.clipboard.writeText(url).then(() => {
          setCopiedShareId(share.id);
          toast.success("Share link copied to clipboard!");
          setTimeout(() => setCopiedShareId(null), 3000);
        });
        qc.invalidateQueries({ queryKey: ["listCalendarShares"] });
      },
      onError: () => toast.error("Failed to generate share link"),
    },
  });

  function openCreate(defaultDate?: string) {
    if (defaultDate && isPastDate(defaultDate)) {
      toast.error("Cannot schedule content for past dates. Please select today or a future date.");
      return;
    }
    setDraft(emptyDraft(defaultDate ?? ""));
    setNewComment("");
    setPanel({ mode: "create", defaultDate });
  }

  function openEdit(post: PostRecord) {
    const freshPost = (posts ?? []).find(p => p.id === post.id) || post;
    setDraft({
      title: freshPost.title ?? "",
      platform: freshPost.platform ?? "INSTAGRAM",
      contentType: freshPost.contentType ?? "POST",
      status: freshPost.status ?? "IDEA",
      caption: freshPost.caption ?? "",
      scheduledAt: freshPost.scheduledAt ?? "",
      shootDate: freshPost.shootDate ?? "",
      clientId: freshPost.clientId ?? "",
      assetsLink: freshPost.assetsLink ?? "",
      format: freshPost.format ?? "",
      needsRevision: freshPost.needsRevision === "true",
      approvalStatus: (freshPost as any).approvalStatus ?? "PENDING",
      rejectionNote: freshPost.rejectionNote ?? "",
      customProperties: freshPost.customProperties ?? [],
      comments: freshPost.comments ?? [],
    });
    setNewComment("");
    setPanel({ mode: "edit", post: freshPost as PostRecord });
  }

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
        (panel.mode === "edit" && activePost && activeDraft.shootDate !== activePost.shootDate)
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
      clientId: activeDraft.clientId || undefined,
      assetsLink: activeDraft.assetsLink || undefined,
      format: activeDraft.format || undefined,
      needsRevision: String(activeDraft.needsRevision),
      approvalStatus: activeDraft.approvalStatus ?? "PENDING",
      customProperties: activeDraft.customProperties?.length ? activeDraft.customProperties : undefined,
      comments: activeDraft.comments?.length ? activeDraft.comments : undefined,
    };
    if (panel.mode === "create") {
      createMutation.mutate({ data: payload as any });
    } else if (panel.mode === "edit" && activePost) {
      updateMutation.mutate({ id: activePost.id, data: payload as any });
    }
  }

  function copyExistingShare(shareToken: string, shareId: string) {
    const url = buildShareUrl(shareToken);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShareId(shareId);
      toast.success("Link copied!");
      setTimeout(() => setCopiedShareId(null), 3000);
    });
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

  const isPending = createMutation.isPending || updateMutation.isPending;
  const activeClient = clients?.find((c) => c.id === activeClientId);

  const totalPublished   = (posts ?? []).filter((p) => p.status === "PUBLISHED").length;
  const totalScheduled   = (posts ?? []).filter((p) => p.status === "SCHEDULED").length;
  const totalNeedsRevision = (posts ?? []).filter((p) => (p as any).needsRevision === "true" || (p as any).approvalStatus === "NEEDS_CHANGES").length;

  const contentStatChips = [
    { label: "Posts This Month", value: posts?.length ?? 0,  accent: "border-l-primary",     icon: <FileText className="h-4 w-4" /> },
    { label: "Published",        value: totalPublished,       accent: "border-l-emerald-500", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Scheduled",        value: totalScheduled,       accent: "border-l-blue-500",    icon: <Clock className="h-4 w-4" /> },
    { label: "Needs Revision",   value: totalNeedsRevision,   accent: totalNeedsRevision > 0 ? "border-l-amber-400" : "border-l-slate-300", icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 animated-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeClientId ? `${activeClient?.companyName} — ` : ""}{posts?.length ?? 0} posts this month
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchBar placeholder="Search posts…" value={searchQuery} onChange={setSearchQuery} />
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setView("list")}
              className={cn("px-3 py-1 rounded-md text-sm font-medium transition-colors", view === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground")}
            >List</button>
            <button
              onClick={() => setView("calendar")}
              className={cn("px-3 py-1 rounded-md text-sm font-medium transition-colors", view === "calendar" ? "bg-card shadow text-foreground" : "text-muted-foreground")}
            >Calendar</button>
          </div>
          {/* Share button — only when a client is selected */}
          {activeClientId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setShowShareModal(true)}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Calendar
            </Button>
          )}
          <Button onClick={() => openCreate()} className="gap-2 btn-micro-anim">
            <Plus className="h-4 w-4" /> Add Post
          </Button>
        </div>
      </div>

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

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : view === "list" ? (
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
                        {((post as any).needsRevision === "true" || (post as any).approvalStatus === "NEEDS_CHANGES") && (
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
              return (
                <div
                  key={day}
                  className="min-h-28 border-b border-r border-border p-1.5 cursor-pointer hover:bg-primary/5 transition-colors group"
                  onClick={() => openCreate(dateStr)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">{day}</p>
                    <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => {
                      const isRevision = (p as any).needsRevision === "true" || (p as any).approvalStatus === "NEEDS_CHANGES";
                      const pFileUrl = getPostAttachmentUrl(p);
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 truncate cursor-pointer transition-colors border group/item",
                            isRevision
                              ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 font-semibold"
                              : "bg-primary/10 border-primary/20 hover:bg-primary/20"
                          )}
                          onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        >
                          {isRevision ? <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" /> : PLATFORM_ICON[p.platform ?? "INSTAGRAM"]}
                          <span className="truncate flex-1">{p.title ?? p.caption?.slice(0, 20) ?? p.contentType}</span>
                          {pFileUrl && (
                            <button
                              type="button"
                              title="Download attached file"
                              className="p-0.5 text-primary hover:text-primary-foreground hover:bg-primary/30 rounded shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerFileDownload(pFileUrl, p.title || "content-media");
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayPosts.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
        activeClientId={activeClientId}
        activeClientName={activeClientName}
        existingShares={existingShares}
        shareMutation={shareMutation}
        refetchShares={refetchShares}
      />
    </div>
  );
}
