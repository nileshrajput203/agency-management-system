import React, { useState, useRef, useEffect } from "react";
import {
  Check, CheckCircle2, AlertTriangle, XCircle, Play, Pause, RotateCcw,
  Volume2, VolumeX, Maximize2, Sparkles, Share2, Send, Clock, ArrowLeft,
  ArrowRight, Upload, Download, FileText, Camera, Scissors, Eye, Layers,
  Film, Grid, Columns, User, Users, Pin, MapPin, Calendar, Hash,
  ExternalLink, MessageSquare, ChevronDown, ChevronRight, ChevronLeft, Zap, RefreshCw,
  Plus, Trash2, Sliders, CheckSquare, Square, CornerDownLeft, Search
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/App";
import { isManagerOrAdminRole } from "@/lib/permissions";
import { STATUS_CONFIG, PLATFORM_ICON, PostRecord, isNeedsRevision } from "./content-constants";

interface UserOption {
  id: string;
  name: string;
  systemRole?: string;
  department?: string;
}

interface ClientOption {
  id: string;
  companyName: string;
}

interface Props {
  posts: PostRecord[];
  clients: ClientOption[];
  users?: UserOption[];
  onRefresh: () => void;
  onOpenEdit: (post: PostRecord) => void;
}

export function parseMediaUrl(url?: string | null): {
  type: "video" | "image" | "gdrive" | "iframe" | "unknown";
  streamUrl: string;
  previewUrl: string;
  rawUrl: string;
} {
  if (!url) return { type: "unknown", streamUrl: "", previewUrl: "", rawUrl: "" };
  const clean = url.trim();

  // Google Drive
  const gdriveMatch = clean.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
  if (gdriveMatch) {
    const fileId = gdriveMatch[1];
    return {
      type: "gdrive",
      streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      rawUrl: clean,
    };
  }

  // Dropbox direct streaming
  if (clean.includes("dropbox.com")) {
    const directUrl = clean.replace(/(\?|&)dl=[01]/, "$1raw=1").replace(/\?raw=1&/, "?").replace(/\?$/, "");
    const finalStream = directUrl.includes("raw=1") ? directUrl : `${directUrl}${directUrl.includes("?") ? "&" : "?"}raw=1`;
    return {
      type: "video",
      streamUrl: finalStream,
      previewUrl: finalStream,
      rawUrl: clean,
    };
  }

  // YouTube embed
  const ytMatch = clean.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) {
    return {
      type: "iframe",
      streamUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`,
      previewUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      rawUrl: clean,
    };
  }

  // Vimeo embed
  const vimeoMatch = clean.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch) {
    return {
      type: "iframe",
      streamUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      previewUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      rawUrl: clean,
    };
  }

  const isVideoExt = /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(clean);
  const isImageExt = /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(clean);

  if (isVideoExt) {
    return { type: "video", streamUrl: clean, previewUrl: clean, rawUrl: clean };
  }
  if (isImageExt) {
    return { type: "image", streamUrl: clean, previewUrl: clean, rawUrl: clean };
  }

  return { type: "unknown", streamUrl: clean, previewUrl: clean, rawUrl: clean };
}

export function PCApprovalStudio({ posts, clients, users = [], onRefresh, onOpenEdit }: Props) {
  const { user } = useAuth();
  const isManagerOrAdmin = isManagerOrAdminRole(user);

  // Selected post in studio
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Discover available months from posts for month-wise browsing
  const availableMonths = Array.from(
    new Set(
      posts
        .map((p) => (p.scheduledAt ? p.scheduledAt.substring(0, 7) : null))
        .filter(Boolean) as string[]
    )
  ).sort().reverse();

  // Left pane filters (month-wise)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (availableMonths.length > 0) return availableMonths[0];
    return format(new Date(), "yyyy-MM");
  });
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [clientFilter, setClientFilter] = useState<string>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Check if post is within 2 days of scheduled posting date (upcoming 1-2 days)
  const isWithinApprovalWindow = (scheduledAt?: string | null) => {
    if (!scheduledAt) return false;
    const postDate = new Date(scheduledAt);
    const now = new Date();
    const diffDays = Math.ceil((postDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 2;
  };

  const isOverdueApproval = (post: any) => {
    if (!post?.scheduledAt) return false;
    const postDate = new Date(post.scheduledAt);
    const now = new Date();
    const diffDays = Math.ceil((postDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays < 0 && !["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED", "POSTED"].includes(post.status);
  };

  // Filter posts month-wise (if ALL, shows all months)
  const monthPosts = selectedMonth === "ALL"
    ? posts
    : posts.filter((p) => {
        const rawDate = p.scheduledAt || p.shootDate || p.createdAt;
        if (!rawDate) return false;
        const dateStr = typeof rawDate === "string" ? rawDate : new Date(rawDate).toISOString();
        return dateStr.slice(0, 7) === selectedMonth;
      });

  // Center pane view mode
  const [centerMode, setCenterMode] = useState<"PLAYER" | "COMPARE" | "BRIEF" | "SHOTS" | "GRID">("PLAYER");

  // Video player controls & frame pin proofing
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showSafeZoneOverlay, setShowSafeZoneOverlay] = useState(false);
  const [externalAssetUrl, setExternalAssetUrl] = useState("");

  // Pin annotation on video frame
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number; timeSec: number } | null>(null);
  const [pinComment, setPinComment] = useState("");

  // Right pane decision & revision
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionTargetRole, setRevisionTargetRole] = useState<"EDITOR" | "VIDEOGRAPHER" | "STRATEGIST">("EDITOR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fast-track & teleprompter modals
  const [showFastTrackModal, setShowFastTrackModal] = useState(false);
  const [showTeleprompterModal, setShowTeleprompterModal] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(2);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(32);
  const [teleprompterPlaying, setTeleprompterPlaying] = useState(false);
  const teleprompterScrollRef = useRef<HTMLDivElement | null>(null);

  // Direct media upload on preview card
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Fast-track upload state
  const [fastTrackClient, setFastTrackClient] = useState("");
  const [fastTrackPlatform, setFastTrackPlatform] = useState("INSTAGRAM");
  const [fastTrackFormat, setFastTrackFormat] = useState("REEL");
  const [fastTrackFiles, setFastTrackFiles] = useState<Array<{ title: string; url: string; caption: string }>>([
    { title: "", url: "", caption: "" }
  ]);

  // AI Script Modal
  const [showAiScriptModal, setShowAiScriptModal] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // 3x3 Grid Pagination
  const [gridPage, setGridPage] = useState(0);

  // Filter queue items (month-wise + workflow stage + client + platform + search)
  const filteredPosts = monthPosts.filter((p) => {
    // Stage filtering
    if (stageFilter === "ALL") {
      // show all posts in this month's pipeline
    } else if (stageFilter === "NEEDS_APPROVAL") {
      // Posts in review OR pending manager review OR coming up in 1-2 days without manager approval!
      const isUrgentDue = isWithinApprovalWindow(p.scheduledAt) && p.internalApprovalStatus !== "APPROVED";
      const isInternalPending = p.internalApprovalStatus === "PENDING" && !["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(p.status || "");
      if (p.status !== "IN_REVIEW" && !isInternalPending && !isUrgentDue) return false;
    } else if (stageFilter === "REVISIONS") {
      if (!isNeedsRevision(p.needsRevision) && p.internalApprovalStatus !== "CHANGES_REQUESTED" && p.approvalStatus !== "NEEDS_CHANGES") return false;
    } else if (stageFilter === "IDEATION_SHOOT") {
      if (!["IDEA", "SCRIPTING", "SHOOTING"].includes(p.status || "")) return false;
    } else if (stageFilter === "EDITING") {
      if (!["PRODUCTION", "DESIGNING"].includes(p.status || "")) return false;
    } else if (stageFilter === "APPROVED_SCHEDULED") {
      if (!["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(p.status || "")) return false;
    }

    if (clientFilter !== "ALL" && p.clientId !== clientFilter) return false;
    if (platformFilter !== "ALL" && p.platform !== platformFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        p.title?.toLowerCase().includes(q) ||
        p.conceptHook?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.caption?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Calculate month-wise stage counts
  const countAll = monthPosts.length;
  const countNeedsReview = monthPosts.filter(p =>
    p.status === "IN_REVIEW" ||
    (p.internalApprovalStatus === "PENDING" && !["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(p.status || "")) ||
    (isWithinApprovalWindow(p.scheduledAt) && p.internalApprovalStatus !== "APPROVED")
  ).length;
  const countRevisions = monthPosts.filter(p =>
    isNeedsRevision(p.needsRevision) || p.internalApprovalStatus === "CHANGES_REQUESTED" || p.approvalStatus === "NEEDS_CHANGES"
  ).length;
  const countShootBriefs = monthPosts.filter(p =>
    ["IDEA", "SCRIPTING", "SHOOTING"].includes(p.status || "")
  ).length;
  const countEditing = monthPosts.filter(p =>
    ["PRODUCTION", "DESIGNING"].includes(p.status || "")
  ).length;
  const countApprovedScheduled = monthPosts.filter(p =>
    ["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(p.status || "")
  ).length;

  // Keep a selected post
  const activePost = filteredPosts.find((p) => p.id === selectedPostId) || filteredPosts[0] || monthPosts.find((p) => p.id === selectedPostId) || monthPosts[0] || null;

  useEffect(() => {
    if (activePost && !selectedPostId) {
      setSelectedPostId(activePost.id);
    }
  }, [activePost, selectedPostId]);

  // Reset temporary state when changing active post
  useEffect(() => {
    if (activePost) {
      setActiveSlide(0);
      setPendingPin(null);
      setRevisionNote("");
      setExternalAssetUrl("");
    }
  }, [activePost?.id]);

  // Keyboard navigation: J (next), K (prev), Space (play/pause), A (approve)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys if typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const currIdx = filteredPosts.findIndex((p) => p.id === activePost?.id);
        if (currIdx < filteredPosts.length - 1) {
          setSelectedPostId(filteredPosts[currIdx + 1].id);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const currIdx = filteredPosts.findIndex((p) => p.id === activePost?.id);
        if (currIdx > 0) {
          setSelectedPostId(filteredPosts[currIdx - 1].id);
        }
      } else if (e.code === "Space" && centerMode === "PLAYER") {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      } else if (e.key === "a" || e.key === "A") {
        if (activePost) {
          if (!isManagerOrAdmin) {
            toast.error("Content approval can only be done by a manager or administrator.");
          } else {
            handleApproveInternally();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredPosts, activePost, centerMode, isManagerOrAdmin]);

  // Teleprompter autoscroll loop
  useEffect(() => {
    let interval: any;
    if (showTeleprompterModal && teleprompterPlaying && teleprompterScrollRef.current) {
      interval = setInterval(() => {
        if (teleprompterScrollRef.current) {
          teleprompterScrollRef.current.scrollTop += teleprompterSpeed;
        }
      }, 30);
    }
    return () => clearInterval(interval);
  }, [showTeleprompterModal, teleprompterPlaying, teleprompterSpeed]);

  // Video time formatting (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Video frame pin click
  const handleFrameClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const timeSec = Math.round(videoRef.current.currentTime);

    // Pause video on pin placement
    videoRef.current.pause();
    setIsPlaying(false);

    setPendingPin({ x, y, timeSec });
    const formatted = formatTime(timeSec);
    setRevisionNote((prev) => (prev ? `${prev} \n@${formatted} [Pin at ${x}%, ${y}%]: ` : `@${formatted} [Pin at ${x}%, ${y}%]: `));
    toast.info(`Pin dropped at ${formatted}! Add your feedback in the revision box.`);
  };

  // Seek video to exact second
  const seekVideo = (timeSec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSec;
      setCurrentTime(timeSec);
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Step 1: Manager Internal Approval (done first before client)
  const handleApproveInternally = async () => {
    if (!activePost) return;
    if (!isManagerOrAdmin) {
      toast.error("Content approval can only be done by a manager or administrator.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/content/${activePost.id}/internal-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Internal approval failed");
      }
      toast.success("✓ Internally approved by Manager! Ready for client review.");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve internally");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Client Approval (confirmed after Manager approval)
  const handleClientApprove = async () => {
    if (!activePost) return;
    if (!isManagerOrAdmin) {
      toast.error("Content approval can only be done by a manager or administrator.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/content/${activePost.id}/client-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Client approval failed");
      }
      toast.success("🎉 Client approval confirmed! Post is scheduled.");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm client approval");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scan & notify managers for upcoming posts (1-2 days before scheduled date)
  const handleCheckUpcomingApprovals = async () => {
    try {
      const res = await fetch("/api/content/check-upcoming-approvals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}`,
        },
      });
      const data = await res.json();
      if (data.totalUrgent > 0) {
        toast.info(`🔔 Found ${data.totalUrgent} post(s) needing Manager Approval within 1-2 days! Notifications dispatched to Managers.`);
        setStageFilter("NEEDS_APPROVAL");
      } else {
        toast.success("All posts scheduled within 1-2 days have been approved by manager!");
      }
      onRefresh();
    } catch {
      toast.error("Failed to check upcoming approvals");
    }
  };

  // 1-Click Approve & Share with Client
  const handleApproveAndShare = async () => {
    if (!activePost) return;
    if (!isManagerOrAdmin) {
      toast.error("Content approval can only be done by a manager or administrator.");
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Approve internally first if not already
      if (activePost.internalApprovalStatus !== "APPROVED") {
        await fetch(`/api/content/${activePost.id}/internal-approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        });
      }

      // 2. Fetch or generate client share link
      let shareUrl = "";
      if (activePost.clientId) {
        const shareRes = await fetch("/api/content/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
          body: JSON.stringify({ clientId: activePost.clientId, label: `${activePost.clientName || "Client"} Calendar` }),
        });
        const shareData = await shareRes.json();
        if (shareData?.shareToken) {
          shareUrl = `${window.location.origin}/?token=${shareData.shareToken}`;
        }
      }

      if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl).catch(() => {});
        toast.success("Post approved & client share link copied to clipboard!");
      } else {
        toast.success("Post approved!");
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve and share");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Changes & Smart Routing
  const handleRouteRevision = async (targetRole: "EDITOR" | "VIDEOGRAPHER" | "STRATEGIST") => {
    if (!activePost) return;
    if (!revisionNote.trim()) {
      toast.warning("Please type your feedback or revision notes first");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/content/${activePost.id}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({
          action: "ROUTE_REVISION",
          payload: {
            targetRole,
            revisionNote,
            timestampSec: pendingPin?.timeSec || (currentTime ? Math.round(currentTime) : null),
            frameCoordX: pendingPin?.x || null,
            frameCoordY: pendingPin?.y || null,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to route revision");
      toast.success(`Revision routed to ${targetRole === "EDITOR" ? "Video Editor" : targetRole === "VIDEOGRAPHER" ? "Videographer" : "Strategist"}!`);
      setRevisionNote("");
      setPendingPin(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to route revision");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle QC Checklist item
  const toggleQcItem = async (key: string) => {
    if (!activePost) return;
    const currentQc = activePost.qcChecklist || {};
    const updatedQc = { ...currentQc, [key]: !currentQc[key] };

    try {
      await fetch(`/api/content/${activePost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ qcChecklist: updatedQc }),
      });
      onRefresh();
    } catch {
      toast.error("Failed to update QC check");
    }
  };

  // 1-Click Pass All QC items
  const handlePassAllQc = async () => {
    if (!activePost) return;
    const allPass = {
      hookChecked: true,
      brandGuidelinesMatched: true,
      subtitlesVerified: true,
      safeZoneChecked: true,
      audioBalanced: true,
      ctaIncluded: true,
    };
    try {
      await fetch(`/api/content/${activePost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ qcChecklist: allPass }),
      });
      toast.success("All QC checklist items passed!");
      onRefresh();
    } catch {
      toast.error("Failed to pass QC items");
    }
  };

  // Direct save of external asset link (Drive / Dropbox / Frame.io)
  const handleSaveExternalLink = async () => {
    if (!activePost || !externalAssetUrl.trim()) return;
    try {
      const url = externalAssetUrl.trim();
      await fetch(`/api/content/${activePost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({
          assetsLink: url,
          mediaUrls: [url],
          status: activePost.status === "IDEA" ? "PRODUCTION" : activePost.status,
        }),
      });
      toast.success("Asset link attached!");
      setExternalAssetUrl("");
      onRefresh();
    } catch {
      toast.error("Failed to attach asset link");
    }
  };

  // Batch Approval
  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!isManagerOrAdmin) {
      toast.error("Content approval can only be done by a manager or administrator.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/content/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Batch approval failed");
      }
      toast.success(`Approved ${selectedIds.length} post(s) successfully!`);
      setSelectedIds([]);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Batch approval failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Script Generation Handler
  const handleGenerateAiScript = async () => {
    if (!activePost) return;
    setAiLoading(true);
    try {
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
      const topicStr = aiTopic || activePost.title || "Brand Story";
      const brandStr = activePost.clientName || "BlinkBeyond Client";
      const platformStr = activePost.platform || "INSTAGRAM";
      const formatStr = activePost.format || activePost.contentType || "REEL";

      let generatedData: any = null;

      try {
        const res = await fetch("/api/content/ai-script-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            topic: topicStr,
            clientName: brandStr,
            platform: platformStr,
            format: formatStr,
          }),
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await res.json();
            if (data?.success) {
              generatedData = data;
            }
          }
        }
      } catch (callErr) {
        console.warn("AI generation API fallback invoked:", callErr);
      }

      // Safe fallback if API was unavailable or returned non-JSON
      if (!generatedData) {
        generatedData = {
          conceptHook: `Stop making this huge mistake if you want to scale ${topicStr}. Here's the 3-step playbook.`,
          scriptBody: `Hook: Stop making this huge mistake if you want to scale ${topicStr}.\n\nPoint 1: Most people start by focusing on vanity metrics, but what actually drives results is consistent, targeted value.\n\nPoint 2: At ${brandStr}, we test 5 variations of creative hooks before spending any ad budget.\n\nCall to Action: Comment "PLAYBOOK" below and we'll DM you the complete framework.`,
          scriptScenes: [
            {
              id: "scene-" + Date.now() + "-1",
              sceneNo: 1,
              timecode: "0:00 - 0:03",
              visualDirection: "Fast zoom-in on presenter holding phone or product, sharp dynamic cut",
              spokenAudio: `Stop making this huge mistake with ${topicStr}!`,
              onScreenText: "STOP DOING THIS 🚨",
            },
            {
              id: "scene-" + Date.now() + "-2",
              sceneNo: 2,
              timecode: "0:03 - 0:12",
              visualDirection: "Cut to B-roll showing behind-the-scenes dashboard or workflow with screen recording overlay",
              spokenAudio: "Most teams waste 80% of their effort here. Here is what actually moves the needle.",
              onScreenText: "THE 80/20 PRINCIPLE 📈",
            },
            {
              id: "scene-" + Date.now() + "-3",
              sceneNo: 3,
              timecode: "0:12 - 0:25",
              visualDirection: "Medium shot with dynamic hands gesture, quick whip pan to product demo",
              spokenAudio: `Implement this 3-step framework we use at ${brandStr} to get 3x more conversions.`,
              onScreenText: "3X CONVERSIONS 🔥",
            },
            {
              id: "scene-" + Date.now() + "-4",
              sceneNo: 4,
              timecode: "0:25 - 0:30",
              visualDirection: "Presenter smiles, points down to caption area with high-energy finish",
              spokenAudio: "Save this reel and comment 'PLAYBOOK' for the free cheat sheet!",
              onScreenText: "COMMENT 'PLAYBOOK' 💬",
            },
          ],
          shotList: [
            {
              id: "shot-" + Date.now() + "-1",
              shotNumber: 1,
              framing: "CLOSE_UP",
              cameraMovement: "STATIC",
              description: "Presenter direct-to-camera intro hook. Sharp eye contact with high energy.",
              lightingAudioNote: "Key light at 45 degrees, lapel mic clipped at center chest",
              isCaptured: false,
              bestTakeNote: "",
            },
            {
              id: "shot-" + Date.now() + "-2",
              shotNumber: 2,
              framing: "B_ROLL",
              cameraMovement: "GIMBAL",
              description: "Smooth push-in on laptop screen showing dashboard metrics / client report.",
              lightingAudioNote: "Natural daylight + soft fill light to reduce screen reflection",
              isCaptured: false,
              bestTakeNote: "",
            },
            {
              id: "shot-" + Date.now() + "-3",
              shotNumber: 3,
              framing: "MEDIUM",
              cameraMovement: "HANDHELD",
              description: "Presenter explaining framework with subtle organic handheld motion.",
              lightingAudioNote: "Consistent warm fill, boom mic overhead",
              isCaptured: false,
              bestTakeNote: "",
            },
            {
              id: "shot-" + Date.now() + "-4",
              shotNumber: 4,
              framing: "TRANSITION",
              cameraMovement: "PAN",
              description: "Fast whip-pan transition from left to right covering the cut.",
              lightingAudioNote: "High shutter speed (1/120s) for crisp motion blur",
              isCaptured: false,
              bestTakeNote: "",
            },
            {
              id: "shot-" + Date.now() + "-5",
              shotNumber: 5,
              framing: "CLOSE_UP",
              cameraMovement: "STATIC",
              description: "Outro CTA: Presenter points down to caption box with friendly smile.",
              lightingAudioNote: "Ring light / softbox front lighting",
              isCaptured: false,
              bestTakeNote: "",
            },
          ],
        };
      }

      // Save directly to the post
      const saveRes = await fetch(`/api/content/${activePost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conceptHook: generatedData.conceptHook,
          scriptBody: generatedData.scriptBody,
          scriptScenes: generatedData.scriptScenes,
          shotList: generatedData.shotList,
        }),
      });

      if (!saveRes.ok) {
        const errJson = await saveRes.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || "Failed to update post with AI script");
      }

      toast.success("AI script, scene breakdown, and shot list generated & saved!");
      setShowAiScriptModal(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate AI script");
    } finally {
      setAiLoading(false);
    }
  };

  // Toggle on-set shot captured checkbox
  const toggleShotCaptured = async (shotId: string) => {
    if (!activePost) return;
    const currentShots = Array.isArray(activePost.shotList) ? [...activePost.shotList] : [];
    const updatedShots = currentShots.map((sh: any) =>
      sh.id === shotId ? { ...sh, isCaptured: !sh.isCaptured } : sh
    );

    try {
      await fetch(`/api/content/${activePost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ shotList: updatedShots }),
      });
      onRefresh();
    } catch {
      toast.error("Failed to update shot status");
    }
  };

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePost) return;
    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const mediaUrl = data.url || data.filePath;

      await fetch(`/api/content/${activePost.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assetsLink: mediaUrl,
          mediaUrls: [mediaUrl],
          coverImageUrl: mediaUrl,
          status: activePost.status === "IDEA" ? "PRODUCTION" : activePost.status,
        }),
      });
      toast.success("Creative asset uploaded & attached!");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload asset");
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Media determination
  const primaryMediaUrl = activePost?.assetsLink || (activePost?.mediaFiles && activePost.mediaFiles[0]) || "";
  const parsedMedia = parseMediaUrl(primaryMediaUrl);
  const isVideo = parsedMedia.type === "video" || parsedMedia.type === "gdrive" || parsedMedia.type === "iframe" || primaryMediaUrl.endsWith(".mp4") || primaryMediaUrl.endsWith(".webm") || primaryMediaUrl.endsWith(".mov") || activePost?.format === "REEL" || activePost?.contentType === "REEL" || activePost?.contentType === "VIDEO";
  const carouselSlides = activePost?.mediaFiles && activePost.mediaFiles.length > 0 ? activePost.mediaFiles : primaryMediaUrl ? [primaryMediaUrl] : [];

  // Pipeline stage index (0 to 4)
  const getStageStep = (status: string = "IDEA") => {
    if (status === "IDEA" || status === "SCRIPTING") return 0;
    if (status === "SHOOTING") return 1;
    if (status === "PRODUCTION" || status === "DESIGNING") return 2;
    if (status === "IN_REVIEW") return 3;
    if (["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(status)) return 4;
    return 0;
  };
  const activeStep = getStageStep(activePost?.status || "IDEA");

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[600px] bg-background border rounded-xl overflow-hidden shadow-xs">
      {/* Hidden file input for Replace Cut and Browse Local File */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDirectUpload}
        className="hidden"
        accept="image/*,video/*,application/pdf"
      />
      {/* ── Top Header Toolbar ── */}
      <div className="h-12 border-b bg-card/60 px-3 sm:px-4 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Film className="h-4 w-4 text-primary shrink-0" />
            <span className="font-bold text-xs sm:text-sm font-heading truncate">PC Approval Studio</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 whitespace-nowrap">
            {filteredPosts.length} {filteredPosts.length === 1 ? "Item" : "Items"} ({selectedMonth === "ALL" ? "All Months" : format(new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]) - 1, 1), "MMM yyyy")})
          </Badge>
          <div className="hidden 2xl:flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap shrink-0 ml-1">
            <kbd className="bg-muted px-1.5 py-0.5 rounded border text-[10px] font-mono whitespace-nowrap">J / ↓</kbd> Next
            <kbd className="bg-muted px-1.5 py-0.5 rounded border text-[10px] font-mono ml-1 whitespace-nowrap">K / ↑</kbd> Prev
            <kbd className="bg-muted px-1.5 py-0.5 rounded border text-[10px] font-mono ml-1 whitespace-nowrap">Space</kbd> Play
            {isManagerOrAdmin && (
              <>
                <kbd className="bg-muted px-1.5 py-0.5 rounded border text-[10px] font-mono ml-1 whitespace-nowrap">A</kbd> Approve
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 1-2 Day Approval Check & Notification Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCheckUpcomingApprovals}
            className="h-7 px-2 text-[11px] border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-medium"
            title="Scan upcoming posts within 1-2 days and notify managers for required approval"
          >
            <Clock className="h-3 w-3 text-amber-500 mr-1" />
            <span className="hidden sm:inline">Check 1-2d</span> Approvals
          </Button>

          {/* Fast-Track Batch Upload Button */}
          <Button
            size="sm"
            onClick={() => setShowFastTrackModal(true)}
            className="h-7 px-2.5 text-[11px] bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-xs"
          >
            <Zap className="h-3 w-3 fill-current mr-1" /> Fast-Track Upload
          </Button>

          {/* AI Generator Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAiTopic(activePost?.title || "");
              setShowAiScriptModal(true);
            }}
            className="h-7 px-2 text-[11px] border-primary/30 text-primary hover:bg-primary/5"
            disabled={!activePost}
          >
            <Sparkles className="h-3 w-3 text-primary mr-1" /> AI Script & Shots
          </Button>

          {/* Shoot Call Sheet PDF */}
          {activePost?.shootDate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/content/shoot-sheet-pdf?date=${activePost.shootDate}&clientId=${activePost.clientId || ""}`, "_blank")}
              className="h-7 px-2 text-[11px]"
            >
              <Download className="h-3 w-3 mr-1" /> Call Sheet
            </Button>
          )}

          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh} title="Refresh Studio">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Main 3-Pane Full-Viewport Layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ═════════ LEFT PANE (280-300px): Smart Queue & Filters ═════════ */}
        <aside className="w-72 sm:w-80 shrink-0 border-r bg-card/30 flex flex-col justify-between overflow-hidden">
          {/* Filter Stage Tabs */}
          <div className="p-2.5 border-b space-y-2 shrink-0 bg-background/50">
            {/* Month Navigator Header (Month-Wise View) */}
            <div className="flex items-center justify-between bg-muted/70 p-1 rounded-lg border text-xs">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 hover:bg-muted"
                onClick={() => {
                  const baseMonth = selectedMonth === "ALL" ? format(new Date(), "yyyy-MM") : selectedMonth;
                  const [y, m] = baseMonth.split("-").map(Number);
                  const prev = new Date(y, m - 2, 1);
                  setSelectedMonth(format(prev, "yyyy-MM"));
                }}
                title="Previous Month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-6 text-xs font-bold border-0 bg-transparent shadow-none px-2 focus:ring-0 text-center justify-center">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => {
                    const count = posts.filter(p => p.scheduledAt?.startsWith(m)).length;
                    const [y, mon] = m.split("-").map(Number);
                    const label = format(new Date(y, mon - 1, 1), "MMMM yyyy");
                    return (
                      <SelectItem key={m} value={m} className="text-xs">
                        📅 {label} ({count} posts)
                      </SelectItem>
                    );
                  })}
                  <SelectItem value="ALL" className="text-xs font-semibold">🌐 All Months Together ({posts.length})</SelectItem>
                </SelectContent>
              </Select>

              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 hover:bg-muted"
                onClick={() => {
                  const baseMonth = selectedMonth === "ALL" ? format(new Date(), "yyyy-MM") : selectedMonth;
                  const [y, m] = baseMonth.split("-").map(Number);
                  const next = new Date(y, m, 1);
                  setSelectedMonth(format(next, "yyyy-MM"));
                }}
                title="Next Month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Stage filter vertical list */}
            <div className="space-y-0.5">
              {[
                { key: "ALL", label: "All Content", count: countAll, icon: "📋", activeClass: "bg-primary/10 text-primary font-bold border-l-2 border-primary" },
                { key: "NEEDS_APPROVAL", label: "Needs Review", count: countNeedsReview, icon: "🔔", activeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border-l-2 border-amber-500" },
                { key: "REVISIONS", label: "Revisions", count: countRevisions, icon: "⚠️", activeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold border-l-2 border-rose-500" },
                { key: "IDEATION_SHOOT", label: "Shoot Briefs", count: countShootBriefs, icon: "🎥", activeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border-l-2 border-blue-500" },
                { key: "EDITING", label: "In Editing", count: countEditing, icon: "✂️", activeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border-l-2 border-purple-500" },
                { key: "APPROVED_SCHEDULED", label: "Approved & Scheduled", count: countApprovedScheduled, icon: "✅", activeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border-l-2 border-emerald-500" },
              ].map((st) => {
                const isActive = stageFilter === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setStageFilter(st.key)}
                    className={cn(
                      "w-full px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center justify-between text-left",
                      isActive
                        ? st.activeClass
                        : "hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-[11px]">{st.icon}</span>
                      <span className="truncate">{st.label}</span>
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-bold", isActive ? "bg-background/80" : "bg-muted text-muted-foreground")}>
                      {st.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Filter Selectors */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-7 text-[11px] bg-background"><SelectValue placeholder="All Clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Clients</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-7 text-[11px] bg-background"><SelectValue placeholder="All Platforms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Platforms</SelectItem>
                  <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  <SelectItem value="YOUTUBE">YouTube</SelectItem>
                  <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                  <SelectItem value="FACEBOOK">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search within queue */}
            <div className="relative pt-0.5">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search queue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs pl-8 bg-background"
              />
            </div>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No posts in this queue stage.
              </div>
            ) : (
              filteredPosts.map((p) => {
                const isSelected = p.id === activePost?.id;
                const isChecked = selectedIds.includes(p.id);
                const statusCfg = STATUS_CONFIG[p.status || "IDEA"] || STATUS_CONFIG.IDEA;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPostId(p.id)}
                    className={cn(
                      "p-2.5 rounded-lg border text-left cursor-pointer transition-all relative group flex gap-2.5 items-start",
                      isSelected
                        ? "bg-primary/10 border-primary shadow-2xs text-foreground"
                        : "bg-card/70 border-border/70 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {/* Checkbox for batch approval */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) =>
                          prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                        );
                      }}
                      className="mt-0.5 text-muted-foreground hover:text-primary shrink-0"
                    >
                      {isChecked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 opacity-50 group-hover:opacity-100" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                          {p.clientName || "BlinkBeyond Client"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {PLATFORM_ICON[p.platform || "INSTAGRAM"]}
                          <Badge variant="secondary" className={cn("text-[9px] px-1 py-0 font-semibold", statusCfg.className)}>
                            {statusCfg.label}
                          </Badge>
                        </div>
                      </div>

                      <h4 className={cn("text-xs font-bold leading-snug truncate", isSelected ? "text-primary" : "text-foreground")}>
                        {p.title || p.conceptHook || "Untitled Post"}
                      </h4>

                      <div className="flex items-center justify-between gap-1 mt-1.5 text-[10px] text-muted-foreground">
                        <span>{p.format || p.contentType || "Reel"}</span>
                        <span>{p.scheduledAt ? p.scheduledAt.split("T")[0] : p.shootDate ? `Shoot: ${p.shootDate}` : "Unscheduled"}</span>
                      </div>

                      {isOverdueApproval(p) ? (
                        <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
                          <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-rose-600" />
                          <span>⚠️ Overdue Approval</span>
                        </div>
                      ) : isWithinApprovalWindow(p.scheduledAt) && p.internalApprovalStatus !== "APPROVED" ? (
                        <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                          <Clock className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                          <span>Manager Approval Due (≤ 2d)</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Multi-Select Sticky Batch Bar */}
          {selectedIds.length > 0 && (
            <div className="p-3 border-t bg-primary/10 flex items-center justify-between gap-2 shrink-0">
              {isManagerOrAdmin ? (
                <Button size="sm" onClick={handleBatchApprove} disabled={isSubmitting} className="h-8 flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve Selected ({selectedIds.length})
                </Button>
              ) : (
                <div className="flex-1 text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium px-2 py-1 bg-muted/70 rounded border border-border">
                  <span>🔒 Manager approval required</span>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => setSelectedIds([])} className="h-8 text-xs">
                Clear
              </Button>
            </div>
          )}
        </aside>

        {/* ═════════ CENTER PANE (Flexible): Visual Player, Proofing & Stepper ═════════ */}
        <main className="flex-1 flex flex-col overflow-hidden bg-muted/20">
          {/* Top Interactive Pipeline Stepper & Mode Switcher */}
          <div className="p-2 sm:p-2.5 border-b bg-card/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Stepper */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {[
                { label: "1. Idea", statusKey: "IDEA", icon: <FileText className="h-3 w-3" /> },
                { label: "2. Shoot", statusKey: "SHOOTING", icon: <Camera className="h-3 w-3" /> },
                { label: "3. Edit", statusKey: "PRODUCTION", icon: <Scissors className="h-3 w-3" /> },
                { label: "4. Review", statusKey: "IN_REVIEW", icon: <Eye className="h-3 w-3" /> },
                { label: "5. Scheduled", statusKey: "SCHEDULED", icon: <Calendar className="h-3 w-3" /> },
              ].map((step, idx) => {
                const isPassed = idx < activeStep;
                const isCurrent = idx === activeStep;

                return (
                  <React.Fragment key={step.label}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!activePost) return;
                        if (["SCHEDULED", "ADMIN_APPROVED"].includes(step.statusKey) && !isManagerOrAdmin) {
                          toast.error("Content approval and scheduling can only be done by a manager or administrator.");
                          return;
                        }
                        await fetch(`/api/content/${activePost.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
                          body: JSON.stringify({ status: step.statusKey }),
                        });
                        onRefresh();
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all font-medium",
                        isCurrent
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : isPassed
                          ? "text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/10"
                          : "text-muted-foreground opacity-60 hover:opacity-100"
                      )}
                    >
                      {isPassed ? <Check className="h-3 w-3 text-emerald-500" /> : step.icon}
                      <span>{step.label}</span>
                    </button>
                    {idx < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* View Sub-Mode Switcher */}
            <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg shrink-0">
              <Button
                size="sm"
                variant={centerMode === "PLAYER" ? "default" : "ghost"}
                onClick={() => setCenterMode("PLAYER")}
                className="h-6 text-[11px] px-2 font-medium"
              >
                <Film className="h-3 w-3 mr-1" /> Canvas
              </Button>
              <Button
                size="sm"
                variant={centerMode === "BRIEF" ? "default" : "ghost"}
                onClick={() => setCenterMode("BRIEF")}
                className="h-6 text-[11px] px-2 font-medium"
              >
                <FileText className="h-3 w-3 mr-1" /> Script & Hook
              </Button>
              <Button
                size="sm"
                variant={centerMode === "SHOTS" ? "default" : "ghost"}
                onClick={() => setCenterMode("SHOTS")}
                className="h-6 text-[11px] px-2 font-medium"
              >
                <Camera className="h-3 w-3 mr-1" /> Shot List
              </Button>
              <Button
                size="sm"
                variant={centerMode === "COMPARE" ? "default" : "ghost"}
                onClick={() => setCenterMode("COMPARE")}
                className="h-6 text-[11px] px-2 font-medium"
              >
                <Columns className="h-3 w-3 mr-1" /> Compare
              </Button>
              <Button
                size="sm"
                variant={centerMode === "GRID" ? "default" : "ghost"}
                onClick={() => setCenterMode("GRID")}
                className="h-6 text-[11px] px-2 font-medium"
              >
                <Grid className="h-3 w-3 mr-1" /> 3×3 Grid
              </Button>
            </div>
          </div>

          {/* Center Pane Content Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col items-center justify-center">
            {!activePost ? (
              <div className="text-center text-muted-foreground text-xs py-16">
                <Film className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Select a post from the queue to inspect and approve.
              </div>
            ) : centerMode === "PLAYER" ? (
              /* MODE 1: Live Video Player / Carousel / Social Mockup Canvas */
              <div className="w-full max-w-2xl flex flex-col items-center">
                {isVideo && primaryMediaUrl ? (
                  <div className="w-full flex flex-col items-center">
                    {/* Video Player Box with Frame Pinning & Optional Safe Zone Overlay */}
                    <div
                      onClick={handleFrameClick}
                      className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-[9/16] max-h-[480px] w-auto cursor-crosshair group border border-border/40 select-none"
                    >
                      {parsedMedia.type === "gdrive" || parsedMedia.type === "iframe" ? (
                        <iframe
                          src={parsedMedia.previewUrl}
                          className="h-full w-full object-contain border-0"
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          ref={videoRef}
                          src={parsedMedia.streamUrl || primaryMediaUrl}
                          onTimeUpdate={() => {
                            if (videoRef.current) {
                              setCurrentTime(videoRef.current.currentTime);
                              setDuration(videoRef.current.duration || 0);
                            }
                          }}
                          onEnded={() => setIsPlaying(false)}
                          className="h-full w-full object-contain"
                        />
                      )}

                      {/* Optional Instagram Reels Safe Zone Overlay */}
                      {showSafeZoneOverlay && (
                        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-3 select-none">
                          <div className="flex items-center justify-between text-[10px] text-white/60 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                            <span>Instagram Reels Safe Zone Active</span>
                            <span>9:16</span>
                          </div>

                          <div className="flex items-end justify-between">
                            {/* Bottom-left user and caption mock overlay */}
                            <div className="max-w-[70%] space-y-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 rounded-lg text-white">
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-[9px]">👤</span>
                                <span>@{activePost.clientName ? activePost.clientName.toLowerCase().replace(/\s+/g, "") : "client"}</span>
                              </div>
                              <p className="text-[10px] text-white/80 line-clamp-1">{activePost.caption || "Caption text appears in this lower area..."}</p>
                              <div className="text-[9px] text-white/60 flex items-center gap-1">
                                <span>🎵 Original Audio</span>
                              </div>
                            </div>

                            {/* Right-side button stack overlay */}
                            <div className="flex flex-col items-center gap-2.5 text-white/80 pb-2 pr-1">
                              <div className="flex flex-col items-center text-[9px]"><span className="text-base">❤️</span><span>12.4k</span></div>
                              <div className="flex flex-col items-center text-[9px]"><span className="text-base">💬</span><span>284</span></div>
                              <div className="flex flex-col items-center text-[9px]"><span className="text-base">✈️</span><span>1.2k</span></div>
                              <div className="flex flex-col items-center text-[9px]"><span className="text-base">🔖</span><span>Save</span></div>
                              <div className="h-5 w-5 rounded-full border-2 border-white/60 flex items-center justify-center text-[8px] animate-spin">💿</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Display Pending Pin if clicked */}
                      {pendingPin && (
                        <div
                          style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold h-6 w-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce pointer-events-none z-20"
                        >
                          📌
                        </div>
                      )}

                      {/* Display Saved Comment Pins */}
                      {Array.isArray(activePost.comments) && activePost.comments.map((c: any, i: number) => {
                        if (c.frameCoordX !== null && c.frameCoordY !== null && c.frameCoordX !== undefined) {
                          return (
                            <div
                              key={c.id || i}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (c.timestampSec !== null) seekVideo(c.timestampSec);
                              }}
                              style={{ left: `${c.frameCoordX}%`, top: `${c.frameCoordY}%` }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border border-white shadow-md cursor-pointer hover:scale-125 transition-transform z-20"
                              title={`${c.comment} (@${formatTime(c.timestampSec || 0)})`}
                            >
                              {i + 1}
                            </div>
                          );
                        }
                        return null;
                      })}

                      {/* Bottom Playback Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 flex items-center justify-between text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (videoRef.current) {
                                if (isPlaying) videoRef.current.pause();
                                else videoRef.current.play();
                                setIsPlaying(!isPlaying);
                              }
                            }}
                            className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                          >
                            {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                          </button>
                          <span className="font-mono text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Speed selector */}
                          <div className="flex items-center bg-black/40 rounded px-1.5 py-0.5 text-[11px] font-semibold gap-1">
                            {[1, 1.5, 2].map((sp) => (
                              <button
                                key={sp}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlaybackSpeed(sp);
                                  if (videoRef.current) videoRef.current.playbackRate = sp;
                                }}
                                className={cn("px-1 rounded", playbackSpeed === sp ? "bg-primary text-white" : "opacity-70 hover:opacity-100")}
                              >
                                {sp}x
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (videoRef.current) {
                                videoRef.current.muted = !isMuted;
                                setIsMuted(!isMuted);
                              }
                            }}
                          >
                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Player Bar */}
                    <div className="flex items-center justify-between w-full max-w-sm mt-2 px-1 text-xs">
                      <Button
                        size="sm"
                        variant={showSafeZoneOverlay ? "default" : "outline"}
                        onClick={() => setShowSafeZoneOverlay(!showSafeZoneOverlay)}
                        className="h-7 text-[11px] gap-1"
                      >
                        <Eye className="h-3 w-3" /> Safe Zone {showSafeZoneOverlay ? "ON" : "OFF"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingMedia}
                        className="h-7 text-[11px] gap-1"
                      >
                        <Upload className="h-3 w-3" /> Replace Cut
                      </Button>

                      {primaryMediaUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(primaryMediaUrl, "_blank")}
                          className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Download className="h-3 w-3" /> Download
                        </Button>
                      )}
                    </div>
                  </div>
                ) : carouselSlides.length > 0 ? (
                  /* Multi-Slide Carousel Viewer */
                  <div className="w-full max-w-sm bg-card border rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-3 border-b flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                          {activePost.clientName ? activePost.clientName.slice(0, 2).toUpperCase() : "BB"}
                        </div>
                        <span>{activePost.clientName || "BlinkBeyond"}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Slide {activeSlide + 1} of {carouselSlides.length}
                      </Badge>
                    </div>

                    <div className="relative aspect-square bg-slate-950 flex items-center justify-center overflow-hidden">
                      <img
                        src={carouselSlides[activeSlide]}
                        alt={`Slide ${activeSlide + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {carouselSlides.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveSlide((prev) => (prev > 0 ? prev - 1 : carouselSlides.length - 1))}
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveSlide((prev) => (prev < carouselSlides.length - 1 ? prev + 1 : 0))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">{activePost.title || "Social Post"}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-6 text-[10px] px-1.5 text-primary"
                        >
                          <Upload className="h-3 w-3 mr-1" /> Replace
                        </Button>
                      </div>
                      <p className="text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {activePost.caption || "No caption added yet."}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Interactive Social Post Mockup Canvas with Active Dropzone (When No Media Yet) */
                  <div className="w-full max-w-sm bg-card border rounded-2xl shadow-xl overflow-hidden flex flex-col">
                    {/* Mockup Header */}
                    <div className="p-3 border-b flex items-center justify-between text-xs bg-muted/20">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                          {activePost.clientName ? activePost.clientName.slice(0, 2).toUpperCase() : "BB"}
                        </div>
                        <div>
                          <span className="font-bold block leading-tight">{activePost.clientName || "BlinkBeyond Client"}</span>
                          <span className="text-[10px] text-muted-foreground">Original audio • Organic Post</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                        {activePost.format || activePost.contentType || "Reel"}
                      </Badge>
                    </div>

                    {/* Active Dropzone in Mockup Media Area */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const dummyEvent = { target: { files: [file] } } as any;
                          handleDirectUpload(dummyEvent);
                        }
                      }}
                      className="relative aspect-[9/13] bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white border-y border-border/40 group transition-colors"
                    >
                      <div className="h-14 w-14 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-100">Upload Creative Asset</h4>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                        Drag & drop video (.mp4, .mov) or graphic (.png, .jpg) directly here
                      </p>

                      <div className="mt-4 flex flex-col gap-2 w-full max-w-[240px]">
                        <Button
                          size="sm"
                          disabled={isUploadingMedia}
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs h-8"
                        >
                          {isUploadingMedia ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                          {isUploadingMedia ? "Uploading..." : "Browse Local File"}
                        </Button>

                        {/* External Link Input */}
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            placeholder="Or paste Drive / Dropbox URL..."
                            value={externalAssetUrl}
                            onChange={(e) => setExternalAssetUrl(e.target.value)}
                            className="h-7 text-[11px] bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveExternalLink}
                            disabled={!externalAssetUrl.trim()}
                            className="h-7 px-2 text-[11px] bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Mockup Caption & Meta Preview */}
                    <div className="p-3 bg-card space-y-2 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground text-xs pb-1 border-b border-border/40">
                        <div className="flex items-center gap-3">
                          <span>❤️ 0</span>
                          <span>💬 0</span>
                          <span>✈️ 0</span>
                        </div>
                        <span>🔖</span>
                      </div>

                      <div>
                        <p className="font-bold text-foreground text-xs">{activePost.title || "Untitled Concept"}</p>
                        {activePost.conceptHook && (
                          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                            🎯 Hook: {activePost.conceptHook}
                          </p>
                        )}
                        <p className="text-muted-foreground text-[11px] mt-1 whitespace-pre-wrap line-clamp-2">
                          {activePost.caption || "No caption added yet. Click edit or generate with AI."}
                        </p>
                      </div>

                      {/* Quick Action Chips beneath Mockup */}
                      <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAiTopic(activePost.title || "");
                            setShowAiScriptModal(true);
                          }}
                          className="h-6 text-[10px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                        >
                          <Sparkles className="h-3 w-3" /> AI Hook
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCenterMode("BRIEF")}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          <FileText className="h-3 w-3" /> Script
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCenterMode("SHOTS")}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          <Camera className="h-3 w-3" /> Shots
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenEdit(activePost)}
                          className="h-6 text-[10px] px-2 text-muted-foreground ml-auto"
                        >
                          Edit Details ↗
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : centerMode === "BRIEF" ? (
              /* MODE 2: Visual & Verbal Hook + Scene Script Breakdown */
              <div className="w-full max-w-3xl space-y-4">
                {/* Visual & Verbal Hook */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      🎯 3-Second Visual + Verbal Hook
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowTeleprompterModal(true)}
                      className="h-6 text-[11px] gap-1 text-primary hover:bg-primary/10"
                    >
                      <Film className="h-3 w-3" /> Teleprompter Mode
                    </Button>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {activePost.conceptHook || "No hook defined yet. Click 'AI Script & Shots' in top bar to generate!"}
                  </p>
                </div>

                {/* Scene by Scene Script Table */}
                <div className="border rounded-xl bg-card overflow-hidden">
                  <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                    <span className="text-xs font-bold">🎬 Scene-by-Scene Script Breakdown</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {Array.isArray(activePost.scriptScenes) ? activePost.scriptScenes.length : 0} Scenes
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAiTopic(activePost.title || "");
                          setShowAiScriptModal(true);
                        }}
                        className="h-6 text-[11px] text-primary"
                      >
                        <Sparkles className="h-3 w-3 mr-1" /> Generate with AI
                      </Button>
                    </div>
                  </div>
                  {Array.isArray(activePost.scriptScenes) && activePost.scriptScenes.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b bg-muted/10 text-muted-foreground text-[10px] uppercase font-bold">
                            <th className="p-2.5 w-10 text-center">#</th>
                            <th className="p-2.5 w-24">Time</th>
                            <th className="p-2.5">Visual Direction</th>
                            <th className="p-2.5">Spoken Dialogue</th>
                            <th className="p-2.5">On-Screen Text</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {activePost.scriptScenes.map((sc: any, idx: number) => (
                            <tr key={sc.id || idx} className="hover:bg-muted/30 transition-colors">
                              <td className="p-2.5 text-center font-bold text-muted-foreground">{sc.sceneNo || idx + 1}</td>
                              <td className="p-2.5 font-mono text-[11px] text-muted-foreground">{sc.timecode || "0:00"}</td>
                              <td className="p-2.5 font-medium text-foreground">{sc.visualDirection}</td>
                              <td className="p-2.5 text-muted-foreground italic">"{sc.spokenAudio}"</td>
                              <td className="p-2.5 font-bold text-primary">{sc.onScreenText || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                      <FileText className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                      <p>No structured script scenes yet.</p>
                      <Button
                        size="sm"
                        onClick={() => {
                          setAiTopic(activePost.title || "");
                          setShowAiScriptModal(true);
                        }}
                        className="text-xs font-semibold"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" /> Generate AI Script & Scenes
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : centerMode === "SHOTS" ? (
              /* MODE 3: On-Set Interactive Shot List Checklist */
              <div className="w-full max-w-3xl space-y-4">
                <div className="border rounded-xl bg-card overflow-hidden">
                  <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold">🎥 On-Set Interactive Shot List</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-primary">
                        {Array.isArray(activePost.shotList) ? activePost.shotList.filter((sh: any) => sh.isCaptured).length : 0} / {Array.isArray(activePost.shotList) ? activePost.shotList.length : 0} Captured
                      </span>
                      {activePost.shootDate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/content/shoot-sheet-pdf?date=${activePost.shootDate}&clientId=${activePost.clientId || ""}`, "_blank")}
                          className="h-6 text-[10px]"
                        >
                          <Download className="h-3 w-3 mr-1" /> Call Sheet PDF
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {Array.isArray(activePost.shotList) && activePost.shotList.length > 0 ? (
                      activePost.shotList.map((sh: any) => (
                        <div
                          key={sh.id}
                          className={cn(
                            "p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-colors",
                            sh.isCaptured ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleShotCaptured(sh.id)}
                              className="text-primary hover:scale-110 transition-transform shrink-0"
                            >
                              {sh.isCaptured ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                            </button>
                            <span className="font-bold shrink-0">Shot {sh.shotNumber}:</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-semibold">{sh.framing}</Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-semibold text-primary">{sh.cameraMovement}</Badge>
                            <span className={cn("truncate", sh.isCaptured && "line-through text-muted-foreground")}>{sh.description}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{sh.bestTakeNote || "Take —"}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                        <Camera className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                        <p>No shots in checklist yet.</p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setAiTopic(activePost.title || "");
                            setShowAiScriptModal(true);
                          }}
                          className="text-xs font-semibold"
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> Generate Shots with AI
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : centerMode === "COMPARE" ? (
              /* MODE 4: Side-by-Side Compare (Reference vs. Final OR v1 vs. v2) */
              <div className="w-full h-full flex flex-col md:flex-row gap-4 items-center justify-center">
                <div className="flex-1 w-full max-w-md h-full flex flex-col border rounded-xl overflow-hidden bg-card/60">
                  <div className="p-2 border-b text-xs font-bold bg-muted/40 flex items-center justify-between">
                    <span>LEFT: Reference / Previous (v1)</span>
                    {activePost.referenceLinks?.[0]?.url && (
                      <a href={activePost.referenceLinks[0].url} target="_blank" rel="noreferrer" className="text-primary flex items-center gap-1 hover:underline">
                        Open URL <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex-1 bg-black/90 flex items-center justify-center min-h-[300px]">
                    {activePost.assetVersions && activePost.assetVersions.length > 1 ? (
                      <video src={activePost.assetVersions[0].url} controls className="max-h-[380px] w-auto" />
                    ) : (
                      <div className="text-center text-xs text-muted-foreground p-6">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        Reference: {activePost.referenceLinks?.[0]?.title || "Reference inspiration video"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 w-full max-w-md h-full flex flex-col border rounded-xl overflow-hidden bg-card/60">
                  <div className="p-2 border-b text-xs font-bold bg-muted/40 flex items-center justify-between">
                    <span>RIGHT: Current Edit ({activePost.assetVersions?.length ? `v${activePost.assetVersions.length}` : "Final"})</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">Active Version</Badge>
                  </div>
                  <div className="flex-1 bg-black/90 flex items-center justify-center min-h-[300px]">
                    {primaryMediaUrl ? (
                      <video src={primaryMediaUrl} controls className="max-h-[380px] w-auto" />
                    ) : (
                      <div className="text-center text-xs text-muted-foreground">No final media file</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* MODE 5: 3×3 Instagram Profile Grid Preview */
              (() => {
                const clientGridPosts = posts.filter(
                  (p) => !activePost?.clientId || p.clientId === activePost.clientId
                );
                // Sort by scheduled date descending (newest on top, like Instagram feed)
                const sortedClientGridPosts = [...clientGridPosts].sort((a, b) => {
                  const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
                  const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
                  if (timeA !== timeB) return timeB - timeA;
                  return (a.title || "").localeCompare(b.title || "");
                });
                const totalGridPages = Math.max(1, Math.ceil(sortedClientGridPosts.length / 9));
                const displayedGridSlice = sortedClientGridPosts.slice(gridPage * 9, (gridPage + 1) * 9);

                return (
                  <div className="w-full max-w-md flex flex-col items-center">
                    <div className="w-full bg-card border rounded-2xl p-4 shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                            {activePost.clientName ? activePost.clientName.slice(0, 2).toUpperCase() : "BB"}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold">{activePost.clientName || "BlinkBeyond Client"}</h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>3×3 Feed Aesthetic Preview</span>
                              <span>•</span>
                              <span className="font-semibold text-foreground">
                                {sortedClientGridPosts.length} {sortedClientGridPosts.length === 1 ? "Post" : "Posts"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {totalGridPages > 1 && (
                            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
                              <button
                                type="button"
                                onClick={() => setGridPage((prev) => Math.max(0, prev - 1))}
                                disabled={gridPage === 0}
                                className="h-6 w-6 flex items-center justify-center rounded disabled:opacity-30 hover:bg-card transition-colors"
                                title="Previous 9 Posts"
                              >
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-[10px] font-semibold px-1 min-w-[2.5rem] text-center">
                                {gridPage + 1}/{totalGridPages}
                              </span>
                              <button
                                type="button"
                                onClick={() => setGridPage((prev) => Math.min(totalGridPages - 1, prev + 1))}
                                disabled={gridPage >= totalGridPages - 1}
                                className="h-6 w-6 flex items-center justify-center rounded disabled:opacity-30 hover:bg-card transition-colors"
                                title="Next 9 Posts"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <Badge variant="outline" className="text-xs">Instagram Feed</Badge>
                        </div>
                      </div>

                      {/* 3x3 Grid */}
                      <div className="grid grid-cols-3 gap-1.5 aspect-square bg-muted/40 p-1.5 rounded-xl border border-border/40">
                        {displayedGridSlice.map((p, i) => {
                          const mediaUrl =
                            p.coverImageUrl ||
                            p.assetsLink ||
                            (Array.isArray(p.mediaUrls) ? p.mediaUrls[0] : null) ||
                            (Array.isArray(p.mediaFiles) ? p.mediaFiles[0] : null) ||
                            (Array.isArray(p.assetVersions) && p.assetVersions.length > 0
                              ? p.assetVersions[p.assetVersions.length - 1]?.url
                              : null) ||
                            "";
                          const parsed = parseMediaUrl(mediaUrl);
                          const isReel = p.format === "REEL" || p.contentType === "REEL";
                          const isCarousel = p.format === "CAROUSEL" || p.contentType === "CAROUSEL" || (Array.isArray(p.mediaFiles) && p.mediaFiles.length > 1);

                          const formatGradients: Record<string, string> = {
                            REEL: "from-purple-950 via-slate-900 to-indigo-950 border-purple-500/30 text-purple-200",
                            CAROUSEL: "from-pink-950 via-slate-900 to-rose-950 border-pink-500/30 text-pink-200",
                            GRAPHIC: "from-blue-950 via-slate-900 to-cyan-950 border-blue-500/30 text-blue-200",
                            POST: "from-slate-900 via-zinc-900 to-neutral-950 border-slate-700 text-slate-200",
                          };
                          const gradientClass = formatGradients[p.format || p.contentType || "POST"] || formatGradients.POST;

                          return (
                            <div
                              key={p.id || i}
                              onClick={() => {
                                setSelectedPostId(p.id);
                              }}
                              className={cn(
                                "relative aspect-square rounded-lg overflow-hidden cursor-pointer group border transition-all duration-150 flex flex-col",
                                p.id === activePost.id
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary z-10 shadow-lg scale-[1.02]"
                                  : "border-border/60 hover:opacity-95 hover:border-primary/50"
                              )}
                            >
                              {mediaUrl ? (
                                parsed.type === "gdrive" ? (
                                  <div className="relative w-full h-full bg-slate-950">
                                    <img
                                      src={parsed.previewUrl.replace("/preview", "/thumbnail?sz=w600")}
                                      alt={p.title || "Post"}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                    {isReel && (
                                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-xs p-1 rounded-md text-white">
                                        <Film className="h-3 w-3" />
                                      </div>
                                    )}
                                    {isCarousel && (
                                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-xs p-1 rounded-md text-white">
                                        <Layers className="h-3 w-3" />
                                      </div>
                                    )}
                                  </div>
                                ) : parsed.type === "video" || isReel || mediaUrl.match(/\.(mp4|mov|webm|m4v)/i) ? (
                                  <div className="relative w-full h-full bg-slate-950">
                                    <video
                                      src={parsed.streamUrl || mediaUrl}
                                      className="w-full h-full object-cover pointer-events-none"
                                      preload="metadata"
                                      muted
                                      playsInline
                                    />
                                    <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-xs p-1 rounded-md text-white">
                                      <Film className="h-3 w-3" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative w-full h-full bg-slate-950">
                                    <img
                                      src={mediaUrl}
                                      alt={p.title || "Post"}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                    {isCarousel && (
                                      <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-xs p-1 rounded-md text-white">
                                        <Layers className="h-3 w-3" />
                                      </div>
                                    )}
                                  </div>
                                )
                              ) : (
                                /* Creative Aesthetic Placeholder Tile when no final media is uploaded yet */
                                <div className={cn("w-full h-full bg-gradient-to-br flex flex-col justify-between p-2 select-none", gradientClass)}>
                                  <div className="flex items-center justify-between text-[9px] font-bold">
                                    <span className="flex items-center gap-1 opacity-80 uppercase text-[8px] tracking-wider">
                                      {isReel ? <Film className="h-2.5 w-2.5" /> : isCarousel ? <Layers className="h-2.5 w-2.5" /> : <Camera className="h-2.5 w-2.5" />}
                                      {p.format || p.contentType || "POST"}
                                    </span>
                                    {p.scheduledAt && (
                                      <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded opacity-90 font-mono">
                                        {format(new Date(p.scheduledAt), "dd MMM")}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-center my-auto px-0.5">
                                    <p className="font-bold text-[11px] leading-tight text-white line-clamp-2">
                                      {p.title || `Post #${i + 1}`}
                                    </p>
                                    {p.conceptHook && (
                                      <p className="text-[8px] text-white/70 line-clamp-1 mt-0.5 italic">
                                        "{p.conceptHook}"
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between text-[8px] pt-1 border-t border-white/10">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[8px] px-1 py-0 h-4 border-0 font-semibold",
                                        p.status === "ADMIN_APPROVED" || p.status === "SCHEDULED"
                                          ? "bg-emerald-500/20 text-emerald-300"
                                          : p.status === "IN_REVIEW"
                                          ? "bg-amber-500/20 text-amber-300"
                                          : "bg-white/10 text-white/70"
                                      )}
                                    >
                                      {p.status || "IDEA"}
                                    </Badge>
                                    <span className="text-[8px] text-white/50 group-hover:text-primary transition-colors flex items-center gap-0.5 font-medium">
                                      <Upload className="h-2.5 w-2.5" /> Cut
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Hover Overlay with Quick Actions */}
                              <div className="absolute inset-0 bg-black/75 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2 text-white transition-opacity">
                                <div className="flex items-center justify-between text-[9px]">
                                  <span className="font-bold uppercase tracking-wider text-primary-foreground bg-primary px-1 py-0.5 rounded text-[8px]">
                                    {p.format || "Post"}
                                  </span>
                                  <span className="text-white/70 text-[8px]">
                                    {p.scheduledAt ? format(new Date(p.scheduledAt), "MMM dd") : ""}
                                  </span>
                                </div>
                                <div className="text-center">
                                  <p className="text-[10px] font-bold leading-tight line-clamp-2">{p.title || "Post"}</p>
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPostId(p.id);
                                      setCenterMode("PLAYER");
                                    }}
                                    className="h-6 text-[9px] px-2 py-0 gap-1 bg-white/20 hover:bg-white/30 text-white border-0"
                                  >
                                    <Play className="h-2.5 w-2.5" /> Open
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPostId(p.id);
                                      fileInputRef.current?.click();
                                    }}
                                    className="h-6 text-[9px] px-2 py-0 gap-1 bg-primary/20 hover:bg-primary/30 text-primary border-primary/30"
                                  >
                                    <Upload className="h-2.5 w-2.5" /> Cut
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </main>

        {/* ═════════ RIGHT PANE (340-360px): Approval, Routing & Team Coordinator ═════════ */}
        <aside className="w-80 sm:w-88 shrink-0 border-l bg-card/40 flex flex-col justify-between overflow-y-auto p-3 sm:p-3.5 space-y-3">
          {!activePost ? (
            <div className="text-center py-20 text-muted-foreground text-xs">No post selected</div>
          ) : (
            <>
              {/* Sticky 2-Step Approval Decision Card (Manager First, Then Client) */}
              <div className="space-y-2 p-3 rounded-xl border bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    2-STEP APPROVAL WORKFLOW
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {activePost.approvalStatus === "APPROVED"
                      ? "Fully Approved"
                      : activePost.internalApprovalStatus === "APPROVED"
                      ? "Awaiting Client"
                      : "Manager Review Required"}
                  </Badge>
                </div>

                {isOverdueApproval(activePost) ? (
                  <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[11px]">⚠️ Scheduled Date Passed / Overdue</p>
                      <p className="text-[10px] opacity-90">This post was scheduled for the past and still requires approval.</p>
                    </div>
                  </div>
                ) : isWithinApprovalWindow(activePost.scheduledAt) && activePost.internalApprovalStatus !== "APPROVED" ? (
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-start gap-2">
                    <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[11px]">⏰ Scheduled in 1-2 Days</p>
                      <p className="text-[10px] opacity-90">Manager internal approval must be completed before sharing with client.</p>
                    </div>
                  </div>
                ) : null}

                {/* Step 1: Manager Internal Approval */}
                <div className="p-2.5 rounded-lg border bg-card space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                      Manager Approval (Internal)
                    </span>
                    {activePost.internalApprovalStatus === "APPROVED" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                        ✓ Approved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                        Pending Manager
                      </Badge>
                    )}
                  </div>

                  {activePost.internalApprovalStatus === "APPROVED" ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>Internally approved by manager. Ready for client.</span>
                    </p>
                  ) : !isManagerOrAdmin ? (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>Manager review required. Only managers and admins can approve content.</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleApproveInternally}
                      disabled={isSubmitting}
                      className="w-full h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Step 1: Approve as Manager
                    </Button>
                  )}
                </div>

                {/* Step 2: Client Approval */}
                <div className={cn("p-2.5 rounded-lg border bg-card space-y-1.5", activePost.internalApprovalStatus !== "APPROVED" && "opacity-60")}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-bold">2</span>
                      Client Approval & Scheduling
                    </span>
                    {activePost.approvalStatus === "APPROVED" ? (
                      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-bold">
                        ✓ Client Approved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {activePost.internalApprovalStatus === "APPROVED" ? "Awaiting Client" : "Locked"}
                      </Badge>
                    )}
                  </div>

                  {activePost.internalApprovalStatus !== "APPROVED" ? (
                    <p className="text-[10px] text-muted-foreground italic">
                      ⚠️ Complete Step 1 (Manager Approval) first before client approval.
                    </p>
                  ) : activePost.approvalStatus === "APPROVED" ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span>Client confirmed. Post scheduled.</span>
                    </p>
                  ) : !isManagerOrAdmin ? (
                    <div className="p-2 rounded bg-muted text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                      <span>🔒 Client approval and link sharing are managed by managers and admins.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleApproveAndShare}
                        disabled={isSubmitting}
                        className="h-8 text-[11px] font-semibold border-primary/30 text-primary hover:bg-primary/5"
                      >
                        <Share2 className="h-3 w-3 mr-1" /> Copy Client Link
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleClientApprove}
                        disabled={isSubmitting}
                        className="h-8 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Check className="h-3 w-3 mr-1" /> Client Approved
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pre-Flight Quality Check (QC) Bar */}
              <div className="border rounded-xl p-3 bg-background/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pre-Flight QC Bar</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePassAllQc}
                    className="h-5 text-[10px] px-1.5 text-primary hover:bg-primary/10 font-bold"
                  >
                    Pass All
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "hookChecked", label: "Hook (3s)" },
                    { key: "brandGuidelinesMatched", label: "Brand Style" },
                    { key: "subtitlesVerified", label: "Subtitles/Typos" },
                    { key: "safeZoneChecked", label: "Reel Safe Zone" },
                    { key: "audioBalanced", label: "Audio Mix" },
                    { key: "ctaIncluded", label: "Clear CTA" },
                  ].map((qc) => {
                    const isChecked = Boolean(activePost.qcChecklist?.[qc.key]);
                    return (
                      <button
                        key={qc.key}
                        type="button"
                        onClick={() => toggleQcItem(qc.key)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border text-left transition-colors",
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                            : "bg-card border-border/70 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {isChecked ? <Check className="h-3 w-3 text-emerald-600 shrink-0" /> : <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />}
                        <span className="truncate">{qc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Smart Revision Routing Box with 1-Click Feedback Chips */}
              <div className="border rounded-xl p-3 bg-background/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Request Changes & Route
                  </span>
                  {pendingPin && (
                    <span className="text-[10px] bg-rose-500/10 text-rose-600 px-1.5 py-0.5 rounded font-bold">
                      Pin @ {formatTime(pendingPin.timeSec)}
                    </span>
                  )}
                </div>

                {/* 1-Click Preset Feedback Chips */}
                <div className="flex flex-wrap gap-1">
                  {[
                    "Tighten 3s Hook",
                    "Fix Subtitle Typo",
                    "Reel Safe Zone",
                    "Audio Level",
                    "Color Grade",
                    "Add Clear CTA",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRevisionNote(prev => prev ? `${prev}, ${chip}` : chip)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border/50 text-muted-foreground"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Type feedback notes (Click video to auto-insert exact timestamp @00:14)..."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  className="text-xs h-18 resize-none bg-card"
                />

                <div className="space-y-1.5 pt-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground">Route Revision Directly To:</span>
                  <div className="grid grid-cols-3 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRouteRevision("EDITOR")}
                      disabled={isSubmitting}
                      className="h-7 text-[10px] px-1 border-rose-300 hover:bg-rose-50 text-rose-700 dark:text-rose-300 font-medium"
                    >
                      <Scissors className="h-3 w-3 mr-1" /> Editor
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRouteRevision("VIDEOGRAPHER")}
                      disabled={isSubmitting}
                      className="h-7 text-[10px] px-1 border-orange-300 hover:bg-orange-50 text-orange-700 dark:text-orange-300 font-medium"
                    >
                      <Camera className="h-3 w-3 mr-1" /> Reshoot
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRouteRevision("STRATEGIST")}
                      disabled={isSubmitting}
                      className="h-7 text-[10px] px-1 border-blue-300 hover:bg-blue-50 text-blue-700 dark:text-blue-300 font-medium"
                    >
                      <FileText className="h-3 w-3 mr-1" /> Script Fix
                    </Button>
                  </div>
                </div>
              </div>

              {/* Team Assignees & Handoff Card */}
              <div className="border rounded-xl p-3 bg-background/50 space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role Assignments</span>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Strategist / Scriptwriter:</span>
                    <Select
                      value={activePost.ideationAssignedTo || "UNASSIGNED"}
                      onValueChange={async (v) => {
                        await fetch(`/api/content/${activePost.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
                          body: JSON.stringify({ ideationAssignedTo: v === "UNASSIGNED" ? null : v }),
                        });
                        onRefresh();
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-card"><SelectValue placeholder="Assign Strategist" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Videographer (Shoot):</span>
                    <Select
                      value={activePost.videographerId || "UNASSIGNED"}
                      onValueChange={async (v) => {
                        await fetch(`/api/content/${activePost.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
                          body: JSON.stringify({ videographerId: v === "UNASSIGNED" ? null : v }),
                        });
                        onRefresh();
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-card"><SelectValue placeholder="Assign Videographer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Video Editor / Designer:</span>
                    <Select
                      value={activePost.editorId || "UNASSIGNED"}
                      onValueChange={async (v) => {
                        await fetch(`/api/content/${activePost.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
                          body: JSON.stringify({ editorId: v === "UNASSIGNED" ? null : v }),
                        });
                        onRefresh();
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-card"><SelectValue placeholder="Assign Editor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Timestamped Timeline Comments */}
              <div className="border rounded-xl p-3 bg-background/50 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Revision & Proofing Timeline</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {Array.isArray(activePost.comments) && activePost.comments.length > 0 ? (
                    activePost.comments.map((cm: any, idx: number) => (
                      <div key={cm.id || idx} className="p-2 rounded bg-card text-xs border border-border/60 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          {cm.timestampSec !== null && cm.timestampSec !== undefined ? (
                            <button
                              type="button"
                              onClick={() => seekVideo(cm.timestampSec)}
                              className="font-mono text-primary font-bold hover:underline"
                            >
                              ⏱️ @{formatTime(cm.timestampSec)}
                            </button>
                          ) : (
                            <span>Comment</span>
                          )}
                          <span>{cm.createdAt ? new Date(cm.createdAt).toLocaleDateString() : ""}</span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{cm.comment || cm.text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">No timeline notes yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Modal: Fast-Track Upload (Single or Batch) ── */}
      <Dialog open={showFastTrackModal} onOpenChange={setShowFastTrackModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-current" />
              Fast-Track Ready Upload → Direct to PC Approval
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Bypass Ideation and Shoot stages. Upload 1 or multiple finished videos/carousels to send straight to the Admin PC Approval Queue.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Client</label>
                <Select value={fastTrackClient} onValueChange={setFastTrackClient}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select Client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Platform</label>
                <Select value={fastTrackPlatform} onValueChange={setFastTrackPlatform}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                    <SelectItem value="YOUTUBE">YouTube</SelectItem>
                    <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                    <SelectItem value="FACEBOOK">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Format</label>
                <Select value={fastTrackFormat} onValueChange={setFastTrackFormat}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REEL">Reel / Short</SelectItem>
                    <SelectItem value="CAROUSEL">Multi-Slide Carousel</SelectItem>
                    <SelectItem value="POST">Single Image</SelectItem>
                    <SelectItem value="VIDEO">Long Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Drag & Drop Upload Items */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {fastTrackFiles.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-xl bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">Post #{idx + 1}</span>
                    {fastTrackFiles.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setFastTrackFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="h-6 w-6 text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Post Title (e.g. 5 Growth Hacks Reel)"
                    value={item.title}
                    onChange={(e) => {
                      const next = [...fastTrackFiles];
                      next[idx].title = e.target.value;
                      setFastTrackFiles(next);
                    }}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Media URL or Google Drive Video Link"
                    value={item.url}
                    onChange={(e) => {
                      const next = [...fastTrackFiles];
                      next[idx].url = e.target.value;
                      setFastTrackFiles(next);
                    }}
                    className="text-xs h-8"
                  />
                  <Textarea
                    placeholder="Caption & hashtags..."
                    value={item.caption}
                    onChange={(e) => {
                      const next = [...fastTrackFiles];
                      next[idx].caption = e.target.value;
                      setFastTrackFiles(next);
                    }}
                    className="text-xs h-14 resize-none"
                  />
                </div>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setFastTrackFiles(prev => [...prev, { title: "", url: "", caption: "" }])}
              className="text-xs gap-1.5 w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Add Another Deliverable to Batch
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFastTrackModal(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!fastTrackClient) {
                  toast.warning("Please select a client");
                  return;
                }
                const validPosts = fastTrackFiles.filter(f => f.url.trim() || f.title.trim()).map(f => ({
                  title: f.title || "Ready Deliverable",
                  clientId: fastTrackClient,
                  platform: fastTrackPlatform,
                  format: fastTrackFormat,
                  assetsLink: f.url,
                  mediaFiles: [f.url],
                  caption: f.caption,
                }));

                if (validPosts.length === 0) {
                  toast.warning("Please enter at least one media link or title");
                  return;
                }

                try {
                  const res = await fetch("/api/content/batch-upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
                    body: JSON.stringify({ posts: validPosts }),
                  });
                  if (!res.ok) throw new Error("Upload failed");
                  toast.success(`Successfully uploaded ${validPosts.length} post(s) directly to approval!`);
                  setShowFastTrackModal(false);
                  onRefresh();
                } catch {
                  toast.error("Fast-track upload failed");
                }
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              <Zap className="h-4 w-4 mr-1.5 fill-current" /> Send Directly to Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: AI Script & Shot List Generator ── */}
      <Dialog open={showAiScriptModal} onOpenChange={setShowAiScriptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Script, Scene & Shot-List Generator
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Automatically creates a high-converting 3-second hook, scene-by-scene script table, and 6 on-set shot directions.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-bold">Topic or Inspiration Reference</label>
              <Input
                placeholder="e.g. 3 secret agency frameworks for 10x ROI"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiScriptModal(false)}>Cancel</Button>
            <Button onClick={handleGenerateAiScript} disabled={aiLoading} className="font-bold">
              {aiLoading ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Generate Playbook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Fullscreen Teleprompter Mode ── */}
      <Dialog open={showTeleprompterModal} onOpenChange={setShowTeleprompterModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] bg-black text-white border-slate-800 flex flex-col p-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-lg text-white font-heading">On-Set Teleprompter</h3>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs">
                <span>Speed:</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={teleprompterSpeed}
                  onChange={(e) => setTeleprompterSpeed(Number(e.target.value))}
                  className="w-20"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span>Size:</span>
                <input
                  type="range"
                  min="20"
                  max="60"
                  value={teleprompterFontSize}
                  onChange={(e) => setTeleprompterFontSize(Number(e.target.value))}
                  className="w-20"
                />
              </div>

              <Button
                size="sm"
                onClick={() => setTeleprompterPlaying(!teleprompterPlaying)}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold h-8"
              >
                {teleprompterPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1 fill-current" />}
                {teleprompterPlaying ? "Pause" : "Start Scroll"}
              </Button>
            </div>
          </div>

          {/* Teleprompter Scroll Box */}
          <div
            ref={teleprompterScrollRef}
            className="flex-1 overflow-y-auto py-12 px-6 text-center leading-relaxed font-bold tracking-wide select-none"
            style={{ fontSize: `${teleprompterFontSize}px` }}
          >
            {activePost?.conceptHook && (
              <div className="text-amber-400 mb-8 border-b border-amber-500/30 pb-4">
                [HOOK] {activePost.conceptHook}
              </div>
            )}

            {activePost?.scriptBody ? (
              <div className="whitespace-pre-wrap">{activePost.scriptBody}</div>
            ) : Array.isArray(activePost?.scriptScenes) && activePost.scriptScenes.length > 0 ? (
              activePost.scriptScenes.map((sc: any, idx: number) => (
                <div key={sc.id || idx} className="mb-10">
                  <div className="text-sm font-mono text-slate-400 mb-2">Scene {sc.sceneNo} ({sc.timecode})</div>
                  <div className="text-white mb-2">"{sc.spokenAudio}"</div>
                  <div className="text-primary text-lg">[{sc.onScreenText}]</div>
                </div>
              ))
            ) : (
              <div className="text-slate-500">No script content found.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

