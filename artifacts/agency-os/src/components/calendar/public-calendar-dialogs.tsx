import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Send,
  Sparkles, ExternalLink, Tag, FileText, ImageIcon, Layers
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PublicCalendarDialogsProps {
  viewPost: any | null;
  setViewPost: (post: any | null) => void;
  approvalConfig: Record<string, { label: string; className: string; icon: React.ReactNode }>;
  platformIcon: Record<string, React.ReactNode>;
  extractHashtags: (text: string | null) => string[];
  handleApprove: (postId: string) => void;
  isSubmittingApprove: boolean;

  showChangeModal: boolean;
  setShowChangeModal: (show: boolean) => void;
  changeForm: {
    subject: string;
    category: string;
    description: string;
    priority: string;
    attachmentUrl: string;
  };
  setChangeForm: React.Dispatch<React.SetStateAction<{
    subject: string;
    category: string;
    description: string;
    priority: string;
    attachmentUrl: string;
  }>>;
  handleRequestChanges: (e: React.FormEvent) => void;
  isSubmittingChange: boolean;
  categoryOptions: string[];

  showRejectModal: boolean;
  setShowRejectModal: (show: boolean) => void;
  rejectReason: string;
  setRejectReason: (reason: string) => void;
  handleReject: (e: React.FormEvent) => void;
  isSubmittingReject: boolean;

  showIdeaModal: boolean;
  setShowIdeaModal: (show: boolean) => void;
  ideaForm: {
    title: string;
    platform: string;
    contentType: string;
    description: string;
  };
  setIdeaForm: React.Dispatch<React.SetStateAction<{
    title: string;
    platform: string;
    contentType: string;
    description: string;
  }>>;
  handleSubmitIdea: (e: React.FormEvent) => void;
  isSubmittingIdea: boolean;
}

