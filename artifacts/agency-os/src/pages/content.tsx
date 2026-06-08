import { useState } from "react";
import {
  useListContentPosts, useCreateContentPost, useUpdateContentPost, useDeleteContentPost,
  useListClients, getListContentPostsQueryKey,
} from "@workspace/api-client-react";
import type { ContentPostInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm, Controller } from "react-hook-form";
import {
  Plus, ChevronLeft, ChevronRight, Trash2, Calendar,
  Instagram, Youtube, Facebook, Linkedin, Link2, Check, ExternalLink,
} from "lucide-react";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IDEA: { label: "Idea", className: "bg-slate-100 text-slate-600" },
  SCRIPTING: { label: "Scripting", className: "bg-blue-100 text-blue-700" },
  DESIGNING: { label: "Designing", className: "bg-violet-100 text-violet-700" },
  IN_REVIEW: { label: "In Review", className: "bg-amber-100 text-amber-700" },
  ADMIN_APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  SCHEDULED: { label: "Scheduled", className: "bg-cyan-100 text-cyan-700" },
  PUBLISHED: { label: "Published", className: "bg-green-100 text-green-700" },
};

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  INSTAGRAM: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  YOUTUBE: <Youtube className="h-3.5 w-3.5 text-red-500" />,
  FACEBOOK: <Facebook className="h-3.5 w-3.5 text-blue-500" />,
  LINKEDIN: <Linkedin className="h-3.5 w-3.5 text-blue-600" />,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function detectPlatformFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes("instagram.com")) return "INSTAGRAM";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "YOUTUBE";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "FACEBOOK";
  if (url.includes("linkedin.com")) return "LINKEDIN";
  return null;
}

