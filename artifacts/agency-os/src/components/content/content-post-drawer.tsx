import { useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  FileText, Trash2, Send, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
  Paperclip, Clock, Calendar, Image, Link2, Settings2, Plus, X, MessageSquare,
  UploadCloud, Download, FileX,
} from "lucide-react";
import {
  STATUS_CONFIG, FORMAT_OPTIONS, PLATFORM_OPTIONS, parseClientRevision,
  PanelState, PostRecord, getTodayDateString, triggerFileDownload,
} from "./content-constants";

interface ContentPostDrawerProps {
  panel: PanelState;
  setPanel: (panel: PanelState) => void;
  draft: any;
  setDraft: React.Dispatch<React.SetStateAction<any>>;
  activePost: PostRecord | null;
  activeClient: any;
  clients: any[] | undefined;
  isPending: boolean;
  savePost: (overridePayload?: any) => void;
  deleteMutation: any;
  newComment: string;
  setNewComment: (val: string) => void;
}

export function ContentPostDrawer({
  panel,
  setPanel,
  draft,
  setDraft,
  activePost,
  activeClient,
  clients,
  isPending,
  savePost,
  deleteMutation,
  newComment,
  setNewComment,
}: ContentPostDrawerProps) {
  const commentInputRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof typeof draft>(key: K, value: typeof draft[K]) {
    setDraft((d: any) => ({ ...d, [key]: value }));
  }

  function addCustomProp() {
    setField("customProperties", [...draft.customProperties, { key: "", value: "" }]);
  }

  function updateCustomProp(i: number, field: "key" | "value", val: string) {
    const next = draft.customProperties.map((p: any, idx: number) => idx === i ? { ...p, [field]: val } : p);
    setField("customProperties", next);
  }

  function removeCustomProp(i: number) {
    setField("customProperties", draft.customProperties.filter((_: any, idx: number) => idx !== i));
  }

  function addComment() {
    if (!newComment.trim()) return;
    const comment = { id: crypto.randomUUID(), text: newComment.trim(), createdAt: new Date().toISOString() };
    setField("comments", [...draft.comments, comment]);
    setNewComment("");
  }

  function removeComment(id: string) {
    setField("comments", draft.comments.filter((c: any) => c.id !== id));
  }

  return (
    <Sheet open={panel.mode !== "closed"} onOpenChange={(open) => { if (!open) setPanel({ mode: "closed" }); }}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl sm:w-[85vw] lg:w-[70vw] overflow-y-auto p-0" side="right">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xs border-b border-border px-6 py-4 flex items-center justify-between">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {panel.mode === "create" ? "New Content Post" : "Edit Content Post"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2">
            {panel.mode === "edit" && (
              <Button
                size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => { if (panel.mode === "edit" && activePost) deleteMutation.mutate({ id: activePost.id }); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" onClick={savePost} disabled={isPending} className="gap-1.5 font-semibold btn-micro-anim">
              <Send className="h-3.5 w-3.5" />
              {isPending ? "Saving…" : panel.mode === "create" ? "Create Post" : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Client Action & Feedback Panel */}
          {panel.mode === "edit" && activePost && (() => {
            const approvalStatus = (activePost as any)?.approvalStatus || (draft.status === "ADMIN_APPROVED" ? "APPROVED" : draft.status === "REJECTED" ? "REJECTED" : "PENDING");
            const revision = parseClientRevision(draft.comments, activePost?.rejectionNote);
            const isApproved = approvalStatus === "APPROVED";
            const isRejected = !isApproved && approvalStatus === "REJECTED";
            const isNeedsChanges = !isApproved && !isRejected && (draft.needsRevision === true || (approvalStatus === "NEEDS_CHANGES" && draft.needsRevision !== false) || (!!revision && draft.needsRevision !== false));

            if (isApproved) {
              return (
                <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 space-y-3 shadow-xs animated-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-600 text-white font-bold shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-extrabold text-emerald-950 dark:text-emerald-100 uppercase tracking-wider">
                            ✓ Approved by Client
                          </h3>
                          <Badge className="bg-emerald-600 text-white text-[9px] uppercase font-bold px-2 py-0.5">
                            APPROVED
                          </Badge>
                        </div>
                        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                          Submitted by <span className="font-semibold">{activeClient?.companyName || "Client"}</span>
                          {(activePost as any)?.approvedAt && ` • ${format(new Date((activePost as any).approvedAt), "dd MMM yyyy, hh:mm a")}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-3 text-xs text-foreground space-y-1">
                    <p className="font-bold text-[10px] text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Client Action Summary:</p>
                    <p className="text-slate-800 dark:text-slate-200">
                      This content item was reviewed and approved by <span className="font-semibold">{activeClient?.companyName || "Client"}</span>. It is ready for scheduling or publishing according to plan.
                    </p>
                  </div>
                </div>
              );
            }

            if (isRejected) {
              return (
                <div className="rounded-xl border-2 border-red-500/50 bg-red-50/80 dark:bg-red-950/40 p-4 space-y-3 shadow-xs animated-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-red-600 text-white font-bold shrink-0">
                        <XCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-extrabold text-red-950 dark:text-red-100 uppercase tracking-wider">
                            ✕ Rejected by Client
                          </h3>
                          <Badge variant="destructive" className="text-[9px] uppercase font-bold px-2 py-0.5">
                            REJECTED
                          </Badge>
                        </div>
                        <p className="text-[11px] text-red-800/80 dark:text-red-300/80 mt-0.5">
                          Submitted by <span className="font-semibold">{activeClient?.companyName || "Client"}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/90 dark:bg-slate-900/90 border border-red-200 dark:border-red-900/60 rounded-lg p-3.5 text-xs text-foreground space-y-1.5">
                    <p className="font-bold text-[10px] text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Exact Rejection Reason:
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed text-red-950 dark:text-red-100 font-medium bg-red-50/50 dark:bg-red-950/30 p-2.5 rounded-md border border-red-200/60 dark:border-red-900/40">
                      "{activePost?.rejectionNote || draft.rejectionNote || "No rejection reason specified."}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-[11px] text-red-800 dark:text-red-300 font-medium">
                      Update content to resolve client concerns or reset status.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 font-semibold text-xs gap-1.5 shrink-0"
                      onClick={() => {
                        setField("needsRevision", true);
                        setField("status", "SCRIPTING");
                        toast.info("Status moved back to Scripting for rework.");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rework Post
                    </Button>
                  </div>
                </div>
              );
            }

            if (isNeedsChanges) {
              return (
                <div className="rounded-xl border-2 border-amber-500/50 bg-amber-50/80 dark:bg-amber-950/40 p-4 space-y-3 shadow-xs animated-fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-amber-500 text-white font-bold shrink-0">
                        <RotateCcw className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-extrabold text-amber-950 dark:text-amber-100 uppercase tracking-wider">
                            ⚠ Client Requested Changes
                          </h3>
                          {revision?.priority && (
                            <Badge className={cn(
                              "text-[9px] uppercase font-bold px-1.5 py-0",
                              revision.priority === "URGENT"
                                ? "bg-red-600 text-white"
                                : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                            )}>
                              {revision.priority} Priority
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                          Submitted by <span className="font-semibold">{activeClient?.companyName || "Client"}</span>
                          {revision?.createdAt && ` • ${format(new Date(revision.createdAt), "dd MMM yyyy, hh:mm a")}`}
                        </p>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-900 dark:text-amber-200 bg-amber-100/50 shrink-0 font-medium">
                      {revision?.category || "Revision"}
                    </Badge>
                  </div>

                  {revision?.subject && (
                    <div className="text-xs font-bold text-amber-950 dark:text-amber-100 px-1">
                      Subject: {revision.subject}
                    </div>
                  )}

                  <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-lg p-3.5 text-xs text-foreground space-y-2">
                    <p className="font-bold text-[10px] text-amber-800 dark:text-amber-400 uppercase tracking-wider">Requested Changes Details:</p>
                    <p className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                      {revision?.description || activePost?.rejectionNote || "The client requested changes to this content post."}
                    </p>
                    {revision?.attachmentUrl && (
                      <div className="mt-2 pt-2 border-t border-amber-100 dark:border-amber-900/30 flex items-center gap-1.5 text-primary font-medium">
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <a href={revision.attachmentUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-full">
                          View Client Attachment
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                      Review changes and mark resolved when completed.
                    </p>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-xs shrink-0 btn-micro-anim"
                      onClick={() => {
                        const resolvedComment = {
                          id: crypto.randomUUID(),
                          text: `[REVISION RESOLVED] Client revision marked as resolved by agency team.`,
                          createdAt: new Date().toISOString(),
                        };
                        const updatedComments = [...(draft.comments || []), resolvedComment];
                        setField("needsRevision", false);
                        setField("approvalStatus", "PENDING");
                        setField("comments", updatedComments);
                        toast.success("Client revision marked as resolved!");
                        savePost({
                          needsRevision: false,
                          approvalStatus: "PENDING",
                          comments: updatedComments,
                        });
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Mark Revision Resolved
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="font-bold text-blue-950 dark:text-blue-200">Client Approval Status: Pending Review</p>
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                      Visible on client shared portal for {activeClient?.companyName || "Client"}.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-100/50 shrink-0 text-[10px]">
                  IN REVIEW
                </Badge>
              </div>
            );
          })()}

          <WriteWithAI
            context="content-post"
            onFill={(fields) => {
              if (fields.title) setField("title", fields.title);
              if (fields.caption) setField("caption", fields.caption);
              if (fields.platform) setField("platform", fields.platform);
              if (fields.contentType) setField("contentType", fields.contentType);
              if (fields.status) setField("status", fields.status);
            }}
          />

          {/* Basic Information Group */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Basic Information
            </h3>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Content Title / Name</Label>
              <Input placeholder="Post title or content name…" value={draft.title} onChange={(e) => setField("title", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={draft.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Platform</Label>
                <Select value={draft.platform} onValueChange={(v) => setField("platform", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Format</Label>
                <Select value={draft.format || "__none__"} onValueChange={(v) => setField("format", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {FORMAT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client</Label>
                <Select value={draft.clientId || "__none__"} onValueChange={(v) => setField("clientId", v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No client</SelectItem>
                    {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Scheduling Group */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Scheduling & Timelines
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Post Date</Label>
                <Input
                  type="date"
                  min={getTodayDateString()}
                  value={draft.scheduledAt?.slice(0, 10) ?? ""}
                  onChange={(e) => setField("scheduledAt", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Shoot Date</Label>
                <Input
                  type="date"
                  min={getTodayDateString()}
                  value={draft.shootDate?.slice(0, 10) ?? ""}
                  onChange={(e) => setField("shootDate", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Content & Media Assets Group */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5 text-primary" /> Content & Assets
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Media File / Assets Link
                </Label>
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  <UploadCloud className="h-3.5 w-3.5" />
                  Upload File
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      try {
                        const res = await fetch("/api/uploads", {
                          method: "POST",
                          body: formData,
                        });
                        if (!res.ok) throw new Error("Upload failed");
                        const data = await res.json();
                        setField("assetsLink", data.url);
                        toast.success("File uploaded successfully");
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to upload file");
                      }
                    }}
                  />
                </label>
              </div>

              <Input placeholder="https://drive.google.com/… or /api/uploads/…" value={draft.assetsLink} onChange={(e) => setField("assetsLink", e.target.value)} />

              {draft.assetsLink ? (
                <div className="flex items-center justify-between bg-muted/60 p-2.5 rounded-lg border border-border">
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{draft.assetsLink}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 text-primary border-primary/30"
                    onClick={() => triggerFileDownload(draft.assetsLink, draft.title || "media-file")}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic bg-muted/30 p-2 rounded-lg border border-dashed border-border">
                  <FileX className="h-3.5 w-3.5 text-muted-foreground/70" />
                  No File Available — upload a media file or paste an asset link above
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Caption / Copy Notes</Label>
              <Textarea placeholder="Write your caption or content copy here…" rows={4} value={draft.caption} onChange={(e) => setField("caption", e.target.value)} />
            </div>
          </div>

          {/* Flag & Status Control */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RotateCcw className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Needs Revision Flag</p>
                <p className="text-xs text-muted-foreground">Flag this post for pending revisions or team attention</p>
              </div>
            </div>
            <Switch checked={draft.needsRevision as boolean} onCheckedChange={(v) => setField("needsRevision", v)} />
          </div>

          {/* Custom Properties */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-primary" /> Custom Properties
              </Label>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={addCustomProp}>
                <Plus className="h-3 w-3" /> Add Property
              </Button>
            </div>
            {draft.customProperties.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No custom properties configured.</p>
            ) : (
              <div className="space-y-2">
                {draft.customProperties.map((prop: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="h-8 text-xs" placeholder="Property name" value={prop.key} onChange={(e) => updateCustomProp(i, "key", e.target.value)} />
                    <Input className="h-8 text-xs" placeholder="Value" value={prop.value} onChange={(e) => updateCustomProp(i, "value", e.target.value)} />
                    <button className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1" onClick={() => removeCustomProp(i)}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow Activity Timeline */}
          {panel.mode === "edit" && activePost && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Content Activity & Approval History
              </Label>
              <div className="relative pl-4 space-y-3 border-l-2 border-muted ml-1 py-1">
                <div className="relative">
                  <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-background" />
                  <p className="text-xs font-semibold text-foreground">Post Created</p>
                  <p className="text-[11px] text-muted-foreground">
                    {activePost.createdAt ? format(new Date(activePost.createdAt), "dd MMM yyyy, hh:mm a") : "Initial Draft"}
                  </p>
                </div>

                {draft.clientId && (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-background" />
                    <p className="text-xs font-semibold text-foreground">Shared with Client Portal</p>
                    <p className="text-[11px] text-muted-foreground">
                      Assigned to {activeClient?.companyName || "Client"}
                    </p>
                  </div>
                )}

                {Array.isArray(draft.comments) && draft.comments.map((cmt: any, idx: number) => {
                  const text = cmt?.text || cmt?.comment || "";
                  const isRevision = text.includes("[CLIENT REVISION REQUEST");
                  const isResolved = text.includes("[REVISION RESOLVED]");
                  if (!isRevision && !isResolved) return null;

                  return (
                    <div key={cmt.id || idx} className="relative">
                      <div className={cn(
                        "absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                        isRevision ? "bg-amber-500" : "bg-emerald-500"
                      )} />
                      <p className={cn("text-xs font-semibold", isRevision ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                        {isRevision ? "Client Requested Revision" : "Agency Resolved Revision"}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {text.replace(/^\[CLIENT REVISION REQUEST[^\]]*\]/, "").replace(/^\[REVISION RESOLVED\]/, "").trim()}
                      </p>
                      {cmt.createdAt && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {format(new Date(cmt.createdAt), "dd MMM yyyy, hh:mm a")}
                        </p>
                      )}
                    </div>
                  );
                })}

                {(activePost as any)?.approvalStatus === "APPROVED" ? (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-background" />
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ Approved by Client</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(activePost as any)?.approvedAt ? format(new Date((activePost as any).approvedAt), "dd MMM yyyy, hh:mm a") : "Final Approval Recorded"}
                    </p>
                  </div>
                ) : (activePost as any)?.approvalStatus === "REJECTED" ? (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-4 ring-background" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">✕ Rejected by Client</p>
                    <p className="text-[11px] text-muted-foreground">
                      Reason: "{activePost?.rejectionNote || "No reason given"}"
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className={cn("absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full ring-4 ring-background", draft.needsRevision ? "bg-amber-500" : "bg-blue-500")} />
                    <p className="text-xs font-semibold text-foreground">
                      Current Status: {STATUS_CONFIG[draft.status ?? "IDEA"]?.label || draft.status}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {draft.needsRevision ? "Needs Changes (Revision Flag Active)" : "Pending Review / Active"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" /> Team & Client Comments
            </Label>
            {draft.comments.length > 0 && (
              <div className="space-y-2">
                {draft.comments.map((c: any) => (
                  <div key={c.id} className="flex items-start gap-2 group/comment">
                    <div className="flex-1 bg-muted/60 rounded-lg px-3 py-2">
                      <p className="text-xs whitespace-pre-wrap">{c.text}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(c.createdAt), "dd MMM, hh:mm a")}</p>
                    </div>
                    <button
                      className="opacity-0 group-hover/comment:opacity-100 transition-opacity mt-2 text-muted-foreground hover:text-destructive p-1"
                      onClick={() => removeComment(c.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Input
                ref={commentInputRef}
                placeholder="Add a comment or internal note…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment(); } }}
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={addComment} disabled={!newComment.trim()} className="text-xs shrink-0">Add</Button>
            </div>
          </div>

          <div className="h-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
