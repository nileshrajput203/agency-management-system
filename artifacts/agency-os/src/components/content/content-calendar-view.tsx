import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { getPostDateKey, isPastDate } from "./content-constants";

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

interface ContentCalendarViewProps {
  currentDate: Date;
  year: number;
  navigateMonth: (direction: "prev" | "next") => void;
  daysArray: { date: Date; isCurrentMonth: boolean }[];
  localPosts: Post[];
  canManage: boolean;
  onSelectPost: (post: Post) => void;
  onScheduleDateSelect: (formattedDate: string) => void;
}

export function ContentCalendarView({
  currentDate,
  year,
  navigateMonth,
  daysArray,
  localPosts,
  canManage,
  onSelectPost,
  onScheduleDateSelect,
}: ContentCalendarViewProps) {
  const getWeekDayName = (idx: number) => {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][idx];
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  return (
    <Card className="border-slate-800 bg-slate-900/40 text-slate-100">
      <CardHeader className="py-4 border-b border-slate-800 flex flex-row items-center justify-between bg-slate-950/20">
        <div>
          <CardTitle className="text-base font-bold text-slate-200">
            {currentDate.toLocaleString("default", { month: "long" })} {year}
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Select any day to schedule new content
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white btn-micro-anim"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white btn-micro-anim"
            onClick={() => navigateMonth("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-slate-800 text-center text-xs font-semibold text-slate-400 bg-slate-950/40 py-2">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx}>{getWeekDayName(idx)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6 border-b border-slate-800 divide-x divide-y divide-slate-800/80 min-h-[500px]">
          {daysArray.map((cell, idx) => {
            const cellDateKey = `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, "0")}-${String(cell.date.getDate()).padStart(2, "0")}`;
            const dayPosts = localPosts.filter(
              (p) => p.scheduledAt && getPostDateKey(p.scheduledAt) === cellDateKey
            );
            return (
              <div
                key={idx}
                className={`p-2 space-y-1.5 flex flex-col justify-between hover:bg-slate-800/20 transition min-h-[90px] relative ${
                  cell.isCurrentMonth ? "bg-slate-950/10 text-slate-200" : "bg-slate-950/30 text-slate-500"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-xs font-bold leading-none ${
                      isSameDay(new Date(), cell.date)
                        ? "h-5 w-5 bg-primary text-white rounded-full flex items-center justify-center font-extrabold"
                        : ""
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {cell.isCurrentMonth && canManage && !isPastDate(cell.date) && (
                    <button
                      type="button"
                      onClick={() => {
                        const formattedDate = cell.date.toISOString().slice(0, 16);
                        onScheduleDateSelect(formattedDate);
                      }}
                      className="opacity-0 hover:opacity-100 focus:opacity-100 absolute top-2 right-2 text-primary hover:text-white bg-primary/20 hover:bg-primary rounded p-0.5"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-1 mt-1 overflow-y-auto max-h-[70px]">
                  {dayPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => onSelectPost(post)}
                      className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate cursor-pointer transition ${
                        post.status === "PUBLISHED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {post.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