function ReferenceLink({ url }: { url: string }) {
  const platform = detectPlatformFromUrl(url);
  const icon = platform ? PLATFORM_ICON[platform] : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1.5 max-w-xs truncate"
    >
      {icon}
      <span className="truncate">{url.replace(/^https?:\/\//, "").slice(0, 45)}{url.length > 45 ? "…" : ""}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

function CopyLinkButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = `${window.location.origin}/content?client=${clientId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success(`Shareable link copied for ${clientName}`);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className={cn("gap-1.5 text-xs h-8 transition-all", copied && "border-emerald-400 text-emerald-600 bg-emerald-50")}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Share link"}
    </Button>
  );
}

export default function ContentPage() {
  const qc = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("list");

  const month = format(currentMonth, "yyyy-MM");
  const { data: clients } = useListClients();
  const { data: posts, isLoading } = useListContentPosts({
    params: { query: { clientId: selectedClientId || undefined, month } },
  });

  const createMutation = useCreateContentPost({
    mutation: {
      onSuccess: () => { toast.success("Post created"); qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() }); setDialogOpen(false); },
      onError: () => toast.error("Failed to create post"),
    },
  });

  const deleteMutation = useDeleteContentPost({
    mutation: {
      onSuccess: () => { toast.success("Post deleted"); qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() }); },
    },
  });

  const updateMutation = useUpdateContentPost({
    mutation: {
      onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() }); },
    },
  });

  const { register, handleSubmit, control, reset, watch, setValue } = useForm<ContentPostInput>({
    defaultValues: { platform: "INSTAGRAM", contentType: "POST", status: "IDEA", clientId: selectedClientId },
  });

  const watchedRefUrl = watch("referenceUrl" as keyof ContentPostInput);

  const openAdd = () => {
    reset({ platform: "INSTAGRAM", contentType: "POST", status: "IDEA", clientId: selectedClientId });
    setDialogOpen(true);
  };

  const onSubmit = (data: ContentPostInput) => {
    createMutation.mutate({ data });
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  const postsByDay: Record<number, typeof posts> = {};
  (posts ?? []).forEach((p) => {
    if (p.scheduledAt) {
      const day = new Date(p.scheduledAt).getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day]!.push(p);
    }
  });

  const selectedClient = (clients ?? []).find((c) => c.id === selectedClientId);

  const handleRefUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const detected = detectPlatformFromUrl(url);
    if (detected) {
      setValue("platform", detected as ContentPostInput["platform"]);
    }
  };

  return (
    <div className="p-6 animated-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{posts?.length ?? 0} posts this month</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setView("list")} className={cn("px-3 py-1 rounded-md text-sm font-medium transition-colors", view === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground")}>List</button>
            <button onClick={() => setView("calendar")} className={cn("px-3 py-1 rounded-md text-sm font-medium transition-colors", view === "calendar" ? "bg-card shadow text-foreground" : "text-muted-foreground")}>Calendar</button>
          </div>
          <Button onClick={openAdd} className="gap-2 btn-micro-anim" data-testid="add-post-btn">
            <Plus className="h-4 w-4" /> Add Post
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-0.5 hover:text-primary"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm font-semibold min-w-28 text-center">{format(currentMonth, "MMMM yyyy")}</span>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-0.5 hover:text-primary"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-52" data-testid="content-client-filter">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All clients</SelectItem>
            {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
          </SelectContent>
        </Select>

        {selectedClient && (
          <CopyLinkButton clientId={selectedClient.id} clientName={selectedClient.companyName} />
        )}
      </div>

      {selectedClient && (
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/15 px-4 py-2.5 animated-fade-in">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Shareable calendar for {selectedClient.companyName}</p>
            <p className="text-xs text-muted-foreground truncate">{window.location.origin}/content?client={selectedClient.id}</p>
          </div>
          <CopyLinkButton clientId={selectedClient.id} clientName={selectedClient.companyName} />
        </div>
      )}

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
              <p className="text-sm">Add your first post to get started</p>
            </div>
          ) : (
            (posts ?? []).map((post) => {
              const sc = STATUS_CONFIG[post.status ?? "IDEA"];
              const postWithRef = post as typeof post & { referenceUrl?: string; description?: string };
              return (
                <Card key={post.id} className="scale-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 shrink-0">{PLATFORM_ICON[post.platform ?? "INSTAGRAM"]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[11px]">{post.contentType}</Badge>
                            <Badge variant="secondary" className={cn("text-[11px]", sc.className)}>{sc.label}</Badge>
                            {post.scheduledAt && <span className="text-xs text-muted-foreground">{format(new Date(post.scheduledAt), "dd MMM, EEE")}</span>}
                            {post.clientName && <span className="text-xs text-muted-foreground">· {post.clientName}</span>}
                          </div>
                          {post.caption && <p className="text-sm font-medium mt-1">{post.caption}</p>}
                          {postWithRef.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{postWithRef.description}</p>
                          )}
                          {postWithRef.referenceUrl && (
                            <ReferenceLink url={postWithRef.referenceUrl} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select value={post.status ?? "IDEA"} onValueChange={(v) => updateMutation.mutate({ id: post.id, data: { status: v } })}>
                          <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: post.id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {DAYS.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-24 border-b border-r border-border bg-muted/10" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayPosts = postsByDay[day] ?? [];
              return (
                <div key={day} className="min-h-24 border-b border-r border-border p-1.5">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{day}</p>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex items-center gap-1 text-[10px] bg-primary/10 rounded px-1 py-0.5 truncate">
                        {PLATFORM_ICON[p.platform ?? "INSTAGRAM"]}
                        <span className="truncate">{p.caption?.slice(0, 20) ?? p.contentType}</span>
                      </div>
                    ))}
                    {dayPosts.length > 3 && <p className="text-[10px] text-muted-foreground px-1">+{dayPosts.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Plan Content Post</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

            {/* Client */}
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>

            {/* Reference URL — auto-detects platform */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                Reference Link
                <span className="text-xs text-muted-foreground font-normal">(Instagram / YouTube / Facebook / LinkedIn)</span>
              </Label>
              <div className="relative">
                <Input
                  {...register("referenceUrl" as keyof ContentPostInput)}
                  placeholder="https://www.instagram.com/p/... or https://youtu.be/..."
                  onChange={(e) => {
                    register("referenceUrl" as keyof ContentPostInput).onChange(e);
                    handleRefUrlChange(e);
                  }}
                />
                {watchedRefUrl && (() => {
                  const detected = detectPlatformFromUrl(String(watchedRefUrl));
                  if (!detected) return null;
                  return (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {PLATFORM_ICON[detected]}
                    </div>
                  );
                })()}
              </div>
              {watchedRefUrl && detectPlatformFromUrl(String(watchedRefUrl)) && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Platform auto-detected: {detectPlatformFromUrl(String(watchedRefUrl))?.toLowerCase()}
                </p>
              )}
            </div>

            {/* Caption (post title) */}
            <div className="space-y-1.5">
              <Label>Post Title / Caption</Label>
              <Input {...register("caption")} placeholder="e.g. Summer Sale Reel" data-testid="caption-input" />
            </div>

            {/* Content description */}
            <div className="space-y-1.5">
              <Label>Content Description</Label>
              <Textarea
                {...register("description" as keyof ContentPostInput)}
                rows={3}
                placeholder="Describe the content idea, key message, what to show, hashtags to use..."
              />
            </div>

            {/* Platform + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Controller control={control} name="platform" render={({ field }) => (
                  <Select value={field.value ?? "INSTAGRAM"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM">
                        <span className="flex items-center gap-2"><Instagram className="h-3.5 w-3.5 text-pink-500" /> Instagram</span>
                      </SelectItem>
                      <SelectItem value="YOUTUBE">
                        <span className="flex items-center gap-2"><Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube</span>
                      </SelectItem>
                      <SelectItem value="FACEBOOK">
                        <span className="flex items-center gap-2"><Facebook className="h-3.5 w-3.5 text-blue-500" /> Facebook</span>
                      </SelectItem>
                      <SelectItem value="LINKEDIN">
                        <span className="flex items-center gap-2"><Linkedin className="h-3.5 w-3.5 text-blue-600" /> LinkedIn</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Controller control={control} name="contentType" render={({ field }) => (
                  <Select value={field.value ?? "POST"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">Post</SelectItem>
                      <SelectItem value="REEL">Reel</SelectItem>
                      <SelectItem value="STORY">Story</SelectItem>
                      <SelectItem value="CAROUSEL">Carousel</SelectItem>
                      <SelectItem value="VIDEO">Video</SelectItem>
                      <SelectItem value="SHORT">Short</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            {/* Status + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value ?? "IDEA"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Scheduled Date</Label>
                <Input {...register("scheduledAt")} type="date" />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-post-btn">
                {createMutation.isPending ? "Saving…" : "Create Post"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
