import { useState, useRef } from "react";
import {
  useListContentPosts, useCreateContentPost, useUpdateContentPost, useDeleteContentPost,
  useListClients, getListContentPostsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Plus, ChevronLeft, ChevronRight, Calendar, Trash2,
  Instagram, Youtube, Facebook, Linkedin, Link2, Image,
  MessageSquare, Settings2, Send, X, RotateCcw,
} from "lucide-react";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IDEA: { label: "Idea", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  SCRIPTING: { label: "Scripting", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  DESIGNING: { label: "Designing", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  IN_REVIEW: { label: "In Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  ADMIN_APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  SCHEDULED: { label: "Scheduled", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  PUBLISHED: { label: "Published", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
};

const FORMAT_OPTIONS = ["VIDEO", "PHOTO", "GRAPHIC", "CAROUSEL", "REEL", "STORY", "ANIMATION", "INFOGRAPHIC"];
const PLATFORM_OPTIONS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "LINKEDIN", "TIKTOK", "TWITTER", "PINTEREST"];

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  INSTAGRAM: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  YOUTUBE: <Youtube className="h-3.5 w-3.5 text-red-500" />,
  FACEBOOK: <Facebook className="h-3.5 w-3.5 text-blue-500" />,
  LINKEDIN: <Linkedin className="h-3.5 w-3.5 text-blue-600" />,
  TIKTOK: <span className="h-3.5 w-3.5 text-[10px] font-bold">TK</span>,
  TWITTER: <span className="h-3.5 w-3.5 text-[10px] font-bold">𝕏</span>,
  PINTEREST: <span className="h-3.5 w-3.5 text-[10px] font-bold">P</span>,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PostRecord = {
  id: string;
  platform?: string | null;
  contentType?: string | null;
  status?: string | null;
  caption?: string | null;
  scheduledAt?: string | null;
  shootDate?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  referenceUrl?: string | null;
  assetsLink?: string | null;
  format?: string | null;
  needsRevision?: string | null;
  title?: string | null;
  customProperties?: { key: string; value: string }[] | null;
  comments?: { id: string; text: string; createdAt: string }[] | null;
  createdAt?: string | null;
};

type PanelState =
  | { mode: "closed" }
  | { mode: "create"; defaultDate?: string }
  | { mode: "edit"; post: PostRecord };

function emptyDraft(defaultDate?: string) {
  return {
    title: "",
    platform: "INSTAGRAM",
    contentType: "POST",
    status: "IDEA",
    caption: "",
    scheduledAt: defaultDate ?? "",
    shootDate: "",
    clientId: "",
    assetsLink: "",
    format: "",
    needsRevision: false,
    customProperties: [] as { key: string; value: string }[],
    comments: [] as { id: string; text: string; createdAt: string }[],
  };
}

export default function ContentPage() {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [view, setView] = useState<"calendar" | "list">("list");
  const [panel, setPanel] = useState<PanelState>({ mode: "closed" });
  const [draft, setDraft] = useState(emptyDraft());
  const [newComment, setNewComment] = useState("");
  const commentInputRef = useRef<HTMLInputElement>(null);

  const month = format(currentMonth, "yyyy-MM");
  const { data: clients } = useListClients();
  const { data: posts, isLoading } = useListContentPosts({
    clientId: selectedClientId || undefined,
    month,
  });

  const createMutation = useCreateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post created");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setPanel({ mode: "closed" });
      },
      onError: () => toast.error("Failed to create post"),
    },
  });

  const updateMutation = useUpdateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post saved");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
      },
      onError: () => toast.error("Failed to save"),
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

  function openCreate(defaultDate?: string) {
    setDraft(emptyDraft(defaultDate));
    setNewComment("");
    setPanel({ mode: "create", defaultDate });
  }

  function openEdit(post: PostRecord) {
    setDraft({
      title: post.title ?? "",
      platform: post.platform ?? "INSTAGRAM",
      contentType: post.contentType ?? "POST",
      status: post.status ?? "IDEA",
      caption: post.caption ?? "",
      scheduledAt: post.scheduledAt ?? "",
      shootDate: post.shootDate ?? "",
      clientId: post.clientId ?? "",
      assetsLink: post.assetsLink ?? "",
      format: post.format ?? "",
      needsRevision: post.needsRevision === "true",
      customProperties: post.customProperties ?? [],
      comments: post.comments ?? [],
    });
    setNewComment("");
    setPanel({ mode: "edit", post });
  }

  function setField<K extends keyof typeof draft>(key: K, value: typeof draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function savePost() {
    const payload = {
      title: draft.title || undefined,
      platform: draft.platform,
      contentType: draft.contentType,
      status: draft.status,
      caption: draft.caption || undefined,
      scheduledAt: draft.scheduledAt || undefined,
      shootDate: draft.shootDate || undefined,
      clientId: draft.clientId || undefined,
      assetsLink: draft.assetsLink || undefined,
      format: draft.format || undefined,
      needsRevision: String(draft.needsRevision),
      customProperties: draft.customProperties.length ? draft.customProperties : undefined,
      comments: draft.comments.length ? draft.comments : undefined,
    };

    if (panel.mode === "create") {
      createMutation.mutate({ data: payload as any });
    } else if (panel.mode === "edit") {
      updateMutation.mutate({ id: panel.post.id, data: payload as any });
    }
  }

  function addCustomProp() {
    setField("customProperties", [...draft.customProperties, { key: "", value: "" }]);
  }

  function updateCustomProp(i: number, field: "key" | "value", val: string) {
    const next = draft.customProperties.map((p, idx) => idx === i ? { ...p, [field]: val } : p);
    setField("customProperties", next);
  }

  function removeCustomProp(i: number) {
    setField("customProperties", draft.customProperties.filter((_, idx) => idx !== i));
  }

  function addComment() {
    if (!newComment.trim()) return;
    const comment = { id: crypto.randomUUID(), text: newComment.trim(), createdAt: new Date().toISOString() };
    setField("comments", [...draft.comments, comment]);
    setNewComment("");
  }

  function removeComment(id: string) {
    setField("comments", draft.comments.filter((c) => c.id !== id));
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  const postsByDay: Record<number, PostRecord[]> = {};
  (posts ?? []).forEach((p) => {
    if (p.scheduledAt) {
      const day = new Date(p.scheduledAt).getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day]!.push(p as PostRecord);
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 animated-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{posts?.length ?? 0} posts this month</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Button onClick={() => openCreate()} className="gap-2 btn-micro-anim">
            <Plus className="h-4 w-4" /> Add Post
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-0.5 hover:text-primary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold min-w-28 text-center">{format(currentMonth, "MMMM yyyy")}</span>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-0.5 hover:text-primary">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Select value={selectedClientId} onValueChange={(val) => setSelectedClientId(val ?? "")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All clients</SelectItem>
            {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {(posts ?? []).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No posts this month</p>
              <p className="text-sm mt-1">Click "Add Post" or a calendar date to get started</p>
            </div>
          ) : (
            (posts ?? []).map((post) => {
              const sc = STATUS_CONFIG[post.status ?? "IDEA"];
              return (
                <div
                  key={post.id}
                  className="flex items-start justify-between gap-3 bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 transition-colors scale-hover"
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
                        {(post as any).needsRevision === "true" && (
                          <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-300 bg-amber-50">
                            <RotateCcw className="h-2.5 w-2.5 mr-1" />Needs Revision
                          </Badge>
                        )}
                      </div>
                      {post.caption && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{post.caption}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
        /* Calendar grid */
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
              const dayPosts = postsByDay[day] ?? [];
              const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day), "yyyy-MM-dd");
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
                    {dayPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 rounded px-1 py-0.5 truncate cursor-pointer transition-colors"
                        onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                      >
                        {PLATFORM_ICON[p.platform ?? "INSTAGRAM"]}
                        <span className="truncate">{p.title ?? p.caption?.slice(0, 20) ?? p.contentType}</span>
                      </div>
                    ))}
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

      {/* ── Slide-over Panel ── */}
      <Sheet open={panel.mode !== "closed"} onOpenChange={(open) => { if (!open) setPanel({ mode: "closed" }); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0" side="right">
          {/* Panel Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
            <SheetHeader className="text-left">
              <SheetTitle className="text-base">
                {panel.mode === "create" ? "New Post" : "Edit Post"}
              </SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-2">
              {panel.mode === "edit" && (
                <Button
                  size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => { if (panel.mode === "edit") deleteMutation.mutate({ id: panel.post.id }); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" onClick={savePost} disabled={isPending} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {isPending ? "Saving…" : panel.mode === "create" ? "Create" : "Save"}
              </Button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5" /> Name
              </Label>
              <Input
                placeholder="Post title or name…"
                value={draft.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            </div>

            <Separator />

            {/* Two-col: Status + Platform */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                <Select value={draft.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Platform</Label>
                <Select value={draft.platform} onValueChange={(v) => setField("platform", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Two-col: Post Date + Shoot Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Post Date</Label>
                <Input
                  type="date"
                  value={draft.scheduledAt?.slice(0, 10) ?? ""}
                  onChange={(e) => setField("scheduledAt", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shoot Date</Label>
                <Input
                  type="date"
                  value={draft.shootDate?.slice(0, 10) ?? ""}
                  onChange={(e) => setField("shootDate", e.target.value)}
                />
              </div>
            </div>

            {/* Two-col: Format + Client */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Format</Label>
                <Select value={draft.format || "__none__"} onValueChange={(v) => setField("format", v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {FORMAT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</Label>
                <Select value={draft.clientId || "__none__"} onValueChange={(v) => setField("clientId", v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No client</SelectItem>
                    {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assets Link */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Assets Link
              </Label>
              <Input
                placeholder="https://drive.google.com/…"
                value={draft.assetsLink}
                onChange={(e) => setField("assetsLink", e.target.value)}
              />
            </div>

            {/* Caption / Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Caption / Notes</Label>
              <Textarea
                placeholder="Write your caption or notes here…"
                rows={4}
                value={draft.caption}
                onChange={(e) => setField("caption", e.target.value)}
              />
            </div>

            {/* Needs Revision */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">Needs Revision</p>
                  <p className="text-xs text-muted-foreground">Flag this post for changes</p>
                </div>
              </div>
              <Switch
                checked={draft.needsRevision as boolean}
                onCheckedChange={(v) => setField("needsRevision", v)}
              />
            </div>

            {/* Created (read-only, edit mode only) */}
            {panel.mode === "edit" && panel.post.createdAt && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(panel.post.createdAt), "dd MMM yyyy, hh:mm a")}
                </p>
              </div>
            )}

            <Separator />

            {/* Custom Properties */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" /> Properties
                </Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={addCustomProp}>
                  <Plus className="h-3 w-3" /> Add a property
                </Button>
              </div>
              {draft.customProperties.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No custom properties yet.</p>
              ) : (
                <div className="space-y-2">
                  {draft.customProperties.map((prop, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Property name"
                        value={prop.key}
                        onChange={(e) => updateCustomProp(i, "key", e.target.value)}
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="Value"
                        value={prop.value}
                        onChange={(e) => updateCustomProp(i, "value", e.target.value)}
                      />
                      <button
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => removeCustomProp(i)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Comments */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Comments
              </Label>
              {draft.comments.length > 0 && (
                <div className="space-y-2">
                  {draft.comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 group/comment">
                      <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2">
                        <p className="text-sm">{c.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(c.createdAt), "dd MMM, hh:mm a")}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover/comment:opacity-100 transition-opacity mt-2 text-muted-foreground hover:text-destructive"
                        onClick={() => removeComment(c.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={commentInputRef}
                  placeholder="Add a comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }}
                  className="text-sm"
                />
                <Button size="sm" variant="outline" onClick={addComment} disabled={!newComment.trim()}>
                  Add
                </Button>
              </div>
            </div>

            {/* Bottom padding */}
            <div className="h-4" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