export function PublicCalendarDialogs({
  viewPost,
  setViewPost,
  approvalConfig,
  platformIcon,
  extractHashtags,
  handleApprove,
  isSubmittingApprove,

  showChangeModal,
  setShowChangeModal,
  changeForm,
  setChangeForm,
  handleRequestChanges,
  isSubmittingChange,
  categoryOptions,

  showRejectModal,
  setShowRejectModal,
  rejectReason,
  setRejectReason,
  handleReject,
  isSubmittingReject,

  showIdeaModal,
  setShowIdeaModal,
  ideaForm,
  setIdeaForm,
  handleSubmitIdea,
  isSubmittingIdea,
}: PublicCalendarDialogsProps) {
  return (
    <>
      {/* ─── Client Content Detail View Modal ────────────────────── */}
      <Dialog open={!!viewPost} onOpenChange={(open) => !open && setViewPost(null)}>
        <DialogContent className="max-w-3xl w-[92vw] sm:w-full max-h-[88vh] overflow-y-auto p-4 sm:p-6 space-y-5 overflow-x-hidden min-w-0">
          {viewPost && (
            <div className="min-w-0 w-full">
              {/* Top Meta Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {platformIcon[viewPost.platform ?? "INSTAGRAM"]}
                  <span className="font-bold text-xs sm:text-sm uppercase tracking-wider">{viewPost.platform}</span>
                  <span className="text-muted-foreground">•</span>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">{viewPost.contentType || "POST"}</Badge>
                </div>
                {approvalConfig[viewPost.approvalStatus ?? "PENDING"] && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 px-2.5 py-1 font-semibold text-xs border shrink-0",
                      approvalConfig[viewPost.approvalStatus ?? "PENDING"]?.className
                    )}
                  >
                    {approvalConfig[viewPost.approvalStatus ?? "PENDING"]?.icon}
                    {approvalConfig[viewPost.approvalStatus ?? "PENDING"]?.label}
                  </Badge>
                )}
              </div>

              {/* Title & Date */}
              <div className="mt-4 space-y-1 min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold font-heading break-words max-w-full leading-tight">{viewPost.title || "Untitled Post"}</h2>
                {viewPost.scheduledAt && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Scheduled for {format(new Date(viewPost.scheduledAt), "EEEE, MMMM d, yyyy 'at' hh:mm a")}
                  </p>
                )}
              </div>

              {/* Creative Media Preview */}
              <div className="mt-5 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> Creative Assets Preview
                </p>
                {viewPost.mediaUrls && viewPost.mediaUrls.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                    {viewPost.mediaUrls.map((url: string, idx: number) => (
                      <div key={idx} className="rounded-xl overflow-hidden border border-border bg-slate-100 dark:bg-slate-800 relative group">
                        <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-48 object-cover" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1"
                        >
                          <ExternalLink className="h-4 w-4" /> View Fullscreen
                        </a>
                      </div>
                    ))}
                  </div>
                ) : viewPost.assetsLink ? (
                  <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0 w-full overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0 flex-1 w-full overflow-hidden">
                      <div className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg shrink-0">
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-xs font-semibold">Shared Drive Assets</p>
                        <p className="text-[11px] text-muted-foreground truncate select-all">{viewPost.assetsLink}</p>
                      </div>
                    </div>
                    <a
                      href={viewPost.assetsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1 text-xs shrink-0 w-full sm:w-auto justify-center")}
                    >
                      Open Link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-900/60 border border-dashed border-border rounded-xl p-5 text-center text-muted-foreground space-y-1 min-w-0">
                    <ImageIcon className="h-8 w-8 mx-auto text-slate-400" />
                    <p className="text-xs font-medium">Creative media / graphic in production</p>
                  </div>
                )}
              </div>

              {/* Caption Card */}
              {viewPost.caption && (
                <div className="mt-5 space-y-2 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Caption
                  </p>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200 min-w-0 max-w-full">
                    {viewPost.caption}
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {extractHashtags(viewPost.caption).length > 0 && (
                <div className="mt-4 space-y-2 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Hashtags
                  </p>
                  <div className="flex flex-wrap gap-1.5 min-w-0">
                    {extractHashtags(viewPost.caption).map((tag) => (
                      <span key={tag} className="text-xs bg-primary/10 text-primary font-medium px-2.5 py-1 rounded-md break-all">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Script / Ideation Details */}
              {(viewPost.script || viewPost.ideation) && (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                  {viewPost.script && (
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📝 Script / Hook</p>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-border p-3 rounded-xl text-xs whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                        {viewPost.script}
                      </div>
                    </div>
                  )}
                  {viewPost.ideation && (
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">💡 Content Goal / Concept</p>
                      <div className="bg-slate-50 dark:bg-slate-900 border border-border p-3 rounded-xl text-xs whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">
                        {viewPost.ideation}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Agency Notes or Rejection Note */}
              {viewPost.rejectionNote && (
                <div className="mt-5 space-y-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 min-w-0">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /> Revision / Feedback Notes:
                  </p>
                  <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap break-words">{viewPost.rejectionNote}</p>
                </div>
              )}

              {/* ─── Bottom Client Action Bar ───────────────────── */}
              <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0 w-full">
                <p className="text-xs text-muted-foreground font-medium shrink-0">
                  Client Action
                </p>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                  {/* Approve Button */}
                  <Button
                    size="sm"
                    onClick={() => handleApprove(viewPost.id)}
                    disabled={isSubmittingApprove || viewPost.approvalStatus === "APPROVED"}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 btn-micro-anim flex-1 sm:flex-initial text-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {viewPost.approvalStatus === "APPROVED" ? "Approved" : "Approve Content"}
                  </Button>

                  {/* Request Changes Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowChangeModal(true)}
                    className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40 gap-1.5 flex-1 sm:flex-initial text-xs"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Request Changes
                  </Button>

                  {/* Reject Button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRejectModal(true)}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5 text-xs flex-1 sm:flex-initial"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Request Changes Modal ───────────────────────────────── */}
      <Dialog open={showChangeModal} onOpenChange={setShowChangeModal}>
        <DialogContent className="max-w-lg w-[92vw] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 overflow-x-hidden min-w-0">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-600 shrink-0" />
              Request Changes / Revisions
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRequestChanges} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject *</Label>
              <Input
                placeholder="e.g. Update image, change caption wording..."
                value={changeForm.subject}
                onChange={(e) => setChangeForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Select
                  value={changeForm.category}
                  onValueChange={(val) => setChangeForm((f) => ({ ...f, category: val }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Priority</Label>
                <Select
                  value={changeForm.priority}
                  onValueChange={(val) => setChangeForm((f) => ({ ...f, priority: val }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Detailed Description *</Label>
              <Textarea
                placeholder="Please describe exactly what you would like changed (e.g. Use our updated logo, replace first image, move post to Friday)..."
                rows={4}
                value={changeForm.description}
                onChange={(e) => setChangeForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reference Image / Document Link (Optional)</Label>
              <Input
                placeholder="https://drive.google.com/..."
                value={changeForm.attachmentUrl}
                onChange={(e) => setChangeForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowChangeModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingChange} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                <Send className="h-4 w-4" />
                {isSubmittingChange ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Modal ───────────────────────────────────────── */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md w-[92vw] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 overflow-x-hidden min-w-0">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5 shrink-0" />
              Reject Content Item
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleReject} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Rejection *</Label>
              <Textarea
                placeholder="Please explain why this content item is being rejected..."
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingReject} variant="destructive" className="gap-1.5">
                {isSubmittingReject ? "Recording..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Suggest Idea Modal ──────────────────────────────────── */}
      <Dialog open={showIdeaModal} onOpenChange={setShowIdeaModal}>
        <DialogContent className="max-w-lg w-[92vw] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 overflow-x-hidden min-w-0">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              Suggest New Content Idea
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitIdea} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Idea Title *</Label>
              <Input
                placeholder="e.g., Independence Day offer, Customer spotlight, Behind the scenes Reel..."
                value={ideaForm.title}
                onChange={(e) => setIdeaForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Platform</Label>
                <Select
                  value={ideaForm.platform}
                  onValueChange={(val) => setIdeaForm((f) => ({ ...f, platform: val }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                    <SelectItem value="FACEBOOK">Facebook</SelectItem>
                    <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                    <SelectItem value="TIKTOK">TikTok</SelectItem>
                    <SelectItem value="YOUTUBE">YouTube</SelectItem>
                    <SelectItem value="TWITTER">X (Twitter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Content Type</Label>
                <Select
                  value={ideaForm.contentType}
                  onValueChange={(val) => setIdeaForm((f) => ({ ...f, contentType: val }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">Post / Photo</SelectItem>
                    <SelectItem value="REEL">Reel / Short Video</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel</SelectItem>
                    <SelectItem value="STORY">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description / Concept Details</Label>
              <Textarea
                placeholder="Describe your vision, campaign goal, key messages, or product features to highlight..."
                rows={4}
                value={ideaForm.description}
                onChange={(e) => setIdeaForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowIdeaModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingIdea} className="gap-1.5">
                <Send className="h-4 w-4" />
                {isSubmittingIdea ? "Submitting..." : "Submit Idea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
