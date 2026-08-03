import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Send, X as CloseIcon } from "lucide-react";
import { toast } from "sonner";
import { PLATFORMS } from "./content-types";

type BulkItem = {
  id: string;
  title: string;
  file: { name: string; size: string; type: "video" | "image" };
  platforms: string[];
  caption: string;
  status: "Draft" | "Ready" | "Queued";
};

interface ContentBulkQueueViewProps {
  bulkQueue: BulkItem[];
  setBulkQueue: React.Dispatch<React.SetStateAction<BulkItem[]>>;
  handleBulkLaunch: () => void;
}

export function ContentBulkQueueView({
  bulkQueue,
  setBulkQueue,
  handleBulkLaunch,
}: ContentBulkQueueViewProps) {
  return (
    <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800 bg-slate-950/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold text-slate-200">
            Bulk Video Assets Queue
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Upload multiple vertical clips, write customized platform hooks, and publish all in one click.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-xs font-semibold h-8"
          onClick={() => {
            const newQ: BulkItem = {
              id: `q-${Date.now()}`,
              title: `Staged Clip #${bulkQueue.length + 1}`,
              file: {
                name: `clip_${Date.now().toString().slice(-4)}.mp4`,
                size: "32.1 MB",
                type: "video",
              },
              platforms: ["tiktok", "instagram_reels", "youtube_shorts"],
              caption: "Coordinated marketing push. 🌟 #brand #marketing",
              status: "Ready",
            };
            setBulkQueue((prev) => [...prev, newQ]);
            toast.success("Additional bulk asset queued!");
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Asset to Queue
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {bulkQueue.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-10">
            All queued bulk assets have been processed.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {bulkQueue.map((item, index) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/10"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                      #{index + 1}
                    </span>
                    <p className="text-xs font-bold text-slate-200">{item.title}</p>
                    <Badge variant="outline" className="text-[8px] px-1 border-slate-700 text-slate-400">
                      {item.file.name} ({item.file.size})
                    </Badge>
                  </div>
                  <Textarea
                    rows={2}
                    value={item.caption}
                    onChange={(e) => {
                      const text = e.target.value;
                      setBulkQueue((prev) =>
                        prev.map((q) => (q.id === item.id ? { ...q, caption: text } : q))
                      );
                    }}
                    className="bg-slate-950 border-slate-850 text-xs w-full max-w-2xl mt-1.5"
                  />
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {item.platforms.map((plat) => {
                      const pDet = PLATFORMS.find((p) => p.id === plat);
                      return (
                        <span
                          key={plat}
                          className={`text-[8px] px-1.5 py-0.5 rounded font-bold border uppercase ${pDet?.bg} ${pDet?.color} ${pDet?.border}`}
                        >
                          {plat.replace("_reels", "").replace("_shorts", "")}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">Status</p>
                    <p className="text-xs font-bold text-indigo-400">{item.status}</p>
                  </div>

                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-slate-800 text-slate-400 hover:text-white"
                    onClick={() => setBulkQueue((prev) => prev.filter((q) => q.id !== item.id))}
                  >
                    <CloseIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {bulkQueue.length > 0 && (
          <div className="p-4 bg-slate-950/40 border-t border-slate-800 text-right">
            <Button
              onClick={handleBulkLaunch}
              className="bg-primary hover:bg-primary/90 text-xs font-semibold px-4 h-9"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" /> Launch Coordinated Batch Publish ({bulkQueue.length} Videos)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
