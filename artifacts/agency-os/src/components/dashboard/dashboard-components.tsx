import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const RANGE_OPTIONS = [
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "12m", label: "12M" },
  { key: "ytd", label: "YTD" },
];

export const PLATFORM_DOT: Record<string, string> = {
  INSTAGRAM: "bg-pink-500",
  LINKEDIN:  "bg-blue-600",
  FACEBOOK:  "bg-blue-500",
  YOUTUBE:   "bg-red-500",
  TWITTER:   "bg-slate-800 dark:bg-slate-200",
  TIKTOK:    "bg-slate-700",
  PINTEREST: "bg-red-600",
};

export const PIPELINE_STAGE_COLORS: Record<string, string> = {
  LEAD: "bg-slate-400",
  CONTACTED: "bg-blue-400",
  DEMO_GIVEN: "bg-indigo-400",
  PROPOSAL_SENT: "bg-violet-400",
  NEGOTIATION: "bg-amber-400",
  WON: "bg-emerald-500",
  LOST: "bg-rose-400",
};

export function StatCard({
  label, value, subtext, icon, accentColor
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  accentColor: string;
}) {
  return (
    <Card className={cn("border-l-[3px] scale-hover transition-all duration-200 bg-card", accentColor)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="mt-1.5 text-2xl font-bold font-heading text-foreground tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground truncate">{subtext}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 ml-3">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
