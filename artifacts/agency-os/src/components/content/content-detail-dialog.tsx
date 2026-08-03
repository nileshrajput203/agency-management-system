import { toast } from "sonner";
import { FileText, Download, FileX } from "lucide-react";
import { updateContentStatus, approveContent } from "@/lib/actions/content";
import { CONTENT_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ContentDetailDialogProps {
  post: {
    id: string;
    title: string;
    caption: string | null;
    script: string | null;
    status: string;
    scheduledAt: Date | null;
    client: { companyName: string };
    assetsLink?: string | null;
    referenceUrl?: string | null;
    mediaUrls?: string[] | null;
  } | null;
  onClose: () => void;
  canManage: boolean;
  isAdmin: boolean;
}

export function ContentDetailDialog({
  post,
  onClose,
  canManage,
  isAdmin,
}: ContentDetailDialogProps) {
  if (!post) return null;

  const fileUrl = post.assetsLink || post.referenceUrl || (post.mediaUrls?.[0] ?? null);

  return (
    <Dialog open={!!post} onOpenChange={(openState) => { if (!openState) onClose(); }}>
      <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-200">
            <FileText className="h-5 w-5 text-primary" />
            Content details
          </DialogTitle>
          <CardDescription className="text-slate-400">
            Client: {post.client.companyName} | Status: {post.status.replace(/_/g, " ")}
          </CardDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Title</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{post.title}</p>
          </div>

          {post.caption && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Caption</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap border border-slate-800 bg-slate-950 p-2.5 rounded-md mt-0.5">
                {post.caption}
              </p>
            </div>
          )}

          {post.script && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Video Script</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap border border-slate-800 bg-slate-950 p-2.5 rounded-md mt-0.5 italic">
                {post.script}
              </p>
            </div>
          )}

          {post.scheduledAt && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Scheduled publishing</p>
              <p className="text-sm text-slate-300 mt-0.5">
                {new Date(post.scheduledAt).toLocaleString()}
              </p>
            </div>
          )}

          {/* Feed Mockup Previews */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <Label className="text-xs font-semibold text-slate-400 uppercase">Platform Feed Mockup Previews</Label>
            <Tabs defaultValue="instagram" className="w-full">
              <TabsList className="grid grid-cols-3 w-full bg-slate-950 border border-slate-800 rounded-lg">
                <TabsTrigger value="instagram" className="text-[11px] data-[state=active]:bg-slate-850">Instagram</TabsTrigger>
                <TabsTrigger value="linkedin" className="text-[11px] data-[state=active]:bg-slate-850">LinkedIn</TabsTrigger>
                <TabsTrigger value="youtube" className="text-[11px] data-[state=active]:bg-slate-850">YouTube</TabsTrigger>
              </TabsList>

              {/* Instagram Mockup */}
              <TabsContent value="instagram" className="mt-2.5">
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 text-slate-200">
                  <div className="p-2.5 flex items-center gap-2 border-b border-slate-900 bg-slate-900/20">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold">
                      {post.client.companyName.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate leading-none">{post.client.companyName}</p>
                      <p className="text-[8px] text-slate-500 mt-0.5">Sponsored</p>
                    </div>
                  </div>

                  <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center p-4 text-center text-white relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-pink-950/80 opacity-60" />
                    <div className="relative z-10 flex flex-col items-center">
                      <p className="font-extrabold text-xs tracking-tight px-4 leading-tight">{post.title}</p>
                      <p className="text-[8px] text-slate-400 mt-1 font-mono">@blinkbeyond</p>
                    </div>
                  </div>

                  <div className="p-3 space-y-1 bg-slate-900/10">
                    <div className="flex gap-2.5 text-slate-400 text-[10px]">
                      <span>❤️ Like</span>
                      <span>💬 Comment</span>
                      <span>🚀 Share</span>
                    </div>
                    <p className="text-xs leading-normal">
                      <span className="font-bold mr-1.5">{post.client.companyName.toLowerCase().replace(/\s+/g, "")}</span>
                      {post.caption || "No caption provided."}
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* LinkedIn Mockup */}
              <TabsContent value="linkedin" className="mt-2.5">
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-3 text-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs uppercase">
                      {post.client.companyName.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate leading-none">{post.client.companyName}</p>
                      <p className="text-[8px] text-slate-500 mt-0.5">Promoted</p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-300">
                    {post.caption || "No caption provided."}
                  </p>

                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/20">
                    <div className="aspect-video bg-indigo-950 flex items-center justify-center text-white text-center font-bold text-xs p-4 relative">
                      <div className="absolute inset-0 bg-slate-950/40" />
                      <p className="z-10 px-4 leading-tight">{post.title}</p>
                    </div>
                    <div className="p-2 border-t border-slate-800">
                      <p className="text-[8px] text-slate-500 uppercase tracking-wider">blinkbeyond.com</p>
                      <p className="text-[11px] font-bold text-slate-200 mt-0.5 truncate">{post.title}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* YouTube Mockup */}
              <TabsContent value="youtube" className="mt-2.5">
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 text-slate-200">
                  <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center text-white relative">
                    <div className="h-10 w-14 bg-red-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-700 transition">
                      <span className="text-xs text-white">▶</span>
                    </div>
                    <p className="absolute bottom-2 left-2 text-[8px] bg-black/60 px-1.5 py-0.5 rounded text-slate-300 font-mono">
                      Shorts Preview
                    </p>
                  </div>

                  <div className="p-3 space-y-2">
                    <p className="font-bold text-xs leading-snug">{post.title}</p>
                    <div className="flex items-center gap-2 border-t border-slate-900 pt-2">
                      <div className="h-6 w-6 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-[9px]">
                        {post.client.companyName.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold leading-none">{post.client.companyName}</p>
                        <p className="text-[8px] text-slate-500 mt-0.5">1.02M subscribers</p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Status workflow operations */}
          <div className="flex flex-col gap-2 pt-3 border-t border-slate-800 mt-4">
            {canManage && post.status !== "PUBLISHED" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-400">Change Workflow Stage</Label>
                <select
                  className="w-full text-sm border border-slate-800 rounded h-9 px-2 bg-slate-950 text-white"
                  value={post.status}
                  onChange={async (e) => {
                    const r = await updateContentStatus(post.id, e.target.value);
                    if (r.ok) {
                      toast.success("Stage updated");
                      onClose();
                    } else {
                      toast.error(r.error);
                    }
                  }}
                >
                  {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            )}

            {isAdmin && post.status === "IN_REVIEW" && (
              <Button
                size="sm"
                className="w-full h-9 font-medium btn-micro-anim"
                onClick={async () => {
                  const r = await approveContent(post.id);
                  if (r.ok) {
                    toast.success("Admin approved & published!");
                    onClose();
                  } else {
                    toast.error(r.error);
                  }
                }}
              >
                Approve & Live Publish (Ayrshare)
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
