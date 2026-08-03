import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Check,
  Info,
  Send,
  Video,
  X as CloseIcon,
} from "lucide-react";
import { PLATFORMS, CAPTION_TEMPLATES } from "./content-types";
import { getTodayDateString } from "./content-constants";

type StagedFile = {
  name: string;
  size: string;
  type: "video" | "image";
};

type Client = {
  id: string;
  companyName: string;
};

interface ContentOneClickPublisherProps {
  stagedFile: StagedFile | null;
  setStagedFile: (file: StagedFile | null) => void;
  selectedPlatforms: string[];
  handleTogglePlatform: (id: string) => void;
  captionTemplate: string;
  handleTemplateChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  defaultCaption: string;
  setDefaultCaption: (caption: string) => void;
  autoFirstComment: boolean;
  setAutoFirstComment: (val: boolean) => void;
  customThumbnail: string | null;
  setCustomThumbnail: (val: string | null) => void;
  customCover: string | null;
  setCustomCover: (val: string | null) => void;
  scheduleDate: string;
  setScheduleDate: (val: string) => void;
  handleSchedulePost: () => void;
  handleSaveDraft: () => void;
  handlePublishNow: () => void;
  handleSimulatedDrop: (type: "video" | "image") => void;
  previewPlatform: string;
  setPreviewPlatform: (val: string) => void;
  activeHubClient: Client;
}

