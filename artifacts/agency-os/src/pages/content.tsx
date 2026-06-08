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
  Instagram, Youtube, Facebook, Linkedin,
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
      onSuccess: () => {
        toast.success("Post created");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create post"),
    },
  });

  const deleteMutation = useDeleteContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Post deleted");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
      },
    },
  });

  const updateMutation = useUpdateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Status updated");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
      },
    },
  });

  const { register, handleSubmit, control, reset } = useForm<ContentPostInput>({
    defaultValues: {
      platform: "INSTAGRAM",
      contentType: "POST",
      status: "IDEA",
      clientId: selectedClientId,
    },
  });

  const openAdd = () => {
    reset({ platform: "INSTAGRAM", contentType: "POST", status: "IDEA", clientId: selectedClientId });
    setDialogOpen(true);
  };

  const onSubmit = (data: ContentPostInput) => {
    createMutation.mutate({ data });
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

  return (
    <div className="p-6 animated-fade-in space-y-5">
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
          <Button onClick={openAdd} className="gap-2 btn-micro-anim" data-testid="add-post-btn">
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
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-48" data-testid="content-client-filter">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All clients</SelectItem>
            {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

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
            </div>
          ) : (
            (posts ?? []).map((post) => {
              const sc = STATUS_CONFIG[post.status ?? "IDEA"];
              return (
                <Card key={post.id} className="scale-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 shrink-0">
                          {PLATFORM_ICON[post.platform ?? "INSTAGRAM"]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[11px]">{post.contentType}</Badge>
                            <Badge variant="secondary" className={cn("text-[11px]", sc.className)}>{sc.label}</Badge>
                            {post.scheduledAt && (
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(post.scheduledAt), "dd MMM, EEE")}
                              </span>
                            )}
                          </div>
                          {post.caption && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.caption}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={post.status ?? "IDEA"}
                          onValueChange={(v) => updateMutation.mutate({ id: post.id, data: { status: v } })}
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: post.id })}
                        >
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
        /* Calendar grid */
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Content Post</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Controller control={control} name="platform" render={({ field }) => (
                  <Select value={field.value ?? "INSTAGRAM"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="YOUTUBE">YouTube</SelectItem>
                      <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
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
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Controller control={control} name="status" render={({ field }) => (
                  <Select value={field.value ?? "IDEA"} onValueChange={field.onChange}>
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
                <Label>Scheduled Date</Label>
                <Input {...register("scheduledAt")} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea {...register("caption")} rows={4} placeholder="Post caption..." data-testid="caption-input" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-post-btn">
                Create Post
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
