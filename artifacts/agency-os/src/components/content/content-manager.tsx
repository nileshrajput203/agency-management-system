"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Calendar,
  List,
  ArrowLeft,
  Share2,
  Layers,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { CONTENT_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { ContentForm } from "./content-form";
import { CAPTION_TEMPLATES } from "./content-types";
import { isPastDate } from "./content-constants";
import { ContentDetailDialog } from "./content-detail-dialog";
import { ContentPublishingOverlay } from "./content-publishing-overlay";
import { ContentAnalyticsTab } from "./content-analytics-tab";

import { ContentKanbanView } from "./content-kanban-view";
import { ContentCalendarView } from "./content-calendar-view";
import { ContentAyrshareQueueLog } from "./content-ayrshare-queue-log";
import { ContentWorkspacesTable } from "./content-workspaces-table";
import { ContentOneClickPublisher } from "./content-one-click-publisher";
import { ContentBulkQueueView } from "./content-bulk-queue-view";

export function ContentManager({
  posts,
  clients,
  assignees,
  canManage,
  isAdmin,
}: {
  posts: {
    id: string;
    title: string;
    caption: string | null;
    script: string | null;
    status: string;
    platforms: string;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    publishProof: string | null;
    client: { companyName: string };
  }[];
  clients: { id: string; companyName: string }[];
  assignees: { id: string; name: string }[];
  canManage: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");
  const [selectedPost, setSelectedPost] = useState<typeof posts[0] | null>(null);

  // Calendar & Local Post States
  const [localPosts, setLocalPosts] = useState(posts);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [defaultScheduleDate, setDefaultScheduleDate] = useState("");

  // Tab State: calendar vs client publishing hub
  const [activeMainTab, setActiveMainTab] = useState<"calendar" | "hub">("calendar");

  // Client Hub States
  const [activeHubClient, setActiveHubClient] = useState<{ id: string; companyName: string } | null>(null);
  const [hubMode, setHubMode] = useState<"admin" | "handler">("handler");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"publisher" | "bulk" | "analytics">("publisher");

  // One-Click Form States
  const [stagedFile, setStagedFile] = useState<{ name: string; size: string; type: "video" | "image" } | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "tiktok", "youtube_shorts", "instagram_reels", "facebook_reels", "snapchat", "x", "threads", "bluesky"
  ]);
  const [defaultCaption, setDefaultCaption] = useState("");
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [customCover, setCustomCover] = useState<string | null>(null);
  const [autoFirstComment, setAutoFirstComment] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [captionTemplate, setCaptionTemplate] = useState("");
  const [previewPlatform, setPreviewPlatform] = useState<string>("instagram_reels");

  // Simulated progress popup states
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState<"optimizing" | "uploading" | "first_comment" | "done">("optimizing");
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [platformProgress, setPlatformProgress] = useState<Record<string, number>>({});
  const [uploadLog, setUploadLog] = useState<string[]>([]);

  // Bulk Assets Staging Queue
  const [bulkQueue, setBulkQueue] = useState<Array<{
    id: string;
    title: string;
    file: { name: string; size: string; type: "video" | "image" };
    platforms: string[];
    caption: string;
    status: "Draft" | "Ready" | "Queued";
  }>>([
    {
      id: "q1",
      title: "Summer Collection Teaser Video",
      file: { name: "summer_teaser.mp4", size: "42.5 MB", type: "video" },
      platforms: ["tiktok", "instagram_reels", "youtube_shorts"],
      caption: "Get ready for the heat! ☀️ Our brand new summer lineup drops this Friday! #fashion #summervibe #newarrival",
      status: "Ready"
    },
    {
      id: "q2",
      title: "Behind The Scenes - Brand Store Delhi Launch",
      file: { name: "delhi_bts.mp4", size: "128.1 MB", type: "video" },
      platforms: ["youtube_shorts", "instagram_reels", "facebook_reels", "bluesky"],
      caption: "A sneak peek of the absolute madness at the grand launch of the Delhi store! Thank you all for showing up! 🙌 #retail #bts",
      status: "Draft"
    }
  ]);

  // Keep localPosts in sync if initial posts change
  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // Handle template selection
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCaptionTemplate(val);
    if (val) {
      const template = CAPTION_TEMPLATES.find(t => t.name === val);
      if (template) {
        setDefaultCaption(template.text);
      }
    }
  };

  // Simulate file drops
  const handleSimulatedDrop = (type: "video" | "image") => {
    if (type === "video") {
      setStagedFile({ name: "campaign_reveal_9_16.mp4", size: "84.2 MB", type: "video" });
      toast.success("Short video staged successfully!");
    } else {
      setStagedFile({ name: "launch_banner_wide.png", size: "3.1 MB", type: "image" });
      toast.success("Post image staged successfully!");
    }
  };

  // Toggle cross-publishing targets
  const handleTogglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]
    );
  };

  // One-click publish trigger simulation
  const handlePublishNow = () => {
    if (!stagedFile) {
      toast.error("Please drag/drop or stage a video or image file first!");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Please select at least one publishing platform!");
      return;
    }

    setIsPublishing(true);
    setPublishStep("optimizing");
    setOptimizeProgress(0);
    setUploadLog(["Initializing format check..."]);

    // Phase 1: format checks (0-100%)
    const optInterval = setInterval(() => {
      setOptimizeProgress(prev => {
        if (prev >= 100) {
          clearInterval(optInterval);
          // Transition to uploading
          setPublishStep("uploading");
          setUploadLog(prevLog => [...prevLog, "Video format checks passed (9:16 vertical ratio).", "Audio compression leveled.", "Connecting platform streams...", "Starting parallel uploads..."]);
          startSimulatedUploads();
          return 100;
        }
        if (prev === 20) setUploadLog(prevLog => [...prevLog, "Analyzing aspect ratio..."]);
        if (prev === 50) setUploadLog(prevLog => [...prevLog, "Checking metadata compliance..."]);
        if (prev === 80) setUploadLog(prevLog => [...prevLog, "Optimizing container tags..."]);
        return prev + 10;
      });
    }, 150);
  };

  // Phase 2: parallel upload simulation
  const startSimulatedUploads = () => {
    const progress: Record<string, number> = {};
    selectedPlatforms.forEach(p => {
      progress[p] = 0;
    });
    setPlatformProgress(progress);

    const uploadInterval = setInterval(() => {
      let allDone = true;
      setPlatformProgress(prev => {
        const next = { ...prev };
        selectedPlatforms.forEach(p => {
          if (next[p] < 100) {
            next[p] = Math.min(100, next[p] + Math.floor(Math.random() * 20) + 5);
            allDone = false;
          }
        });

        if (allDone) {
          clearInterval(uploadInterval);
          // Transition to first comment
          if (autoFirstComment) {
            setPublishStep("first_comment");
            setUploadLog(prevLog => [...prevLog, "All platforms uploaded successfully.", "Initiating auto-posting of first comment templates..."]);
            setTimeout(() => {
              finalizePublish();
            }, 1200);
          } else {
            finalizePublish();
          }
        }
        return next;
      });
    }, 250);
  };

  // Finalize
  const finalizePublish = () => {
    setPublishStep("done");
    setUploadLog(prevLog => [
      ...prevLog,
      "First comments posted on TikTok & Instagram Reels.",
      "Coordinated launches successfully executed!",
      `Ayrshare Profile active ID: ${activeHubClient?.companyName.toLowerCase().replace(/\s/g, "")}`,
      "Engagement milestone tracking established."
    ]);

    // Append to local posts so it updates calendar instantly!
    const newPost = {
      id: `sim-${Date.now()}`,
      title: stagedFile?.name || "One-Click Social Video",
      caption: defaultCaption || "Coordinated platform publish",
      script: "Published instantly via Social Handler Hub",
      status: scheduleDate ? "ADMIN_APPROVED" : "PUBLISHED",
      platforms: JSON.stringify(selectedPlatforms),
      scheduledAt: scheduleDate ? new Date(scheduleDate) : new Date(),
      publishedAt: scheduleDate ? null : new Date(),
      publishProof: scheduleDate ? null : `sim-proof-ayrshare-${Date.now()}`,
      client: { companyName: activeHubClient?.companyName || "Client" }
    };
    
    setLocalPosts(prev => [newPost, ...prev]);
    toast.success(`Post successfully published across ${selectedPlatforms.length} platforms!`);
  };

  // Schedule Post simulation
  const handleSchedulePost = () => {
    if (!stagedFile) {
      toast.error("Please stage a file first.");
      return;
    }
    if (!scheduleDate) {
      toast.error("Please pick a schedule date & time.");
      return;
    }
    if (isPastDate(scheduleDate)) {
      toast.error("Post Date cannot be earlier than today's date. Please select today or a future date.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select platforms first.");
      return;
    }

    const scheduled = {
      id: `sim-sched-${Date.now()}`,
      title: stagedFile.name,
      caption: defaultCaption || "Scheduled platform release",
      script: "Scheduled in advance via One-Click Hub",
      status: "ADMIN_APPROVED",
      platforms: JSON.stringify(selectedPlatforms),
      scheduledAt: new Date(scheduleDate),
      publishedAt: null,
      publishProof: null,
      client: { companyName: activeHubClient?.companyName || "Client" }
    };

    setLocalPosts(prev => [scheduled, ...prev]);
    toast.success(`Successfully scheduled for ${new Date(scheduleDate).toLocaleString()} across ${selectedPlatforms.length} channels.`);
    setScheduleDate("");
    setStagedFile(null);
  };

  // Save Draft Simulation
  const handleSaveDraft = () => {
    if (!stagedFile) {
      toast.error("Provide a file to save draft.");
      return;
    }
    toast.success("Draft saved successfully inside Client workspace.");
    setStagedFile(null);
  };

  // Bulk publish simulation
  const handleBulkLaunch = () => {
    if (bulkQueue.length === 0) {
      toast.error("No ready items in queue.");
      return;
    }
    setIsPublishing(true);
    setPublishStep("optimizing");
    setOptimizeProgress(0);
    setUploadLog(["Initializing Bulk Release workflow..."]);

    const optInterval = setInterval(() => {
      setOptimizeProgress(prev => {
        if (prev >= 100) {
          clearInterval(optInterval);
          setPublishStep("uploading");
          setUploadLog(prevLog => [...prevLog, "Format checks completed for all bulk assets.", "Starting multi-channel pipeline..."]);
          
          const progress: Record<string, number> = {};
          selectedPlatforms.forEach(p => {
            progress[p] = 0;
          });
          setPlatformProgress(progress);

          const uploadInterval = setInterval(() => {
            let allDone = true;
            setPlatformProgress(prevP => {
              const next = { ...prevP };
              selectedPlatforms.forEach(p => {
                if (next[p] < 100) {
                  next[p] = Math.min(100, next[p] + 12);
                  allDone = false;
                }
              });
              if (allDone) {
                clearInterval(uploadInterval);
                setPublishStep("done");
                setUploadLog(l => [...l, "Bulk campaign published!", "Draft queues cleared."]);
                
                // Add all bulk posts to calendar
                const bulkPosts = bulkQueue.map((item, idx) => ({
                  id: `sim-bulk-${idx}-${Date.now()}`,
                  title: item.title,
                  caption: item.caption,
                  script: "Bulk Upload Queue item",
                  status: "PUBLISHED",
                  platforms: JSON.stringify(item.platforms),
                  scheduledAt: new Date(),
                  publishedAt: new Date(),
                  publishProof: `sim-proof-bulk-${idx}`,
                  client: { companyName: activeHubClient?.companyName || "Client" }
                }));

                setLocalPosts(prev => [...bulkPosts, ...prev]);
                setBulkQueue([]);
                toast.success("Bulk campaign released successfully!");
              }
              return next;
            });
          }, 150);
          return 100;
        }
        return prev + 25;
      });
    }, 100);
  };

  // Kanban view mapping
  const byStatus = CONTENT_STATUSES.map((status) => ({
    status,
    posts: localPosts.filter((p) => p.status === status),
  }));

  // Calendar dates generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();
  const daysArray = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArray.push({
      date: new Date(year, month - 1, prevMonthTotalDays - i),
      isCurrentMonth: false,
    });
  }
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  const totalCells = 42;
  const nextMonthPadding = totalCells - daysArray.length;
  for (let i = 1; i <= nextMonthPadding; i++) {
    daysArray.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(new Date(year, month + (direction === "prev" ? -1 : 1), 1));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PUBLISHED": return "default";
      case "IN_REVIEW": return "outline";
      case "ADMIN_APPROVED": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Tab Bar: Toggle Calendar vs. Hub */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 p-1 rounded-xl">
        <button
          onClick={() => setActiveMainTab("calendar")}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
            activeMainTab === "calendar" 
              ? "bg-slate-850 text-white border border-slate-700 shadow-md" 
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar className="h-4 w-4" /> Calendar & Workflows
        </button>
        <button
          onClick={() => setActiveMainTab("hub")}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition ${
            activeMainTab === "hub" 
              ? "bg-slate-850 text-white border border-slate-700 shadow-md" 
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Share2 className="h-4 w-4 text-primary" /> Client Social Publishing Hub
        </button>
      </div>

      {activeMainTab === "calendar" ? (
        /* Calendar / Kanban main view */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-card p-2.5 border rounded-xl shadow-sm soft-transition">
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                onClick={() => setViewMode("kanban")}
                className="flex items-center gap-1.5 text-xs btn-micro-anim"
              >
                <List className="h-3.5 w-3.5" /> List Columns
              </Button>
              <Button
                size="sm"
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                onClick={() => setViewMode("calendar")}
                className="flex items-center gap-1.5 text-xs btn-micro-anim"
              >
                <Calendar className="h-3.5 w-3.5" /> Interactive Calendar
              </Button>
            </div>

            {canManage && (
              <Dialog open={open} onOpenChange={(openState) => {
                setOpen(openState);
                if (!openState) setDefaultScheduleDate("");
              }}>
                <DialogTrigger render={<Button size="sm" className="btn-micro-anim" />}><Plus className="h-4 w-4 mr-1.5" />Add content</DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New content piece</DialogTitle></DialogHeader>
                  <ContentForm
                    clients={clients}
                    assignees={assignees}
                    onSuccess={() => setOpen(false)}
                    defaultDate={defaultScheduleDate}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          {viewMode === "kanban" ? (
            <ContentKanbanView
              byStatus={byStatus}
              onSelectPost={setSelectedPost}
              getStatusBadgeVariant={getStatusBadgeVariant}
            />
          ) : (
            <ContentCalendarView
              currentDate={currentDate}
              year={year}
              navigateMonth={navigateMonth}
              daysArray={daysArray}
              localPosts={localPosts}
              canManage={canManage}
              onSelectPost={setSelectedPost}
              onScheduleDateSelect={(formattedDate) => {
                setDefaultScheduleDate(formattedDate);
                setOpen(true);
              }}
            />
          )}

          {/* Ayrshare Simulated Queue log */}
          <ContentAyrshareQueueLog localPosts={localPosts} />
        </div>
      ) : (
        /* CLIENT SOCIAL PUBLISHING HUB VIEW */
        <div className="space-y-6">
          {!activeHubClient ? (
            /* BRAND/CLIENT TABLE LIST */
            <ContentWorkspacesTable
              clients={clients}
              onSelectClient={(c, mode) => {
                setActiveHubClient(c);
                setHubMode(mode);
              }}
            />
          ) : (
            /* BRAND WORKSPACE VIEW CONTAINER */
            <div className="space-y-6">
              {/* Back to clients & Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md">
                <div className="flex items-center gap-3">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-8 w-8 border-slate-800 hover:bg-slate-800"
                    onClick={() => setActiveHubClient(null)}
                  >
                    <ArrowLeft className="h-4 w-4 text-slate-400" />
                  </Button>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      {activeHubClient.companyName}
                      <Badge className={hubMode === "admin" ? "bg-blue-500 text-white" : "bg-primary text-white"}>
                        {hubMode === "admin" ? "Admin Mode" : "Handler Mode"}
                      </Badge>
                    </h2>
                    <p className="text-xs text-slate-400">Manage credentials, one-click coordinated publishing, and batch uploads.</p>
                  </div>
                </div>
                
                {/* Mode toggle */}
                <div className="flex items-center gap-1.5 border border-slate-800 p-0.5 rounded-lg bg-slate-950">
                  <button 
                    onClick={() => setHubMode("handler")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${hubMode === "handler" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-300"}`}
                  >
                    Handler
                  </button>
                  <button 
                    onClick={() => setHubMode("admin")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${hubMode === "admin" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-300"}`}
                  >
                    Admin
                  </button>
                </div>
              </div>

              {/* Sub Navigation Inside Workspace */}
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setActiveWorkspaceTab("publisher")}
                  className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeWorkspaceTab === "publisher" ? "border-primary text-white bg-slate-900/20" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Share2 className="h-4 w-4" /> One-Click Cross-Publisher
                </button>
                <button
                  onClick={() => setActiveWorkspaceTab("bulk")}
                  className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeWorkspaceTab === "bulk" ? "border-primary text-white bg-slate-900/20" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="h-4 w-4" /> Bulk Video Queue ({bulkQueue.length})
                </button>
                <button
                  onClick={() => setActiveWorkspaceTab("analytics")}
                  className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeWorkspaceTab === "analytics" ? "border-primary text-white bg-slate-900/20" : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <BarChart2 className="h-4 w-4" /> Performance & Analytics
                </button>
              </div>

              {activeWorkspaceTab === "publisher" && (
                <ContentOneClickPublisher
                  stagedFile={stagedFile}
                  setStagedFile={setStagedFile}
                  selectedPlatforms={selectedPlatforms}
                  handleTogglePlatform={handleTogglePlatform}
                  captionTemplate={captionTemplate}
                  handleTemplateChange={handleTemplateChange}
                  defaultCaption={defaultCaption}
                  setDefaultCaption={setDefaultCaption}
                  autoFirstComment={autoFirstComment}
                  setAutoFirstComment={setAutoFirstComment}
                  customThumbnail={customThumbnail}
                  setCustomThumbnail={setCustomThumbnail}
                  customCover={customCover}
                  setCustomCover={setCustomCover}
                  scheduleDate={scheduleDate}
                  setScheduleDate={setScheduleDate}
                  handleSchedulePost={handleSchedulePost}
                  handleSaveDraft={handleSaveDraft}
                  handlePublishNow={handlePublishNow}
                  handleSimulatedDrop={handleSimulatedDrop}
                  previewPlatform={previewPlatform}
                  setPreviewPlatform={setPreviewPlatform}
                  activeHubClient={activeHubClient}
                />
              )}

              {activeWorkspaceTab === "bulk" && (
                <ContentBulkQueueView
                  bulkQueue={bulkQueue}
                  setBulkQueue={setBulkQueue}
                  handleBulkLaunch={handleBulkLaunch}
                />
              )}

              {activeWorkspaceTab === "analytics" && (
                <ContentAnalyticsTab />
              )}
            </div>
          )}
        </div>
      )}

      {/* Post Viewer & Verification Proof Dialog */}
      <ContentDetailDialog
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        canManage={canManage}
        isAdmin={isAdmin}
      />

      {/* COOPERATIVE MULTI-PLATFORM PUBLISHING OVERLAY PROGRESS */}
      <ContentPublishingOverlay
        isPublishing={isPublishing}
        publishStep={publishStep}
        optimizeProgress={optimizeProgress}
        selectedPlatforms={selectedPlatforms}
        platformProgress={platformProgress}
        uploadLog={uploadLog}
        onClose={() => setIsPublishing(false)}
      />
    </div>
  );
}
