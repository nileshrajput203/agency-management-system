import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ANALYTICS_DATA } from "./content-types";

export function ContentAnalyticsTab() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Combined Views</p>
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold text-slate-200">2,947,000</p>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center">
                <TrendingUp className="h-3 w-3 mr-0.5" /> +18.4%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Average Likes</p>
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold text-slate-200">149,400</p>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center">
                <TrendingUp className="h-3 w-3 mr-0.5" /> +12.1%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Engagement Index</p>
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold text-slate-200">6.42%</p>
              <span className="text-[10px] text-indigo-400 font-bold">Optimal Range</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
          <CardContent className="p-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Accounts Synced</p>
            <div className="flex items-baseline justify-between">
              <p className="text-xl font-bold text-slate-200">8 / 8 Active</p>
              <span className="text-[10px] text-emerald-400 font-bold">100% Online</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recharts AreaChart */}
      <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
        <CardHeader className="py-4 border-b border-slate-800 bg-slate-950/20">
          <CardTitle className="text-sm font-bold text-slate-200">Weekly Coordinated Views Trend</CardTitle>
          <CardDescription className="text-xs text-slate-400">Total reach across combined TikTok, YouTube Shorts, Reels, and social channels</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ANALYTICS_DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f8fafc" }}
                  itemStyle={{ color: "#818cf8" }}
                />
                <Area type="monotone" dataKey="Views" stroke="var(--color-primary, #6366f1)" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Platform Distribution */}
      <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
        <CardHeader className="py-4 border-b border-slate-800 bg-slate-950/20">
          <CardTitle className="text-sm font-bold text-slate-200">Views Share by Social Channel</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "YouTube Shorts", views: "1.05M", share: "35.6%", color: "text-[#FF0000]" },
              { name: "TikTok", views: "860k", share: "29.2%", color: "text-[#FE2C55]" },
              { name: "Instagram Reels", views: "620k", share: "21.0%", color: "text-[#E1306C]" },
              { name: "X & Facebook", views: "417k", share: "14.2%", color: "text-slate-400" },
            ].map((item, idx) => (
              <div key={idx} className="border border-slate-800 bg-slate-950/30 p-3.5 rounded-lg flex flex-col justify-between">
                <span className="text-xs text-slate-400">{item.name}</span>
                <div className="flex justify-between items-baseline mt-2">
                  <span className="text-base font-bold text-slate-200">{item.views}</span>
                  <span className={`text-[10px] font-bold ${item.color}`}>{item.share}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
