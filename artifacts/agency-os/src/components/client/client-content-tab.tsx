import { FileText, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ContentPostData } from "./client-dashboard-types";

export function ClientContentTab({
  contentPosts,
  onSelectPost,
}: {
  contentPosts: ContentPostData[];
  onSelectPost: (post: ContentPostData) => void;
}) {
  return (
    <Card className="bg-slate-900/40 border-slate-800 text-white">
      <CardHeader>
        <CardTitle className="text-md">Social Media Feed Preview</CardTitle>
        <CardDescription className="text-slate-400">Review planned creatives, scripts, and request revisions</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contentPosts.length === 0 ? (
          <p className="text-sm text-slate-400 col-span-full text-center py-6">No media content pieces currently listed.</p>
        ) : (
          contentPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="border border-slate-800/80 bg-slate-950 hover:border-slate-700/80 rounded-xl overflow-hidden shadow-lg cursor-pointer transition flex flex-col justify-between"
            >
              <div className="p-3 border-b border-slate-900 flex justify-between items-center bg-slate-900/25">
                <span className="text-xs font-bold text-slate-200 truncate">{post.title}</span>
                <Badge className="text-[9px] bg-primary/20 text-primary border-0">
                  {post.status}
                </Badge>
              </div>
              
              <div className="aspect-video bg-slate-900 flex flex-col items-center justify-center p-4 text-center border-b border-slate-900">
                <FileText className="h-6 w-6 text-slate-600 mb-1" />
                <p className="text-xs font-medium text-slate-400 line-clamp-2 px-2">
                  {post.caption || "No visual caption loaded"}
                </p>
              </div>

              <div className="p-3 text-[10px] text-slate-400 flex justify-between bg-slate-900/10">
                <span>Platforms: {post.platforms.replace(/[\[\]"]/g, "").replace(/,/g, ", ")}</span>
                {post.status === "IN_REVIEW" && (
                  <span className="text-primary font-bold hover:underline flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Feedback
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
