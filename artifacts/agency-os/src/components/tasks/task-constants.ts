export const COLUMNS = [
  { key: "TODO", label: "To Do" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "DONE", label: "Done" },
];

export const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800" },
  MEDIUM: { label: "Medium", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900" },
  HIGH: { label: "High", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900" },
  URGENT: { label: "Urgent", className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900" },
};

export const COL_STYLE: Record<string, string> = {
  TODO: "border-t-slate-300",
  IN_PROGRESS: "border-t-blue-400",
  IN_REVIEW: "border-t-amber-400",
  DONE: "border-t-emerald-400",
};

export const TaskApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  MODIFIED: "MODIFIED",
} as const;