export function ContentOneClickPublisher({
  stagedFile,
  setStagedFile,
  selectedPlatforms,
  handleTogglePlatform,
  captionTemplate,
  handleTemplateChange,
  defaultCaption,
  setDefaultCaption,
  autoFirstComment,
  setAutoFirstComment,
  customThumbnail,
  setCustomThumbnail,
  customCover,
  setCustomCover,
  scheduleDate,
  setScheduleDate,
  handleSchedulePost,
  handleSaveDraft,
  handlePublishNow,
  handleSimulatedDrop,
  previewPlatform,
  setPreviewPlatform,
  activeHubClient,
}: ContentOneClickPublisherProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left inputs */}
      <div className="lg:col-span-7 space-y-6">
        {/* Media Dropzone */}
        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardContent className="p-6">
            <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Stage Content Media File
            </Label>
            {!stagedFile ? (
              <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center bg-slate-950/20 hover:bg-slate-950/40 transition">
                <UploadCloud className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                <p className="text-xs text-slate-400 font-semibold">
                  Drag and drop or click to upload video or image
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Recommended: 9:16 vertical video for Reels/Shorts/TikTok (Max 500MB)
                </p>
                <div className="flex justify-center gap-2.5 mt-4">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleSimulatedDrop("video")}
                    className="h-7 text-[11px] border-slate-700 bg-slate-900"
                  >
                    <Film className="h-3 w-3 mr-1" /> Stage Demo Video
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleSimulatedDrop("image")}
                    className="h-7 text-[11px] border-slate-700 bg-slate-900"
                  >
                    <ImageIcon className="h-3 w-3 mr-1" /> Stage Demo Banner
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border border-slate-800 bg-slate-950/50 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-950 rounded-lg flex items-center justify-center text-primary border border-indigo-900/30">
                    {stagedFile.type === "video" ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <ImageIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-200">{stagedFile.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {stagedFile.size} • {stagedFile.type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => setStagedFile(null)}
                >
                  <CloseIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Selector Grid */}
        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardHeader className="py-3 bg-slate-950/10 border-b border-slate-800/50">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Target Cross-Publish Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {PLATFORMS.map((plat) => {
                const isSel = selectedPlatforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    onClick={() => handleTogglePlatform(plat.id)}
                    className={`p-3 rounded-lg border text-left flex flex-col justify-between gap-1 transition-all ${
                      isSel
                        ? `bg-slate-950 ${plat.border} shadow-sm ring-1 ring-primary/20`
                        : "border-slate-850 hover:border-slate-700 bg-slate-950/20"
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className={`text-xs font-bold ${isSel ? plat.color : "text-slate-400"}`}>
                        {plat.name}
                      </span>
                      {isSel && <Check className="h-3 w-3 text-primary font-bold" />}
                    </div>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono">
                      {isSel ? "Connected" : "Inactive"}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Core Captions and Templates */}
        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Default Content Messaging
              </Label>
              <select
                onChange={handleTemplateChange}
                value={captionTemplate}
                className="text-[11px] bg-slate-950 border border-slate-800 rounded px-2 h-7 text-slate-300"
              >
                <option value="">-- Apply Caption Template --</option>
                {CAPTION_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Textarea
                rows={3}
                placeholder="Enter the main message, call to action, and hashtags..."
                value={defaultCaption}
                onChange={(e) => setDefaultCaption(e.target.value)}
                className="bg-slate-950 border-slate-850 text-sm"
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-850">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-400">
                <input
                  type="checkbox"
                  checked={autoFirstComment}
                  onChange={(e) => setAutoFirstComment(e.target.checked)}
                  className="rounded border-slate-800 text-primary h-4 w-4 bg-slate-950"
                />
                Auto-post first comment on Reels & TikTok
              </label>

              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-indigo-400" />
                Increases platform SEO indexing.
              </div>
            </div>

            {/* Thumbnail / Covers block */}
            <div className="grid gap-3 md:grid-cols-2 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-400">
                  YT Shorts Thumbnail (Optional)
                </Label>
                <div className="border border-slate-850 rounded p-2 text-center bg-slate-950/20 text-[10px] text-slate-400 flex items-center justify-between h-9">
                  <span className="truncate max-w-[120px]">
                    {customThumbnail || "None selected"}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setCustomThumbnail("shorts_thumbnail.jpg")}
                    className="h-5 text-[9px] bg-slate-900 border border-slate-800"
                  >
                    Choose
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-slate-400">
                  Instagram Reels Cover (Optional)
                </Label>
                <div className="border border-slate-850 rounded p-2 text-center bg-slate-950/20 text-[10px] text-slate-400 flex items-center justify-between h-9">
                  <span className="truncate max-w-[120px]">
                    {customCover || "None selected"}
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => setCustomCover("reels_cover_art.png")}
                    className="h-5 text-[9px] bg-slate-900 border border-slate-800"
                  >
                    Choose
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Panel */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-4 border border-slate-800 rounded-xl shadow">
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              min={`${getTodayDateString()}T00:00`}
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="h-9 w-[190px] bg-slate-950 border-slate-800 text-xs"
            />
            <Button
              onClick={handleSchedulePost}
              variant="outline"
              className="h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
            >
              Schedule
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSaveDraft}
              variant="outline"
              className="h-9 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
            >
              Save Draft
            </Button>
            <Button
              onClick={handlePublishNow}
              className="h-9 text-xs font-bold bg-primary hover:bg-primary/95 text-white shadow-lg shadow-primary/10"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" /> Publish Now (One-Click)
            </Button>
          </div>
        </div>
      </div>

      {/* Right live device mockup preview */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardHeader className="py-3 bg-slate-950/10 border-b border-slate-800/50 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Live Platform Preview
            </CardTitle>
            <select
              value={previewPlatform}
              onChange={(e) => setPreviewPlatform(e.target.value)}
              className="text-[10px] bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5"
            >
              <option value="instagram_reels">Instagram Reels</option>
              <option value="tiktok">TikTok Video</option>
              <option value="youtube_shorts">YouTube Shorts</option>
              <option value="x">X Post</option>
            </select>
          </CardHeader>
          <CardContent className="p-4 flex justify-center">
            {/* Device Frame */}
            <div className="border-[6px] border-slate-800 rounded-[28px] w-64 overflow-hidden bg-black aspect-[9/16] shadow-2xl relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-full z-20" />

              {previewPlatform === "x" ? (
                /* X Tweet preview */
                <div className="p-4 text-white text-xs space-y-3 h-full overflow-y-auto bg-slate-950">
                  <div className="flex items-center gap-2 pt-4">
                    <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-[10px]">
                      {activeHubClient.companyName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold leading-none">{activeHubClient.companyName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        @{activeHubClient.companyName.toLowerCase().replace(/\s+/g, "")}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {defaultCaption || "Type a caption to preview how it looks here..."}
                  </p>
                  {stagedFile && (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900 aspect-video flex flex-col items-center justify-center relative">
                      <Film className="h-8 w-8 text-slate-500" />
                      <span className="text-[8px] text-slate-400 mt-1">{stagedFile.name}</span>
                    </div>
                  )}
                  <div className="text-[9px] text-slate-500 border-t border-slate-900 pt-2 flex justify-between">
                    <span>💬 0</span>
                    <span>🔄 0</span>
                    <span>❤️ 0</span>
                    <span>👁️ 0</span>
                  </div>
                </div>
              ) : (
                /* Short Vertical Video mock view */
                <div className="relative h-full w-full bg-slate-950 flex flex-col justify-between p-4 pt-10">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/75 z-10" />
                  <div className="absolute inset-0 bg-indigo-950/20 flex flex-col items-center justify-center">
                    <Film className="h-10 w-10 text-slate-700 animate-pulse" />
                    <span className="text-[9px] text-slate-500 mt-1">Simulated Live Video</span>
                  </div>

                  <div className="relative z-20 flex justify-between items-center text-[10px] text-slate-300 font-semibold pt-1">
                    <span>Following</span>
                    <span className="underline decoration-primary decoration-2 underline-offset-4 text-white">
                      For You
                    </span>
                    <span>Live</span>
                  </div>

                  <div className="relative z-20 flex flex-row items-end justify-between mt-auto">
                    <div className="max-w-[80%] space-y-1.5 text-white">
                      <p className="text-[11px] font-bold">
                        @{activeHubClient.companyName.toLowerCase().replace(/\s+/g, "")}
                      </p>
                      <p className="text-[9px] leading-snug line-clamp-3 text-slate-200">
                        {defaultCaption || "Staged content description here..."}
                      </p>
                      <p className="text-[8px] text-slate-400 flex items-center gap-1">
                        🎵 Original Sound - {activeHubClient.companyName}
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-3 text-slate-300 text-[10px]">
                      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center font-bold text-white text-[10px]">
                        {activeHubClient.companyName.substring(0, 2)}
                      </div>
                      <div className="flex flex-col items-center">
                        <span>❤️</span>
                        <span className="text-[8px] text-slate-400">12k</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span>💬</span>
                        <span className="text-[8px] text-slate-400">420</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span>📥</span>
                        <span className="text-[8px] text-slate-400">Share</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
