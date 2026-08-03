import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORMS } from "./content-types";

type Post = {
  id: string;
  title: string;
  caption: string | null;
  script: string | null;
  status: string;
  platforms: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  publishProof: string | null;
  client: { companyName: string };
};

interface ContentKanbanViewProps {
  byStatus: { status: string; posts: Post[] }[];
  onSelectPost: (post: Post) => void;
  getStatusBadgeVariant: (status: string) => "default" | "outline" | "secondary";
}

export function ContentKanbanView({
  byStatus,
  onSelectPost,
  getStatusBadgeVariant,
}: ContentKanbanViewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
      {byStatus.map(({ status, posts: col }) => (
        <Card key={status} className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardHeader className="py-3 border-b border-slate-800/60 bg-slate-950/20">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {status.replace(/_/g, " ")} ({col.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 mt-3">
            {col.map((post) => (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="border border-slate-800 rounded-lg p-3 text-sm cursor-pointer hover:border-slate-700/80 hover:bg-slate-900/60 scale-hover bg-slate-950/40 transition"
              >
                <p className="font-semibold text-slate-200 truncate">{post.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{post.client.companyName}</p>

                {post.platforms && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {JSON.parse(post.platforms).map((plat: string) => {
                      const match = PLATFORMS.find((p) => p.id === plat);
                      return (
                        <span
                          key={plat}
                          className={`text-[9px] px-1 py-0.5 rounded uppercase font-bold border ${match?.bg || "bg-slate-800"} ${match?.color || "text-slate-300"} ${match?.border || "border-slate-700"}`}
                        >
                          {plat.replace("_reels", "").replace("_shorts", "")}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/40">
                  <Badge variant={getStatusBadgeVariant(post.status)} className="text-[9px]">
                    {post.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
