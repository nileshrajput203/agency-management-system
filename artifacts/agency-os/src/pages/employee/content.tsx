import { useState, useRef, useEffect } from "react";
import {
  useListContentPosts, useUpdateContentPost, getListContentPostsQueryKey, useListClients, useListUsers,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchBar } from "@/components/common/SearchBar";
import {
  Calendar, Clock, FileText, Upload, ArrowRight, Eye, CheckCircle,
  Film, Camera, Scissors, Zap, AlertTriangle, ExternalLink, Play,
  Pause, CheckSquare, Square, Check, RefreshCw, Plus, Trash2, Send
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, PLATFORM_ICON, isNeedsRevision } from "@/components/content/content-constants";

export default function EmployeeContentPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("my_queue");

  // Teleprompter state
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  const [teleprompterPost, setTeleprompterPost] = useState<any | null>(null);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(2);
  const [teleprompterPlaying, setTeleprompterPlaying] = useState(false);
  const teleprompterRef = useRef<HTMLDivElement | null>(null);

  // Handoff to Editor Modal
  const [handoffPost, setHandoffPost] = useState<any | null>(null);
  const [rawFootageUrl, setRawFootageUrl] = useState("");
  const [videographerNotes, setVideographerNotes] = useState("");
  const [selectedEditorId, setSelectedEditorId] = useState("");
  const [isHandoffSubmitting, setIsHandoffSubmitting] = useState(false);

  // Send for Approval Modal (Editor)
  const [submitApprovalPost, setSubmitApprovalPost] = useState<any | null>(null);
  const [assetsLink, setAssetsLink] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [qcChecklist, setQcChecklist] = useState<Record<string, boolean>>({
    hookChecked: true,
    brandGuidelinesMatched: true,
    subtitlesVerified: true,
    safeZoneChecked: true,
    audioBalanced: true,
    ctaIncluded: true,
  });

  // Fast-track state
  const [fastTrackClient, setFastTrackClient] = useState("");
  const [fastTrackPlatform, setFastTrackPlatform] = useState("INSTAGRAM");
  const [fastTrackFormat, setFastTrackFormat] = useState("REEL");
  const [fastTrackList, setFastTrackList] = useState<Array<{ title: string; url: string; caption: string }>>([
    { title: "", url: "", caption: "" }
  ]);

  const { data: posts, isLoading } = useListContentPosts();
  const { data: clients } = useListClients();
  const { data: users } = useListUsers();

  // Filter posts where user is actively involved
  const myQueuePosts = (posts ?? []).filter((p: any) => {
    return (
      p.currentOwnerId === user?.id ||
      p.assigneeId === user?.id ||
      p.videographerId === user?.id ||
      p.editorId === user?.id ||
      p.ideationAssignedTo === user?.id ||
      p.authorId === user?.id
    );
  });

  // Shoot posts (for Videographers & Strategists)
  const shootPosts = (posts ?? []).filter((p: any) =>
    p.status === "SHOOTING" || (p.shootDate && !["ADMIN_APPROVED", "PUBLISHED"].includes(p.status))
  );

  // Editing posts (for Video Editors & Designers)
  const editingPosts = (posts ?? []).filter((p: any) =>
    ["PRODUCTION", "DESIGNING"].includes(p.status) || (isNeedsRevision(p.needsRevision) && p.editorId === user?.id)
  );

  // Teleprompter scroll loop
  useEffect(() => {
    let interval: any;
    if (showTeleprompter && teleprompterPlaying && teleprompterRef.current) {
      interval = setInterval(() => {
        if (teleprompterRef.current) {
          teleprompterRef.current.scrollTop += teleprompterSpeed;
        }
      }, 30);
    }
    return () => clearInterval(interval);
  }, [showTeleprompter, teleprompterPlaying, teleprompterSpeed]);

  // Handoff to Editor submission
  const handleVideographerHandoff = async () => {
    if (!handoffPost) return;
    if (!rawFootageUrl.trim()) {
      toast.warning("Please paste the raw footage link (Google Drive, NAS, Dropbox)");
      return;
    }
    setIsHandoffSubmitting(true);
    try {
      const res = await fetch(`/api/content/${handoffPost.id}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({
          action: "TO_PRODUCTION",
          payload: {
            rawFootageUrl,
            videographerNotes,
            editorId: selectedEditorId || handoffPost.editorId,
          },
        }),
      });
      if (!res.ok) throw new Error("Handoff failed");
      toast.success("Raw footage handed off to Video Editor successfully!");
      setHandoffPost(null);
      setRawFootageUrl("");
      setVideographerNotes("");
      qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
    } catch (err: any) {
      toast.error(err.message || "Failed to complete handoff");
    } finally {
      setIsHandoffSubmitting(false);
    }
  };

  // Editor submit for approval
  const handleEditorSubmitApproval = async () => {
    if (!submitApprovalPost) return;
    if (!assetsLink.trim()) {
      toast.warning("Please provide the final deliverable link");
      return;
    }
    setIsHandoffSubmitting(true);
    try {
      const res = await fetch(`/api/content/${submitApprovalPost.id}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
        body: JSON.stringify({
          action: "TO_IN_REVIEW",
          payload: {
            assetsLink,
            mediaFiles: [assetsLink],
            note: versionNote || "Ready for approval",
            qcChecklist,
          },
        }),
      });
      if (!res.ok) throw new Error("Submission failed");
      toast.success("Submitted for PC review and approval!");
      setSubmitApprovalPost(null);
      setAssetsLink("");
      setVersionNote("");
      qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit for approval");
    } finally {
      setIsHandoffSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" /> Employee Content Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Role-based production queues: write scripts, shoot with teleprompter, hand off raw footage & edit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search posts…" value={search} onChange={setSearch} />
          <Button
            size="sm"
            onClick={() => setActiveTab("fast_track")}
            className="h-9 gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            <Zap className="h-3.5 w-3.5 fill-current" /> Fast-Track Upload
          </Button>
        </div>
      </div>

      {/* 4 Role-Focused Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 w-full">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="my_queue" className="gap-1.5 text-xs font-semibold">
            🔥 My Active Queue ({myQueuePosts.length})
          </TabsTrigger>
          <TabsTrigger value="shoots" className="gap-1.5 text-xs font-semibold">
            🎥 Shoot & Reference Hub ({shootPosts.length})
          </TabsTrigger>
          <TabsTrigger value="editing" className="gap-1.5 text-xs font-semibold">
            ✂️ Editing & Post-Production ({editingPosts.length})
          </TabsTrigger>
          <TabsTrigger value="fast_track" className="gap-1.5 text-xs font-semibold">
            ⚡ Fast-Track Upload
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: My Active Queue ── */}
        <TabsContent value="my_queue" className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : myQueuePosts.length === 0 ? (
            <div className="text-center py-16 bg-card border rounded-2xl p-8">
              <CheckCircle className="h-10 w-10 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold">Your queue is clear!</h3>
              <p className="text-xs text-muted-foreground mt-1">No pending shoot or edit tasks currently assigned to you.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myQueuePosts.map((p: any) => {
                const sc = STATUS_CONFIG[p.status || "IDEA"] || STATUS_CONFIG.IDEA;
                const isRevision = isNeedsRevision(p.needsRevision) || p.internalApprovalStatus === "CHANGES_REQUESTED";

                // Action badge label
                let actionBadge = "View Details";
                let actionColor = "bg-primary/10 text-primary";
                if (isRevision) {
                  actionBadge = "Fix Revision Requested";
                  actionColor = "bg-rose-500/15 text-rose-700 dark:text-rose-300";
                } else if (p.status === "SHOOTING") {
                  actionBadge = "Shoot Today & Log Raw Footage";
                  actionColor = "bg-orange-500/15 text-orange-700 dark:text-orange-300";
                } else if (p.status === "PRODUCTION") {
                  actionBadge = "Edit Raw Footage";
                  actionColor = "bg-purple-500/15 text-purple-700 dark:text-purple-300";
                } else if (["IDEA", "SCRIPTING"].includes(p.status)) {
                  actionBadge = "Write Script & Shot List";
                  actionColor = "bg-blue-500/15 text-blue-700 dark:text-blue-300";
                }

                return (
                  <Card key={p.id} className="border hover:border-primary/40 transition-all rounded-xl p-4 flex flex-col justify-between space-y-3 bg-card shadow-xs">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{p.clientName || "Client"}</span>
                        <div className="flex items-center gap-1">
                          {PLATFORM_ICON[p.platform || "INSTAGRAM"]}
                          <Badge variant="secondary" className={cn("text-[9px] px-1 py-0", sc.className)}>{sc.label}</Badge>
                        </div>
                      </div>

                      <h4 className="font-bold text-sm text-foreground line-clamp-1">{p.title || p.conceptHook || "Social Post"}</h4>
                      {p.conceptHook && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">"{p.conceptHook}"</p>
                      )}

                      <div className="mt-3">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md", actionColor)}>
                          {actionBadge}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {p.scheduledAt ? `Post: ${p.scheduledAt.split("T")[0]}` : p.shootDate ? `Shoot: ${p.shootDate}` : ""}
                      </span>

                      {p.status === "SHOOTING" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setHandoffPost(p);
                            setSelectedEditorId(p.editorId || "");
                          }}
                          className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                        >
                          <Camera className="h-3 w-3 mr-1" /> Hand Off Footage
                        </Button>
                      ) : p.status === "PRODUCTION" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSubmitApprovalPost(p);
                            setAssetsLink(p.assetsLink || "");
                          }}
                          className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                        >
                          <Scissors className="h-3 w-3 mr-1" /> Submit Edit
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTeleprompterPost(p);
                            setShowTeleprompter(true);
                          }}
                          className="h-7 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" /> Teleprompter
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: Shoot & Reference Hub ── */}
        <TabsContent value="shoots" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shootPosts.map((p: any) => (
              <Card key={p.id} className="border rounded-xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{p.clientName}</span>
                    <h3 className="font-bold text-sm">{p.title || "Untitled Shoot"}</h3>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-200">
                      Shoot: {p.shootDate || "Today"}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.shootLocation || "Studio"}</p>
                  </div>
                </div>

                {/* Hook & References */}
                {p.conceptHook && (
                  <div className="p-2.5 rounded-lg bg-muted/40 text-xs">
                    <strong className="text-primary block mb-0.5">Hook:</strong>
                    {p.conceptHook}
                  </div>
                )}

                {/* Reference Links & Trending Audio */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.trendingAudioUrl && (
                    <a
                      href={p.trendingAudioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-pink-500/10 text-pink-700 dark:text-pink-300 font-semibold"
                    >
                      🎵 Trending Audio <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {Array.isArray(p.referenceLinks) && p.referenceLinks.map((ref: any, idx: number) => (
                    <a
                      key={idx}
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                    >
                      🔗 {ref.title || "Ref"} ({ref.whatToCopy || "Style"}) <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTeleprompterPost(p);
                      setShowTeleprompter(true);
                    }}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Film className="h-3.5 w-3.5 text-primary" /> Open Teleprompter
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      setHandoffPost(p);
                      setSelectedEditorId(p.editorId || "");
                    }}
                    className="h-8 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1" /> Hand Off to Editor
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── TAB 3: Editing Queue ── */}
        <TabsContent value="editing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editingPosts.map((p: any) => (
              <Card key={p.id} className="border rounded-xl p-5 bg-card space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{p.clientName}</span>
                    <h3 className="font-bold text-sm">{p.title || "Editing Task"}</h3>
                  </div>
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-200">
                    {p.status}
                  </Badge>
                </div>

                {/* Raw Footage Link */}
                {p.rawFootageUrl ? (
                  <div className="p-2.5 rounded-lg bg-muted/40 text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-purple-600 block mb-0.5">Raw Footage Available:</strong>
                      <span className="text-muted-foreground truncate max-w-xs block">{p.rawFootageUrl}</span>
                    </div>
                    <a
                      href={p.rawFootageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-purple-600 text-white text-xs font-bold shrink-0 hover:bg-purple-700"
                    >
                      Download Footage
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Raw footage link not uploaded yet.</p>
                )}

                {/* Videographer notes */}
                {p.videographerNotes && (
                  <div className="text-xs p-2 rounded bg-amber-500/5 border border-amber-500/20 text-muted-foreground">
                    <strong className="text-amber-600">On-Set Notes:</strong> {p.videographerNotes}
                  </div>
                )}

                <div className="pt-2 border-t flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSubmitApprovalPost(p);
                      setAssetsLink(p.assetsLink || "");
                    }}
                    className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    <Scissors className="h-3.5 w-3.5 mr-1" /> Upload Finished Edit & Send to Approval
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── TAB 4: Fast-Track Upload ── */}
        <TabsContent value="fast_track" className="space-y-4">
          <Card className="p-6 max-w-2xl mx-auto border rounded-2xl bg-card shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500 fill-current" /> Fast-Track Ready Upload
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Upload ready videos or carousels straight to the PC Approval Studio without going through ideation or shoot stages.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Client</label>
                <Select value={fastTrackClient} onValueChange={setFastTrackClient}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Select Client" /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Platform</label>
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
                <label className="text-xs font-bold text-muted-foreground block mb-1">Format</label>
                <Select value={fastTrackFormat} onValueChange={setFastTrackFormat}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REEL">Reel / Short</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel</SelectItem>
                    <SelectItem value="POST">Single Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              {fastTrackList.map((item, idx) => (
                <div key={idx} className="p-3 border rounded-xl bg-background space-y-2">
                  <Input
                    placeholder="Post Title (e.g. 3 Tips for High Retention)"
                    value={item.title}
                    onChange={(e) => {
                      const next = [...fastTrackList];
                      next[idx].title = e.target.value;
                      setFastTrackList(next);
                    }}
                    className="text-xs h-8"
                  />
                  <Input
                    placeholder="Media Link (MP4 video link or Google Drive file)"
                    value={item.url}
                    onChange={(e) => {
                      const next = [...fastTrackList];
                      next[idx].url = e.target.value;
                      setFastTrackList(next);
                    }}
                    className="text-xs h-8"
                  />
                  <Textarea
                    placeholder="Caption & hashtags..."
                    value={item.caption}
                    onChange={(e) => {
                      const next = [...fastTrackList];
                      next[idx].caption = e.target.value;
                      setFastTrackList(next);
                    }}
                    className="text-xs h-16 resize-none"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={async () => {
                if (!fastTrackClient) {
                  toast.warning("Please select a client");
                  return;
                }
                const valid = fastTrackList.filter(f => f.url.trim() || f.title.trim()).map(f => ({
                  title: f.title || "Ready Deliverable",
                  clientId: fastTrackClient,
                  platform: fastTrackPlatform,
                  format: fastTrackFormat,
                  assetsLink: f.url,
                  mediaFiles: [f.url],
                  caption: f.caption,
                }));

                if (valid.length === 0) {
                  toast.warning("Please provide a media URL or title");
                  return;
                }

                try {
                  const res = await fetch("/api/content/batch-upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("agency_token") || localStorage.getItem("token") || ""}` },
                    body: JSON.stringify({ posts: valid }),
                  });
                  if (!res.ok) throw new Error("Upload failed");
                  toast.success("Uploaded directly to PC Approval Studio!");
                  setActiveTab("my_queue");
                  qc.invalidateQueries({ queryKey: getListContentPostsQueryKey() });
                } catch {
                  toast.error("Upload failed");
                }
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              <Zap className="h-4 w-4 mr-1.5 fill-current" /> Send Directly to PC Approval
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modal: Videographer Hand Off to Editor ── */}
      <Dialog open={!!handoffPost} onOpenChange={(open) => !open && setHandoffPost(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-orange-500" />
              Hand Off Raw Footage to Video Editor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Raw Footage Link (Google Drive / NAS)</label>
              <Input
                placeholder="https://drive.google.com/drive/folders/..."
                value={rawFootageUrl}
                onChange={(e) => setRawFootageUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Assign Video Editor</label>
              <Select value={selectedEditorId} onValueChange={setSelectedEditorId}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Select Editor" /></SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">On-Set Notes & Best Takes</label>
              <Textarea
                placeholder="e.g. Use Take 3 for hook, lapel mic on Track 1, B-roll is in folder 2..."
                value={videographerNotes}
                onChange={(e) => setVideographerNotes(e.target.value)}
                className="h-20 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoffPost(null)}>Cancel</Button>
            <Button
              onClick={handleVideographerHandoff}
              disabled={isHandoffSubmitting}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              <ArrowRight className="h-4 w-4 mr-1" /> Hand Off to Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editor Submit for Approval ── */}
      <Dialog open={!!submitApprovalPost} onOpenChange={(open) => !open && setSubmitApprovalPost(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-purple-600" />
              Submit Finished Edit for PC Approval
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold block mb-1">Deliverable Video / File URL</label>
              <Input
                placeholder="https://.../final-edit-v1.mp4"
                value={assetsLink}
                onChange={(e) => setAssetsLink(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">Version Notes</label>
              <Input
                placeholder="e.g. Version 1 with animated captions and music"
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
              />
            </div>

            <div className="border rounded-xl p-3 bg-muted/30 space-y-2">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Pre-Flight QC Checks</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {Object.keys(qcChecklist).map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qcChecklist[key]}
                      onChange={() => setQcChecklist(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="rounded"
                    />
                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitApprovalPost(null)}>Cancel</Button>
            <Button
              onClick={handleEditorSubmitApproval}
              disabled={isHandoffSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              <Send className="h-4 w-4 mr-1" /> Send for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Teleprompter ── */}
      <Dialog open={showTeleprompter} onOpenChange={setShowTeleprompter}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] bg-black text-white border-slate-800 flex flex-col p-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-lg text-white font-heading">On-Set Teleprompter</h3>
            <div className="flex items-center gap-3">
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

          <div
            ref={teleprompterRef}
            className="flex-1 overflow-y-auto py-12 px-6 text-center leading-relaxed font-bold tracking-wide select-none text-3xl"
          >
            {teleprompterPost?.conceptHook && (
              <div className="text-amber-400 mb-8 border-b border-amber-500/30 pb-4">
                [HOOK] {teleprompterPost.conceptHook}
              </div>
            )}
            <div className="whitespace-pre-wrap">{teleprompterPost?.scriptBody || teleprompterPost?.caption || "No script entered."}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
