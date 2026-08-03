import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ContentPostData, ClientData } from "./client-dashboard-types";

export function ClientContentDialog({
  selectedPost,
  setSelectedPost,
  client,
}: {
  selectedPost: ContentPostData | null;
  setSelectedPost: (post: ContentPostData | null) => void;
  client: ClientData;
}) {
  const [feedback, setFeedback] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  if (!selectedPost) return null;

  // Submit Feedback
  const handleFeedbackSubmit = async () => {
    if (!selectedPost || !feedback.trim()) return;
    setSubmittingFeedback(true);

    try {
      const res = await fetch("/api/client/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selectedPost.id,
          comment: feedback,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit feedback");

      toast.success("Feedback submitted. Content status reverted for review.");
      setSelectedPost(null);
      setFeedback("");
      window.location.reload();
    } catch (err) {
      toast.error("Error submitting revision request");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <Dialog open={!!selectedPost} onOpenChange={(openState) => { if (!openState) setSelectedPost(null); }}>
      <DialogContent className="sm:max-w-[450px] bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
            <CalendarDays className="h-5 w-5 text-primary" />
            Review Content Piece
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Read planned copy/scripts and submit approval or comments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Title</p>
            <p className="text-sm font-medium text-slate-200 mt-0.5">{selectedPost.title}</p>
          </div>

          {selectedPost.caption && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Post Caption</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap border border-slate-800 bg-slate-950 p-2.5 rounded-md mt-0.5">
                {selectedPost.caption}
              </p>
            </div>
          )}

          {selectedPost.script && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Visual/Video Script</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap border border-slate-800 bg-slate-950 p-2.5 rounded-md mt-0.5 italic">
                {selectedPost.script}
              </p>
            </div>
          )}

          {/* Feed Proof Mockup for Live Posts */}
          {selectedPost.status === "PUBLISHED" && (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-md">
              <div className="p-3 flex items-center justify-between border-b border-slate-900 bg-slate-900/10">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">
                    {client.companyName.substring(0, 2)}
                  </div>
                  <span className="text-xs font-bold text-slate-200">{client.companyName}</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[8px]">Live Feed Proof</Badge>
              </div>
              <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
                <p className="text-xs font-bold text-slate-300">{selectedPost.title}</p>
              </div>
            </div>
          )}

          {/* Action area */}
          {selectedPost.status === "IN_REVIEW" && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="space-y-1.5">
                <Label htmlFor="feedback" className="text-slate-300">Request Revisions & Comments</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. Please change the first line of the copy, or swap the logo placement..."
                  className="bg-slate-950 border-slate-800 text-white"
                  rows={3}
                />
              </div>
              <Button
                onClick={handleFeedbackSubmit}
                disabled={submittingFeedback || !feedback.trim()}
                className="w-full bg-slate-200 hover:bg-white text-slate-900 font-medium"
              >
                {submittingFeedback ? "Submitting..." : "Submit Revision Request"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setSelectedPost(null)} className="text-slate-400 hover:text-white">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
