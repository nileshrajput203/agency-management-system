import { useState, useEffect } from "react";
import {
  useListContentPosts, useCreateContentPost, useUpdateContentPost, useDeleteContentPost,
  useListClients, getListContentPostsQueryKey, useCreateCalendarShare,
} from "@workspace/api-client-react";
import type { ContentPostInput, ContentPost, ClientCalendarShare } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useForm, Controller, useFieldArray } from "react-hook-form";
import {
  Plus, ChevronLeft, ChevronRight, Trash2, Calendar,
  Instagram, Youtube, Facebook, Linkedin, Link2, Check, ExternalLink,
  X, Link as LinkIcon, Share2, Copy
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
  
  // Post detail/edit modal
  const [viewPost, setViewPost] = useState<ContentPost | null>(null);

  // Share modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareClientId, setShareClientId] = useState<string>("");
  const [shareLabel, setShareLabel] = useState("");
  const [generatedShare, setGeneratedShare] = useState<ClientCalendarShare | null>(null);

  const month = format(currentMonth, "yyyy-MM");
  const { data: clients } = useListClients();
  const { data: posts, isLoading } = useListContentPosts({ clientId: selectedClientId || undefined, month });

  const createMutation = useCreateContentPost({
    mutation: {
      onSuccess: () => { toast.success("Post created"); qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() }); setDialogOpen(false); },
      onError: () => toast.error("Failed to create post"),
    },
  });

  const updateMutation = useUpdateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post updated");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setViewPost(null);
      },
    },
  });

  const deleteMutation = useDeleteContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post deleted");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setViewPost(null);
      },
    },
  });

  const createShareMutation = useCreateCalendarShare({
    mutation: {
      onSuccess: (data) => {
        toast.success("Share link created!");
        setGeneratedShare(data);
      },
      onError: () => toast.error("Failed to create share link")
    }
  });

  // Form for ADD post
  const { register: regAdd, handleSubmit: handleAddSubmit, control: controlAdd, reset: resetAdd, watch: watchAdd, setValue: setValueAdd } = useForm<ContentPostInput>({
    defaultValues: {
      platform: "INSTAGRAM",
      contentType: "POST",
      status: "IDEA",
      clientId: selectedClientId,
      referenceLinks: [],
      referenceUrl: "",
      description: "",
    },
  });

  const watchedRefUrl = watchAdd("referenceUrl" as keyof ContentPostInput);
  const handleRefUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const detected = detectPlatformFromUrl(url);
    if (detected) {
      setValueAdd("platform", detected as ContentPostInput["platform"]);
    }
  };

  const { fields: addRefLinks, append: appendAddRef, remove: removeAddRef } = useFieldArray({
    control: controlAdd,
    name: "referenceLinks" as never, // hack for typings since it may be loose
  });

  const openAdd = () => {
    resetAdd({
      platform: "INSTAGRAM",
      contentType: "POST",
      status: "IDEA",
      clientId: selectedClientId,
      referenceLinks: [],
      referenceUrl: "",
      description: "",
    });
    setDialogOpen(true);
  };

  const onAddSubmit = (data: ContentPostInput) => {
    createMutation.mutate({ data });
  };

  // Form for EDIT post (Notion style)
  const { register: regEdit, handleSubmit: handleEditSubmit, control: controlEdit, reset: resetEdit, watch: watchEdit, setValue: setValueEdit } = useForm<ContentPostInput>();
  const { fields: editRefLinks, append: appendEditRef, remove: removeEditRef } = useFieldArray({
    control: controlEdit,
    name: "referenceLinks" as never,
  });

  // Watch platform/type/status for the badges in the edit modal
  const editPlatform = watchEdit("platform");
  const editContentType = watchEdit("contentType");
  const editStatus = watchEdit("status");
  const watchedEditRefUrl = watchEdit("referenceUrl" as keyof ContentPostInput);

  const handleEditRefUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    const detected = detectPlatformFromUrl(url);
    if (detected) {
      setValueEdit("platform", detected as ContentPostInput["platform"]);
    }
  };

  useEffect(() => {
    if (viewPost) {
      resetEdit({
        clientId: viewPost.clientId,
        platform: viewPost.platform,
        contentType: viewPost.contentType,
        caption: viewPost.caption ?? "",
        status: viewPost.status,
        scheduledAt: viewPost.scheduledAt ?? "",
        title: (viewPost as any).title ?? "",
        script: (viewPost as any).script ?? "",
        ideation: (viewPost as any).ideation ?? "",
        referenceLinks: (viewPost as any).referenceLinks ?? [],
        referenceUrl: (viewPost as any).referenceUrl ?? "",
        description: (viewPost as any).description ?? "",
      } as ContentPostInput);
    }
  }, [viewPost, resetEdit]);

  const onEditSubmit = (data: ContentPostInput) => {
    if (!viewPost) return;
    updateMutation.mutate({ id: viewPost.id, data });
  };

  // Build calendar
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

  const generateShareLink = () => {
    if (!shareClientId) { toast.error("Select a client first"); return; }
    createShareMutation.mutate({ data: { clientId: shareClientId, label: shareLabel } });
  };

  const copyShareLink = () => {
    if (!generatedShare) return;
    const url = `${window.location.origin}/share/calendar/${generatedShare.shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
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
          <Button variant="outline" onClick={() => setShareOpen(true)} className="gap-2">
            <Share2 className="h-4 w-4" /> Share
          </Button>
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
        <Select value={selectedClientId} onValueChange={(val) => setSelectedClientId(val as string)}>
          <SelectTrigger className="w-48" data-testid="content-client-filter">
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
                <Card key={post.id} className="scale-hover cursor-pointer" onClick={() => setViewPost(post)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 shrink-0">{PLATFORM_ICON[post.platform ?? "INSTAGRAM"]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-[11px]">{post.contentType}</Badge>
                            <Badge variant="secondary" className={cn("text-[11px]", sc?.className)}>{sc?.label}</Badge>
                            {post.scheduledAt && <span className="text-xs text-muted-foreground">{format(new Date(post.scheduledAt), "dd MMM, EEE")}</span>}
                            {post.clientName && <span className="text-xs text-muted-foreground">· {post.clientName}</span>}
                          </div>
                          <span className="text-sm font-semibold hover:underline">
                            {(post as any).title || "Untitled Post"}
                          </span>
                          {post.caption && <p className="text-sm text-foreground/80 mt-1">{post.caption}</p>}
                          {postWithRef.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{postWithRef.description}</p>
                          )}
                          {postWithRef.referenceUrl && (
                            <ReferenceLink url={postWithRef.referenceUrl} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Select value={post.status ?? "IDEA"} onValueChange={(v) => updateMutation.mutate({ id: post.id, data: { status: v as string } })}>
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
                      <div key={p.id} onClick={() => setViewPost(p)} className="flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors rounded px-1 py-0.5 truncate">
                        {PLATFORM_ICON[p.platform ?? "INSTAGRAM"]}
                        <span className="truncate">{(p as any).title || p.caption?.slice(0, 20) || p.contentType}</span>
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

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Content Post</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit(onAddSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Controller control={controlAdd} name="clientId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            
            <div className="space-y-1.5">
              <Input {...regAdd("title" as never)} placeholder="Post Title..." className="font-semibold text-lg" />
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
                  {...regAdd("referenceUrl" as keyof ContentPostInput)}
                  placeholder="https://www.instagram.com/p/... or https://youtu.be/..."
                  onChange={(e: any) => {
                    regAdd("referenceUrl" as keyof ContentPostInput).onChange(e);
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

            {/* Content description */}
            <div className="space-y-1.5">
              <Label>Content Description</Label>
              <Textarea
                {...regAdd("description" as keyof ContentPostInput)}
                rows={3}
                placeholder="Describe the content idea, key message, what to show, hashtags to use..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Controller control={controlAdd} name="platform" render={({ field }) => (
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
                <Controller control={controlAdd} name="contentType" render={({ field }) => (
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
                <Controller control={controlAdd} name="status" render={({ field }) => (
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
                <Input {...regAdd("scheduledAt")} type="date" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Script</Label>
              <Textarea {...regAdd("script")} rows={3} placeholder="Full script..." />
            </div>

            <div className="space-y-1.5">
              <Label>Ideation</Label>
              <Textarea {...regAdd("ideation")} rows={3} placeholder="Ideas, angles, brainstorm..." />
            </div>

            <div className="space-y-2">
              <Label>Reference Links</Label>
              {addRefLinks.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <Input placeholder="Label (e.g. Inspo)" {...regAdd(`referenceLinks.${index}.label` as never)} />
                  <Input placeholder="https://..." {...regAdd(`referenceLinks.${index}.url` as never)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAddRef(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendAddRef({ label: "", url: "" } as any)}>
                <Plus className="h-4 w-4 mr-1" /> Add Reference Link
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea {...regAdd("caption")} rows={4} placeholder="Post caption..." />
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

      {/* Edit Dialog (Notion Style) */}
      <Dialog open={!!viewPost} onOpenChange={(open) => !open && setViewPost(null)}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8">
          {viewPost && (
            <form onSubmit={handleEditSubmit(onEditSubmit)}>
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  {PLATFORM_ICON[editPlatform ?? "INSTAGRAM"]}
                  
                  <Controller control={controlEdit} name="platform" render={({ field }) => (
                    <Select value={field.value ?? "INSTAGRAM"} onValueChange={field.onChange}>
                      <SelectTrigger className="h-6 border-none shadow-none px-1 py-0 w-auto text-muted-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                        <SelectItem value="FACEBOOK">Facebook</SelectItem>
                        <SelectItem value="YOUTUBE">YouTube</SelectItem>
                        <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                  <span>•</span>
                  <Controller control={controlEdit} name="contentType" render={({ field }) => (
                    <Select value={field.value ?? "POST"} onValueChange={field.onChange}>
                      <SelectTrigger className="h-6 border-none shadow-none px-1 py-0 w-auto text-muted-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="POST">Post</SelectItem>
                        <SelectItem value="REEL">Reel</SelectItem>
                        <SelectItem value="STORY">Story</SelectItem>
                        <SelectItem value="CAROUSEL">Carousel</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                  <span>•</span>
                  <Controller control={controlEdit} name="status" render={({ field }) => (
                    <Select value={field.value ?? "IDEA"} onValueChange={field.onChange}>
                      <SelectTrigger className={cn("h-6 border-none shadow-none px-2 py-0 w-auto rounded-full", STATUS_CONFIG[field.value ?? "IDEA"]?.className)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                
                <Input placeholder="Enter post title" {...regEdit("title" as never)} className="text-4xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 shadow-none h-auto mb-2" />
                
                <div className="flex items-center text-muted-foreground gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Scheduled for</span>
                  <Input {...regEdit("scheduledAt")} type="date" className="h-8 w-auto border-none shadow-none focus-visible:ring-0 p-0" />
                </div>
              </DialogHeader>

              <hr className="my-6 border-border" />

              <div className="space-y-8">
                {/* Reference URL — auto-detects platform */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 font-semibold text-lg">
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    Reference Link
                    <span className="text-xs text-muted-foreground font-normal">(Instagram / YouTube / Facebook / LinkedIn)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      {...regEdit("referenceUrl" as keyof ContentPostInput)}
                      placeholder="https://www.instagram.com/p/... or https://youtu.be/..."
                      onChange={(e: any) => {
                        regEdit("referenceUrl" as keyof ContentPostInput).onChange(e);
                        handleEditRefUrlChange(e);
                      }}
                    />
                    {watchedEditRefUrl && (() => {
                      const detected = detectPlatformFromUrl(String(watchedEditRefUrl));
                      if (!detected) return null;
                      return (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          {PLATFORM_ICON[detected]}
                        </div>
                      );
                    })()}
                  </div>
                  {watchedEditRefUrl && detectPlatformFromUrl(String(watchedEditRefUrl)) && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Platform auto-detected: {detectPlatformFromUrl(String(watchedEditRefUrl))?.toLowerCase()}
                    </p>
                  )}
                </div>

                {/* Content description */}
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    Content Description
                  </h3>
                  <Textarea
                    {...regEdit("description" as keyof ContentPostInput)}
                    rows={3}
                    placeholder="Describe the content idea, key message, what to show, hashtags to use..."
                    className="min-h-[100px] resize-y text-base bg-muted/20 border-border/50 focus-visible:ring-1"
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    📝 Script
                  </h3>
                  <Textarea 
                    {...regEdit("script")} 
                    placeholder="Write the full script here..." 
                    className="min-h-[150px] resize-y text-base bg-muted/20 border-border/50 focus-visible:ring-1" 
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    💡 Ideation
                  </h3>
                  <Textarea 
                    {...regEdit("ideation")} 
                    placeholder="Ideas, angles, brainstorm..." 
                    className="min-h-[100px] resize-y text-base bg-muted/20 border-border/50 focus-visible:ring-1" 
                  />
                </div>

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    🔗 Reference Links
                  </h3>
                  <div className="space-y-3">
                    {editRefLinks.map((field, index) => (
                      <div key={field.id} className="flex gap-3 items-center group">
                        <Input 
                          placeholder="Label (e.g. Competitor Reel)" 
                          {...regEdit(`referenceLinks.${index}.label` as never)} 
                          className="max-w-[250px] bg-muted/20"
                        />
                        <Input 
                          placeholder="https://..." 
                          {...regEdit(`referenceLinks.${index}.url` as never)} 
                          className="flex-1 bg-muted/20"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeEditRef(index)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => appendEditRef({ label: "", url: "" } as any)} className="text-muted-foreground hover:text-foreground">
                      <Plus className="h-4 w-4 mr-2" /> Add Reference Link
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    💬 Caption
                  </h3>
                  <Textarea 
                    {...regEdit("caption")} 
                    placeholder="Write your post caption..." 
                    className="min-h-[120px] resize-y text-base bg-muted/20 border-border/50 focus-visible:ring-1" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setViewPost(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Calendar with Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Select Client</Label>
              <Select value={shareClientId} onValueChange={(val) => setShareClientId(val as string)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose client to share..." />
                </SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Label (Optional)</Label>
              <Input value={shareLabel} onChange={(e: any) => setShareLabel(e.target.value)} placeholder="e.g. June 2026 Content" />
            </div>

            {generatedShare && (
              <div className="pt-4 mt-4 border-t border-border space-y-2">
                <Label>Generated Link</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={`${window.location.origin}/share/calendar/${generatedShare.shareToken}`} className="bg-muted/50 font-mono text-xs" />
                  <Button variant="secondary" size="icon" onClick={copyShareLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShareOpen(false); setGeneratedShare(null); }}>Close</Button>
            <Button onClick={generateShareLink} disabled={!shareClientId || createShareMutation.isPending}>
              Generate Share Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
