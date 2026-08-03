import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar as CalendarIcon, Instagram, Youtube, Facebook, Linkedin,
  CheckCircle2, XCircle, MessageSquare, AlertTriangle, Plus, Send,
  Clock, Sparkles, ExternalLink, Paperclip, Tag, ChevronLeft, ChevronRight,
  FileText, Check, X, ShieldAlert, Image as ImageIcon, Video, Layers
} from "lucide-react";
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PublicCalendarDialogs } from "@/components/calendar/public-calendar-dialogs";
import { getPostDateKey } from "@/components/content/content-constants";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IDEA: { label: "Idea", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200" },
  SCRIPTING: { label: "Scripting", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200" },
  DESIGNING: { label: "Designing", className: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-200" },
  IN_REVIEW: { label: "In Review", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200" },
  ADMIN_APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200" },
  SCHEDULED: { label: "Scheduled", className: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200" },
  PUBLISHED: { label: "Published", className: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300 border-green-200" },
};

const APPROVAL_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300", icon: <XCircle className="h-3.5 w-3.5" /> },
  NEEDS_CHANGES: { label: "Changes Requested", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  PENDING: { label: "Pending Approval", className: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300", icon: <Clock className="h-3.5 w-3.5" /> },
};

const PLATFORM_ICON: Record<string, React.ReactNode> = {
  INSTAGRAM: <Instagram className="h-4 w-4 text-pink-500" />,
  YOUTUBE: <Youtube className="h-4 w-4 text-red-500" />,
  FACEBOOK: <Facebook className="h-4 w-4 text-blue-600" />,
  LINKEDIN: <Linkedin className="h-4 w-4 text-blue-700" />,
  TIKTOK: <span className="h-4 w-4 text-[10px] font-black leading-none flex items-center justify-center bg-black text-white rounded">TK</span>,
  TWITTER: <span className="h-4 w-4 text-[11px] font-black leading-none flex items-center justify-center bg-slate-900 text-white rounded">𝕏</span>,
  PINTEREST: <span className="h-4 w-4 text-[11px] font-bold leading-none text-red-600 flex items-center justify-center">P</span>,
};

const CATEGORY_OPTIONS = [
  "Caption",
  "Creative / Image",
  "Video / Reel",
  "Schedule Date / Time",
  "Platform",
  "Hashtags / Tags",
  "Call to Action (CTA)",
  "Campaign Goal",
  "Other",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SharedCalendarData {
  label: string;
  clientId: string;
  clientName: string;
  clientLogo?: string | null;
  expiresAt?: string | null;
  posts: any[];
}

export default function PublicCalendarPage({ params }: { params: { shareToken: string } }) {
  const { shareToken } = params;
  const [data, setData] = useState<SharedCalendarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Client Detail View Modal
  const [viewPost, setViewPost] = useState<any | null>(null);
  const [hoveredPost, setHoveredPost] = useState<any | null>(null);

  // Request Changes Modal
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeForm, setChangeForm] = useState({
    subject: "",
    category: "Caption",
    description: "",
    priority: "NORMAL",
    attachmentUrl: "",
  });
  const [isSubmittingChange, setIsSubmittingChange] = useState(false);

  // Reject Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Suggest Ideas Modal
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [ideaForm, setIdeaForm] = useState({
    title: "",
    description: "",
    platform: "INSTAGRAM",
    contentType: "POST",
    category: "General",
  });
  const [isSubmittingIdea, setIsSubmittingIdea] = useState(false);

  // Status mutation state
  const [isSubmittingApprove, setIsSubmittingApprove] = useState(false);

  const fetchCalendar = () => {
    setIsLoading(true);
    fetch(`/public/calendar/${shareToken}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 410) throw new Error("This share link has expired or been revoked.");
          throw new Error("Could not load shared content calendar. The link may be invalid.");
        }
        return res.json();
      })
      .then((d) => {
        setData(d);
        setIsLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchCalendar();
  }, [shareToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Content Calendar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-border p-8 text-center space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold font-heading">Link Unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="w-full mt-2" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfWeek = getDay(startOfMonth(currentMonth));

  // Organize posts by date key (yyyy-MM-dd)
  const postsByDay: Record<string, any[]> = {};
  (data.posts ?? []).forEach((p) => {
    if (p.scheduledAt) {
      const dateKey = getPostDateKey(p.scheduledAt);
      if (dateKey) {
        if (!postsByDay[dateKey]) postsByDay[dateKey] = [];
        postsByDay[dateKey]!.push(p);
      }
    }
  });

  // Extract Hashtags from caption if available
  const extractHashtags = (caption?: string | null) => {
    if (!caption) return [];
    const tags = caption.match(/#[a-zA-Z0-9_]+/g);
    return tags ? Array.from(new Set(tags)) : [];
  };

  // Approval Handlers
  const handleApprove = async (postId: string) => {
    setIsSubmittingApprove(true);
    try {
      const res = await fetch(`/public/calendar/${shareToken}/approve/${postId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to approve content");
      const updated = await res.json();
      toast.success("Content approved successfully!");
      
      // Update local data
      setData((prev) => prev ? {
        ...prev,
        posts: prev.posts.map((p) => p.id === postId ? updated : p),
      } : null);
      if (viewPost?.id === postId) setViewPost(updated);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve content");
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewPost) return;
    setIsSubmittingChange(true);
    try {
      const res = await fetch(`/public/calendar/${shareToken}/request-changes/${viewPost.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeForm),
      });
      if (!res.ok) throw new Error("Failed to submit change request");
      const updated = await res.json();
      toast.success("Change request submitted to the agency team!");
      
      setData((prev) => prev ? {
        ...prev,
        posts: prev.posts.map((p) => p.id === viewPost.id ? updated : p),
      } : null);
      if (viewPost?.id === viewPost.id) setViewPost(updated);
      setShowChangeModal(false);
      setChangeForm({ subject: "", category: "Caption", description: "", priority: "NORMAL", attachmentUrl: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit change request");
    } finally {
      setIsSubmittingChange(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewPost) return;
    setIsSubmittingReject(true);
    try {
      const res = await fetch(`/public/calendar/${shareToken}/reject/${viewPost.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error("Failed to submit rejection");
      const updated = await res.json();
      toast.success("Rejection recorded and agency notified.");
      
      setData((prev) => prev ? {
        ...prev,
        posts: prev.posts.map((p) => p.id === viewPost.id ? updated : p),
      } : null);
      if (viewPost?.id === viewPost.id) setViewPost(updated);
      setShowRejectModal(false);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to record rejection");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingIdea(true);
    try {
      const res = await fetch(`/public/calendar/${shareToken}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ideaForm),
      });
      if (!res.ok) throw new Error("Failed to submit content idea");
      const newPost = await res.json();
      toast.success("Idea submitted! Agency team has been notified.");

      setData((prev) => prev ? {
        ...prev,
        posts: [...prev.posts, newPost],
      } : null);
      setShowIdeaModal(false);
      setIdeaForm({ title: "", description: "", platform: "INSTAGRAM", contentType: "POST", category: "General" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit content idea");
    } finally {
      setIsSubmittingIdea(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* ─── Top Header ────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {data.clientLogo ? (
              <img src={data.clientLogo} alt={data.clientName} className="h-10 w-10 rounded-xl object-cover border border-border" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-lg border border-primary/20">
                {data.clientName.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading">{data.clientName}</h1>
                <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 font-medium border-slate-300">Client Portal</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.label} • {data.posts?.length ?? 0} total posts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Month Selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-border">
              <button
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold px-2 min-w-[110px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Suggest Idea Button */}
            <Button
              onClick={() => setShowIdeaModal(true)}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm btn-micro-anim text-xs sm:text-sm"
            >
              <Sparkles className="h-4 w-4" />
              Suggest Idea
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main Calendar View ───────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Helper Banner */}
        <div className="bg-white dark:bg-slate-900 border border-border rounded-xl p-4 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Interactive Client Content Calendar</p>
              <p className="text-xs text-muted-foreground">
                Hover over dates for a quick preview, or click any scheduled item to view creative details and provide feedback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Approved
            </span>
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending Review
            </span>
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Changes Requested
            </span>
          </div>
        </div>

        {/* ─── Calendar Grid ─────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden">
          {/* Header Days of Week */}
          <div className="grid grid-cols-7 border-b border-border bg-slate-50 dark:bg-slate-800/50">
            {DAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7">
            {/* Empty Offset Days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[120px] sm:min-h-[140px] border-b border-r border-border/60 bg-slate-50/50 dark:bg-slate-900/30" />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day), "yyyy-MM-dd");
              const dayPosts = postsByDay[dateStr] ?? [];
              const hasPosts = dayPosts.length > 0;

              return (
                <div
                  key={day}
                  className={cn(
                    "min-h-[120px] sm:min-h-[140px] border-b border-r border-border/60 p-2 relative flex flex-col justify-start transition-colors",
                    hasPosts ? "bg-white dark:bg-slate-900" : "bg-slate-50/20 dark:bg-slate-900/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full inline-block",
                        hasPosts
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground"
                      )}
                    >
                      {day}
                    </span>
                    {hasPosts && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {dayPosts.length} {dayPosts.length === 1 ? "post" : "posts"}
                      </span>
                    )}
                  </div>

                  {/* Scheduled Posts */}
                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[100px] scrollbar-none">
                    {dayPosts.map((post) => {
                      const appConfig = APPROVAL_CONFIG[post.approvalStatus ?? "PENDING"] ?? APPROVAL_CONFIG.PENDING;
                      const platformIcon = PLATFORM_ICON[post.platform ?? "INSTAGRAM"] || <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />;

                      return (
                        <div
                          key={post.id}
                          onClick={() => setViewPost(post)}
                          onMouseEnter={() => setHoveredPost(post)}
                          onMouseLeave={() => setHoveredPost(null)}
                          className={cn(
                            "group/item relative p-1.5 rounded-lg border text-xs cursor-pointer transition-all duration-200 hover:shadow-md",
                            post.approvalStatus === "APPROVED"
                              ? "bg-emerald-50/80 hover:bg-emerald-100/90 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"
                              : post.approvalStatus === "NEEDS_CHANGES" || post.approvalStatus === "REJECTED"
                              ? "bg-amber-50/80 hover:bg-amber-100/90 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
                              : "bg-blue-50/80 hover:bg-blue-100/90 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 truncate">
                              {platformIcon}
                              <span className="font-semibold text-[11px] truncate text-slate-800 dark:text-slate-100">
                                {post.title || post.caption?.slice(0, 22) || post.contentType}
                              </span>
                            </div>
                            <span className="shrink-0">{appConfig.icon}</span>
                          </div>

                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px] text-muted-foreground">
                            <span className="truncate uppercase tracking-wider font-semibold">{post.contentType || "POST"}</span>
                            {post.scheduledAt && (
                              <span>{format(new Date(post.scheduledAt), "hh:mm a")}</span>
                            )}
                          </div>

                          {/* Hover Preview Tooltip Card */}
                          {hoveredPost?.id === post.id && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 z-50 pointer-events-none animated-fade-in space-y-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 font-bold">
                                  {platformIcon}
                                  <span>{post.platform}</span>
                                </div>
                                <Badge variant="outline" className="text-[9px] bg-slate-800 border-slate-700 text-slate-300">
                                  {post.contentType}
                                </Badge>
                              </div>
                              <p className="font-semibold text-xs text-slate-100 line-clamp-1">{post.title || "Scheduled Post"}</p>
                              {post.caption && <p className="text-[11px] text-slate-300 line-clamp-2 italic">"{post.caption}"</p>}
                              <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                                <span>Status: {appConfig.label}</span>
                                <span>Click to inspect</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ─── Calendar Dialogs ─── */}
      <PublicCalendarDialogs
        viewPost={viewPost}
        setViewPost={setViewPost}
        approvalConfig={APPROVAL_CONFIG}
        platformIcon={PLATFORM_ICON}
        extractHashtags={extractHashtags}
        handleApprove={handleApprove}
        isSubmittingApprove={isSubmittingApprove}

        showChangeModal={showChangeModal}
        setShowChangeModal={setShowChangeModal}
        changeForm={changeForm}
        setChangeForm={setChangeForm}
        handleRequestChanges={handleRequestChanges}
        isSubmittingChange={isSubmittingChange}
        categoryOptions={CATEGORY_OPTIONS}

        showRejectModal={showRejectModal}
        setShowRejectModal={setShowRejectModal}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        handleReject={handleReject}
        isSubmittingReject={isSubmittingReject}

        showIdeaModal={showIdeaModal}
        setShowIdeaModal={setShowIdeaModal}
        ideaForm={ideaForm}
        setIdeaForm={setIdeaForm}
        handleSubmitIdea={handleSubmitIdea}
        isSubmittingIdea={isSubmittingIdea}
      />
    </div>
  );
}
