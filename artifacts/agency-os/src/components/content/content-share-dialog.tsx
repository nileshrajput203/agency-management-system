import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Share2, Plus, Link2, Copy, Check, RefreshCw, Power, ExternalLink, Trash2 } from "lucide-react";
import { buildShareUrl } from "./content-constants";

interface ContentShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeClientId: string;
  activeClientName: string;
  existingShares: any[] | undefined;
  shareMutation: any;
  refetchShares: () => void;
}

export function ContentShareDialog({
  open,
  onOpenChange,
  activeClientId,
  activeClientName,
  existingShares,
  shareMutation,
  refetchShares,
}: ContentShareDialogProps) {
  const [shareFormLabel, setShareFormLabel] = useState("");
  const [shareFormExpiry, setShareFormExpiry] = useState("");
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [isRegeneratingShareId, setIsRegeneratingShareId] = useState<string | null>(null);

  const handleGenerateShare = () => {
    if (!activeClientId) return;
    shareMutation.mutate({
      data: {
        clientId: activeClientId,
        label: shareFormLabel.trim() || `${activeClientName} Content Calendar`,
        expiresAt: shareFormExpiry ? shareFormExpiry : undefined,
      },
    });
    setShareFormLabel("");
    setShareFormExpiry("");
  };

  const handleRegenerateShare = async (shareId: string) => {
    setIsRegeneratingShareId(shareId);
    try {
      const res = await fetch(`/api/content/shares/${shareId}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to regenerate share link");
      toast.success("New secure link generated! Previous link has been revoked.");
      refetchShares();
    } catch (e: any) {
      toast.error(e.message || "Failed to regenerate share link");
    } finally {
      setIsRegeneratingShareId(null);
    }
  };

  const handleToggleRevokeShare = async (shareId: string, currentRevoked: boolean) => {
    try {
      const res = await fetch(`/api/content/shares/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRevoked: !currentRevoked }),
      });
      if (!res.ok) throw new Error("Failed to update link status");
      toast.success(currentRevoked ? "Share link reactivated" : "Share link disabled");
      refetchShares();
    } catch (e: any) {
      toast.error(e.message || "Failed to update link");
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      const res = await fetch(`/api/content/shares/${shareId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete share link");
      toast.success("Share link deleted");
      refetchShares();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete share link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-1.5rem)] w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5">
        <DialogHeader className="pr-6">
          <DialogTitle className="text-base sm:text-xl font-bold flex items-center gap-2 text-foreground break-words leading-snug">
            <Share2 className="h-5 w-5 text-primary shrink-0" />
            <span className="break-words min-w-0">Calendar Sharing — {activeClientName}</span>
          </DialogTitle>
        </DialogHeader>

        {/* New Share Form */}
        <div className="bg-slate-50 dark:bg-slate-900/80 border border-border rounded-xl p-3.5 sm:p-4 space-y-3.5 w-full min-w-0 overflow-hidden">
          <h3 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 text-foreground">
            <Plus className="h-4 w-4 text-primary shrink-0" /> Generate Secure Link
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Note: Generating a link updates the existing secure token for this client so only 1 active link exists at any time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div className="space-y-1.5 min-w-0 w-full">
              <Label className="text-xs font-semibold">Link Label</Label>
              <Input
                className="text-xs w-full"
                placeholder={`${activeClientName} Content Calendar`}
                value={shareFormLabel}
                onChange={(e) => setShareFormLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 min-w-0 w-full">
              <Label className="text-xs font-semibold">Expiration Date (Optional)</Label>
              <Input
                className="text-xs w-full"
                type="date"
                value={shareFormExpiry}
                onChange={(e) => setShareFormExpiry(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerateShare}
            disabled={shareMutation.isPending || !activeClientId}
            className="w-full sm:w-auto gap-1.5 btn-micro-anim text-xs font-semibold"
          >
            <Link2 className="h-4 w-4 shrink-0" />
            {shareMutation.isPending ? "Generating..." : "Generate Secure Link"}
          </Button>
        </div>

        {/* Existing Links List */}
        <div className="space-y-3 min-w-0 w-full overflow-hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
            <span>Active Share Link ({existingShares?.length ?? 0})</span>
            <span className="text-[10px] text-muted-foreground font-normal">No login required for clients</span>
          </h3>

          {existingShares && existingShares.length > 0 ? (
            <div className="space-y-3 max-h-[360px] overflow-y-auto overflow-x-hidden pr-1 w-full">
              {existingShares.map((share: any) => {
                const shareUrl = buildShareUrl(share.shareToken);
                const isRevoked = share.isRevoked === "true";

                return (
                  <div
                    key={share.id}
                    className={cn(
                      "border rounded-xl p-3.5 sm:p-4 space-y-3 transition-colors min-w-0 w-full overflow-hidden",
                      isRevoked ? "bg-red-50/50 border-red-200 dark:bg-red-950/20" : "bg-card border-border"
                    )}
                  >
                    {/* Header line of card */}
                    <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-foreground break-words min-w-0">
                          {share.label || "Shared Calendar"}
                        </p>
                        {isRevoked && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">Revoked</Badge>
                        )}
                        {share.expiresAt && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                            Expires: {format(new Date(share.expiresAt), "MMM d, yyyy")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* URL display box with break-all to prevent horizontal overflow */}
                    <div className="bg-slate-100/80 dark:bg-slate-900/90 border border-border/70 rounded-lg p-2 sm:p-2.5 w-full min-w-0 overflow-hidden">
                      <p className="text-[11px] sm:text-xs text-muted-foreground font-mono break-all select-all leading-normal">
                        {shareUrl}
                      </p>
                    </div>

                    {/* Action buttons section - flex wrapped nicely */}
                    <div className="flex items-center gap-2 flex-wrap w-full pt-0.5 justify-start sm:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(shareUrl);
                          setCopiedShareId(share.id);
                          toast.success("Share link copied!");
                          setTimeout(() => setCopiedShareId(null), 2500);
                        }}
                        className="h-8 px-2.5 text-xs gap-1.5 flex-1 sm:flex-none"
                      >
                        {copiedShareId === share.id ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                        Copy Link
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerateShare(share.id)}
                        disabled={isRegeneratingShareId === share.id}
                        title="Generate a new secure token and revoke old one"
                        className="h-8 px-2.5 text-xs gap-1.5 text-slate-700 dark:text-slate-200 flex-1 sm:flex-none"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", isRegeneratingShareId === share.id && "animate-spin")} />
                        Regen
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleRevokeShare(share.id, isRevoked)}
                        className={cn("h-8 px-2.5 text-xs gap-1.5 flex-1 sm:flex-none", isRevoked ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" : "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30")}
                      >
                        <Power className="h-3.5 w-3.5 shrink-0" />
                        {isRevoked ? "Enable" : "Revoke"}
                      </Button>

                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-xs gap-1.5 text-primary flex-1 sm:flex-none")}
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        Open
                      </a>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteShare(share.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="Delete Share Link"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-2">No active share link generated yet for this client.</p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
