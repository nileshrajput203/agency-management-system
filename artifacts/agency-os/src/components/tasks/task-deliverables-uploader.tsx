import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload, X, Eye, FileText, Image as ImageIcon, Video, Loader2,
  ExternalLink, Download, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

export interface TaskAttachmentItem {
  id: string;
  filename: string;
  url: string;
  createdAt?: string;
}

interface TaskDeliverablesUploaderProps {
  taskId?: string | null;
  initialAttachments?: TaskAttachmentItem[];
  deliverableLink?: string;
  onDeliverableLinkChange?: (val: string) => void;
  onAttachmentsChange?: (attachments: TaskAttachmentItem[]) => void;
  readOnly?: boolean;
}

export function TaskDeliverablesUploader({
  taskId,
  initialAttachments = [],
  deliverableLink = "",
  onDeliverableLinkChange,
  onAttachmentsChange,
  readOnly = false,
}: TaskDeliverablesUploaderProps) {
  const [attachments, setAttachments] = useState<TaskAttachmentItem[]>(initialAttachments);
  const [isUploading, setIsUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<TaskAttachmentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync if initialAttachments changes
  React.useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!taskId) {
      toast.error("Please save the task before uploading files");
      return;
    }

    const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
    setIsUploading(true);

    try {
      const newAttachments = [...attachments];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);

        // 1. Upload file binary
        const uploadRes = await fetch("/api/uploads", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to upload ${file.name}`);
        }

        const uploadData = await uploadRes.json();
        const fileUrl = uploadData.url || uploadData.filePath;

        // 2. Link file attachment to this task
        const attachRes = await fetch("/api/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            entityType: "task",
            entityId: taskId,
            filename: file.name,
            url: fileUrl,
          }),
        });

        if (!attachRes.ok) {
          const errData = await attachRes.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to link attachment for ${file.name}`);
        }

        const savedAttach = await attachRes.json();
        newAttachments.push({
          id: savedAttach.id,
          filename: savedAttach.filename || file.name,
          url: savedAttach.url || fileUrl,
          createdAt: savedAttach.createdAt,
        });
      }

      setAttachments(newAttachments);
      onAttachmentsChange?.(newAttachments);
      toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (id: string) => {
    const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
    try {
      const res = await fetch(`/api/attachments/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to delete attachment");

      const updated = attachments.filter((a) => a.id !== id);
      setAttachments(updated);
      onAttachmentsChange?.(updated);
      toast.success("Attachment removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete attachment");
    }
  };

  const isImage = (filename?: string, url?: string) => {
    const str = (filename || url || "").toLowerCase();
    return /\.(png|jpe?g|webp|gif|svg)$/.test(str) || str.startsWith("data:image");
  };

  const isVideo = (filename?: string, url?: string) => {
    const str = (filename || url || "").toLowerCase();
    return /\.(mp4|webm|mov|mkv)$/.test(str);
  };

  return (
    <div className="space-y-3.5 p-3.5 rounded-xl border border-border/70 bg-muted/20">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5 text-primary" /> Upload Work / Deliverables
          </Label>
          <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground border-border/60">
            Optional
          </Badge>
        </div>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isUploading || !taskId}
            onClick={() => fileInputRef.current?.click()}
            className="h-7 text-xs px-2.5 gap-1.5 font-semibold text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3 w-3" /> Select Graphic / File
              </>
            )}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Graphic designers & content creators can upload post images, reels, or design drafts. Uploading is optional — you can also share a link below.
      </p>

      {/* Deliverable Link Input */}
      {onDeliverableLinkChange && (
        <div className="space-y-1">
          <Label className="text-[11px] font-semibold text-muted-foreground">
            Design Link / Google Drive / Figma / Canva (Optional)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              value={deliverableLink}
              onChange={(e) => onDeliverableLinkChange(e.target.value)}
              placeholder="https://drive.google.com/… or https://figma.com/…"
              disabled={readOnly}
              className="text-xs h-8 bg-background"
            />
            {deliverableLink && (deliverableLink.startsWith("http://") || deliverableLink.startsWith("https://")) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs gap-1 shrink-0 text-primary hover:bg-primary/10"
                onClick={() => window.open(deliverableLink, "_blank")}
                title="Open link in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Uploaded Files Grid */}
      {attachments.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <span className="text-[11px] font-bold text-foreground">
            Attached Work ({attachments.length}):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {attachments.map((att) => {
              const imageFile = isImage(att.filename, att.url);
              const videoFile = isVideo(att.filename, att.url);
              return (
                <div
                  key={att.id}
                  className="group relative rounded-lg border border-border/60 bg-background overflow-hidden p-1.5 flex flex-col justify-between hover:border-primary/50 transition-all shadow-2xs"
                >
                  {/* Thumbnail / Media Preview */}
                  <div
                    className="relative w-full aspect-video rounded bg-muted/30 overflow-hidden flex items-center justify-center cursor-pointer"
                    onClick={() => setPreviewItem(att)}
                  >
                    {imageFile ? (
                      <img
                        src={att.url}
                        alt={att.filename}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : videoFile ? (
                      <div className="flex flex-col items-center text-muted-foreground gap-1">
                        <Video className="h-6 w-6 text-primary" />
                        <span className="text-[9px] font-semibold">Video</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground gap-1">
                        <FileText className="h-6 w-6 text-primary" />
                        <span className="text-[9px] font-semibold">Document</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-6 w-6 rounded-full bg-white/90 text-black shadow-xs hover:bg-white"
                        title="Preview artwork"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        download={att.filename}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 w-6 rounded-full bg-white/90 text-black flex items-center justify-center hover:bg-white shadow-xs"
                        title="Download file"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* File name & delete */}
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-medium text-foreground truncate" title={att.filename}>
                      {att.filename}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-muted-foreground hover:text-rose-500 p-0.5 rounded transition-colors"
                        title="Delete attachment"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox / Preview Modal for Design Quality Inspection */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-4">
          <DialogHeader className="pb-2 border-b border-border/40">
            <DialogTitle className="text-sm font-bold truncate flex items-center justify-between pr-6">
              <span>{previewItem?.filename}</span>
              <a
                href={previewItem?.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                Open Full <ExternalLink className="h-3 w-3" />
              </a>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-muted/10 rounded-lg">
            {previewItem && isImage(previewItem.filename, previewItem.url) ? (
              <img
                src={previewItem.url}
                alt={previewItem.filename}
                className="max-h-[70vh] w-auto max-w-full rounded object-contain shadow-md"
              />
            ) : previewItem && isVideo(previewItem.filename, previewItem.url) ? (
              <video
                src={previewItem.url}
                controls
                className="max-h-[70vh] w-full rounded shadow-md"
              />
            ) : (
              <div className="text-center p-8 space-y-3">
                <FileText className="h-12 w-12 text-primary mx-auto" />
                <p className="text-sm font-semibold">{previewItem?.filename}</p>
                <Button
                  onClick={() => window.open(previewItem?.url, "_blank")}
                  size="sm"
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> View / Download Document
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

