import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectData } from "./client-dashboard-types";

export function ClientProjectsTab({ projects }: { projects: ProjectData[] }) {
  if (projects.length === 0) {
    return (
      <Card className="bg-slate-900/40 border-slate-900">
        <CardContent className="py-8 text-center text-slate-400 text-sm">
          No active projects logged.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((proj) => (
        <Card key={proj.id} className="bg-slate-900/40 border-slate-800/80 text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-bold">{proj.name}</CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-0.5">{proj.serviceType}</CardDescription>
            </div>
            <Badge variant="outline" className="capitalize text-slate-300 border-slate-700 bg-slate-950">
              {proj.status.replace("_", " ")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Project Progress</span>
                <span>{proj.progress}%</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${proj.progress}%` }} />
              </div>
            </div>

            {/* Milestones list */}
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Milestones</p>
              {proj.milestones.length === 0 ? (
                <p className="text-xs text-slate-500">No milestones registered.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {proj.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 border border-slate-800 bg-slate-950 p-2.5 rounded-lg text-sm">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${m.completed ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-slate-700 text-transparent"}`}>
                        {m.completed && <Check className="h-3 w-3" />}
                      </div>
                      <span className="font-medium text-slate-300 truncate">{m.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
