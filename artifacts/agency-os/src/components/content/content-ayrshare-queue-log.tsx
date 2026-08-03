import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Post = {
  id: string;
  title: string;
  status: string;
  publishedAt: Date | null;
};

interface ContentAyrshareQueueLogProps {
  localPosts: Post[];
}

export function ContentAyrshareQueueLog({ localPosts }: ContentAyrshareQueueLogProps) {
  const queuedOrPublished = localPosts.filter(
    (p) => p.status === "PUBLISHED" || p.status === "ADMIN_APPROVED"
  );

  return (
    <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800 bg-slate-950/20">
        <CardTitle className="text-sm font-bold text-slate-200">
          Ayrshare Auto-Publishing Queue (Simulated)
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Real-time status logs of social posts publishing automatically from calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
            <span className="text-slate-400">Queue Status</span>
            <span className="text-slate-200 font-medium">Ayrshare API: Connected</span>
          </div>
          {queuedOrPublished.map((p, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center text-xs border border-slate-800 bg-slate-950/30 p-2.5 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    p.status === "PUBLISHED" ? "bg-emerald-500" : "bg-blue-400 animate-pulse"
                  }`}
                />
                <span className="font-semibold text-slate-300 truncate max-w-[200px]">
                  {p.title}
                </span>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className={`text-[9px] ${
                    p.status === "PUBLISHED"
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                      : "border-blue-500/30 text-blue-400 bg-blue-500/5"
                  }`}
                >
                  {p.status === "PUBLISHED" ? "Published Live" : "In Queue"}
                </Badge>
                <span className="text-[10px] text-slate-500">
                  {p.publishedAt ? new Date(p.publishedAt).toLocaleTimeString() : "Pending"}
                </span>
              </div>
            </div>
          ))}
          {queuedOrPublished.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-4">
              No published or approved items in queue.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
