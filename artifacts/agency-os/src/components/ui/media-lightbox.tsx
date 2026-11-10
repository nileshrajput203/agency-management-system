import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MediaItem {
  id?: string;
  url: string;
  filename?: string;
  title?: string;
  type?: "image" | "video" | "document";
}

export function isMediaImage(urlOrFilename?: string | null): boolean {
  if (!urlOrFilename) return false;
  const str = urlOrFilename.toLowerCase();
  return (
    /\.(png|jpe?g|webp|gif|svg|bmp|avif)(\?.*)?$/i.test(str) ||
    str.startsWith("data:image/") ||
    str.includes("image")
  );
}

export function isMediaVideo(urlOrFilename?: string | null): boolean {
  if (!urlOrFilename) return false;
  const str = urlOrFilename.toLowerCase();
  return (
    /\.(mp4|webm|mov|mkv|ogg|m4v)(\?.*)?$/i.test(str) ||
    str.startsWith("data:video/") ||
    str.includes("video")
  );
}

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MediaItem[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  onApprove?: () => void;
  onRequestRevisions?: () => void;
  canApprove?: boolean;
}

export function MediaLightbox({
  open,
  onOpenChange,
  items,
  initialIndex = 0,
  title,
  subtitle,
  onApprove,
  onRequestRevisions,
  canApprove = false,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)));
      setZoom(1);
    }
  }, [open, initialIndex, items.length]);

  if (!items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const isImage = isMediaImage(currentItem?.filename || currentItem?.url);
  const isVideo = isMediaVideo(currentItem?.filename || currentItem?.url);

  const handleNext = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setZoom(1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setZoom(1);
    }
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleResetZoom = () => setZoom(1);

  const displayFilename =
    currentItem?.filename ||
    (currentItem?.url ? currentItem.url.split("/").pop()?.split("?")[0] : "Media Artwork") ||
    "Media File";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl w-[95vw] p-0 flex flex-col bg-background/95 backdrop-blur-md border border-border/80 shadow-2xl transition-all duration-200 overflow-hidden",
          isFullScreen ? "max-w-[98vw] h-[96vh]" : "max-h-[92vh] h-[85vh]"
        )}
      >
        <DialogDescription className="sr-only">
          Preview of attached media deliverable
        </DialogDescription>
        {/* Header Bar */}
        <DialogHeader className="px-4 py-3 border-b border-border/60 bg-muted/30 flex flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              {isImage ? (
                <ImageIcon className="h-4 w-4 text-primary" />
              ) : isVideo ? (
                <VideoIcon className="h-4 w-4 text-primary" />
              ) : (
                <FileText className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold truncate text-foreground leading-tight">
                {title || displayFilename}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span className="truncate max-w-[200px]">{displayFilename}</span>
                {items.length > 1 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                    {currentIndex + 1} of {items.length}
                  </Badge>
                )}
                {subtitle && <span className="truncate">• {subtitle}</span>}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0 pr-6">
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 bg-muted/60 rounded-md p-0.5 border border-border/50">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground"
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleZoomIn}
                  title="Zoom In"
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:flex"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>

            <a
              href={currentItem?.url}
              download={displayFilename}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center h-7 px-2.5 rounded-md text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground gap-1.5 border border-border/60 transition-colors"
              title="Download original file"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            <a
              href={currentItem?.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Open full image in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </DialogHeader>

        {/* Media Viewing Canvas */}
        <div className="relative flex-1 bg-black/90 flex items-center justify-center overflow-auto p-4 select-none min-h-0">
          {items.length > 1 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 shadow-lg disabled:opacity-20"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                title="Previous media (Left Arrow)"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 shadow-lg disabled:opacity-20"
                onClick={handleNext}
                disabled={currentIndex === items.length - 1}
                title="Next media (Right Arrow)"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {isImage ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={currentItem?.url}
                alt={displayFilename}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                className="max-h-full max-w-full object-contain rounded transition-transform duration-150 shadow-2xl"
              />
            </div>
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              <video
                src={currentItem?.url}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full rounded shadow-2xl"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 text-center p-8 bg-background/90 rounded-2xl border border-border/80 shadow-xl max-w-md">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <p className="font-bold text-base text-foreground truncate max-w-xs">{displayFilename}</p>
                <p className="text-xs text-muted-foreground mt-1">Non-visual file format</p>
              </div>
              <a
                href={currentItem?.url}
                download={displayFilename}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" /> Download & View Document
              </a>
            </div>
          )}
        </div>

        {/* Thumbnail Filmstrip (if multiple attachments) */}
        {items.length > 1 && (
          <div className="px-4 py-2 bg-muted/40 border-t border-border/40 flex items-center justify-center gap-2 overflow-x-auto shrink-0">
            {items.map((item, idx) => {
              const itemIsImg = isMediaImage(item.filename || item.url);
              return (
                <button
                  key={item.id || item.url || idx}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    setZoom(1);
                  }}
                  className={cn(
                    "relative h-12 w-12 rounded-md overflow-hidden border-2 transition-all shrink-0 bg-background/80",
                    idx === currentIndex
                      ? "border-primary ring-2 ring-primary/30 scale-105"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  {itemIsImg ? (
                    <img
                      src={item.url}
                      alt={item.filename || `Item ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer Actions (Quick Approve / Request Revisions) */}
        {canApprove && (onApprove || onRequestRevisions) && (
          <div className="px-4 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Manager Quality Review:</span> Inspect deliverable before approving.
            </div>
            <div className="flex items-center gap-2">
              {onRequestRevisions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onRequestRevisions();
                    onOpenChange(false);
                  }}
                  className="h-8 text-xs px-3 border-rose-300 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30 font-semibold gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Request Revisions
                </Button>
              )}
              {onApprove && (
                <Button
                  size="sm"
                  onClick={() => {
                    onApprove();
                    onOpenChange(false);
                  }}
                  className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Complete Task
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

