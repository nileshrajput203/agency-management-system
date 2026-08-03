import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { PLATFORMS } from "./content-types";

interface ContentPublishingOverlayProps {
  isPublishing: boolean;
  publishStep: "optimizing" | "uploading" | "first_comment" | "done";
  optimizeProgress: number;
  selectedPlatforms: string[];
  platformProgress: Record<string, number>;
  uploadLog: string[];
  onClose: () => void;
}

export function ContentPublishingOverlay({
  isPublishing,
  publishStep,
  optimizeProgress,
  selectedPlatforms,
  platformProgress,
  uploadLog,
  onClose,
}: ContentPublishingOverlayProps) {
  if (!isPublishing) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="border-slate-800 bg-slate-900 text-slate-100 max-w-lg w-full">
        <CardHeader className="border-b border-slate-800 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            {publishStep !== "done" ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
            )}
            Coordinated Social Release Pipeline
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Ayrshare profile key validated. Uploading format-optimized content stream.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Step 1: Format Checks */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">1. Automatic video format optimization check</span>
              <span className="text-slate-400">{optimizeProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-850">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-150"
                style={{ width: `${optimizeProgress}%` }}
              />
            </div>
          </div>

          {/* Step 2: Multi-Platform Uploads */}
          {publishStep !== "optimizing" && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2. Coordinated Platform Channels</p>
              <div className="grid gap-2 max-h-[180px] overflow-y-auto pr-1">
                {selectedPlatforms.map((platId) => {
                  const plat = PLATFORMS.find(p => p.id === platId);
                  const prog = platformProgress[platId] || 0;
                  return (
                    <div key={platId} className="border border-slate-850 bg-slate-950/40 p-2.5 rounded-lg flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-semibold flex items-center gap-1.5 ${plat?.color}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {plat?.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {prog >= 100 ? "Uploaded & Live" : `Uploading (${prog}%)`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${prog}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Console Logs */}
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity Streams</p>
            <div className="bg-slate-950 border border-slate-850 rounded p-2.5 h-[100px] overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1">
              {uploadLog.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600 font-bold select-none">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-850/80 pt-3 flex justify-between bg-slate-950/20">
          <span className="text-[10px] text-slate-500">Mode: Simulated Live Post</span>
          {publishStep === "done" && (
            <Button 
              size="sm"
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold px-4 h-8"
            >
              Close & View Calendar
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
