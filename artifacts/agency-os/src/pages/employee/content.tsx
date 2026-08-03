import { useState } from "react";
import { useListContentPosts, useUpdateContentPost, getListContentPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchBar } from "@/components/common/SearchBar";
import { Calendar, Clock, FileText, Upload, ArrowRight, Eye, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn, formatDateOnly } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  UNDER_REVIEW: { label: "Under Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  SCHEDULED: { label: "Scheduled", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  PUBLISHED: { label: "Published", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
};

export default function EmployeeContentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("INSTAGRAM");
  const [status, setStatus] = useState("DRAFT");

  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: posts, isLoading } = useListContentPosts({
    month: currentMonth,
  } as any);

  // Filter posts assigned to employee
  const myPosts = (posts ?? []).filter((p: any) =>
    p.assigneeId === user?.id ||
    p.authorId === user?.id ||
    p.assignedTo === user?.id ||
    p.assignedTo === user?.name
  );

  const isFullAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(user?.systemRole || user?.role);
  const isDelegatedAdmin = Boolean(user?.isDelegatedAdmin);
  const userAllowedModules = Array.isArray(user?.allowedModules) ? user.allowedModules : [];

  const canApprovePublishContent = isFullAdmin || (isDelegatedAdmin && (userAllowedModules.length === 0 || userAllowedModules.includes("content")));

  const displayPosts = canApprovePublishContent
    ? (posts ?? [])
    : (myPosts.length > 0 ? myPosts : (posts ?? []).filter((p: any) => p.assigneeId === user?.id || p.authorId === user?.id || p.assignedTo === user?.id || p.assignedTo === user?.name));

  const updatePostMutation = useUpdateContentPost({
    mutation: {
      onSuccess: () => {
        toast.success("Content post updated successfully");
        qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
        setSelectedPost(null);
      },
      onError: () => toast.error("Failed to update post"),
    },
  });

  const openPostModal = (post: any) => {
    setSelectedPost(post);
    setTitle(post.title || "");
    setContent(post.content || "");
    setPlatform(post.platform || "INSTAGRAM");
    setStatus(post.status || "DRAFT");
  };

  const handleSave = () => {
    if (!selectedPost) return;
    updatePostMutation.mutate({
      id: selectedPost.id,
      data: {
        title,
        content,
        platform,
        status: (status === "APPROVED" || status === "PUBLISHED") && !canApprovePublishContent ? "UNDER_REVIEW" : status, // Employees submit for review unless Special Access is enabled
      } as any,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> My Content Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Prepare, edit drafts, and submit assigned social media content for review
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SearchBar
            placeholder="Search content posts…"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-28" /></CardContent></Card>
          ))}
        </div>
      ) : displayPosts.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl p-8">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <Calendar className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No assigned content posts</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            There are no social content posts assigned to you for this period.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayPosts.map((p: any) => {
            const statusConfig = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT;
            return (
              <Card
                key={p.id}
                className="scale-hover border border-border/80 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => openPostModal(p)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
                        {p.title || "Untitled Post"}
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                        {p.platform}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] uppercase font-semibold shrink-0", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {p.content && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">"{p.content}"</p>
                  )}

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/40 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> Scheduled: {p.scheduledAt ? formatDateOnly(p.scheduledAt) : "Unscheduled"}
                    </span>
                    <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                      Edit Draft <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Draft Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          {selectedPost && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                  <FileText className="h-5 w-5 text-primary" /> Edit Draft Content
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold">Post Title / Topic</Label>
                  <Textarea
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    rows={1}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTAGRAM" className="text-xs">Instagram</SelectItem>
                      <SelectItem value="LINKEDIN" className="text-xs">LinkedIn</SelectItem>
                      <SelectItem value="FACEBOOK" className="text-xs">Facebook</SelectItem>
                      <SelectItem value="TWITTER" className="text-xs">Twitter / X</SelectItem>
                      <SelectItem value="YOUTUBE" className="text-xs">YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Post Caption / Copy</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    placeholder="Draft post copy..."
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Status Action</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT" className="text-xs">Draft (In Progress)</SelectItem>
                      <SelectItem value="UNDER_REVIEW" className="text-xs">Submit for Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPost(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updatePostMutation.isPending}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
