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

export const isCompletedTask = (status?: string | null) =>
  status === "DONE" || status === "COMPLETED";

const TASK_STATUS_ORDER: Record<string, number> = {
  IN_REVIEW: 0,
  IN_PROGRESS: 1,
  TODO: 2,
  BLOCKED: 3,
  DONE: 4,
  COMPLETED: 4,
};

export function sortTasksByDueDate<T extends { dueDate?: string | null; startDate?: string | null; createdAt?: string | null; id?: string; status?: string | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    // 1. Due date chronological alignment (earliest deadline first)
    if (a.dueDate && b.dueDate) {
      const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (diff !== 0) return diff;
    } else if (a.dueDate) {
      return -1;
    } else if (b.dueDate) {
      return 1;
    }

    // 2. Start date alignment (earliest start first)
    if (a.startDate && b.startDate) {
      const diff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (diff !== 0) return diff;
    } else if (a.startDate) {
      return -1;
    } else if (b.startDate) {
      return 1;
    }

    // 3. Fallback to creation date (newest first)
    if (a.createdAt && b.createdAt) {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (diff !== 0) return diff;
    }

    // 4. Stable tie-breaker by ID
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

export const TaskApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  MODIFIED: "MODIFIED",
} as const;
