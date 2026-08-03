import React from "react";
import { Instagram, Youtube, Facebook, Linkedin } from "lucide-react";

export interface ClientRevisionInfo {
  subject?: string;
  category?: string;
  priority?: string;
  description?: string;
  attachmentUrl?: string;
  createdAt?: string;
}

export function parseClientRevision(comments: any[], rejectionNote?: string | null): ClientRevisionInfo | null {
  if (Array.isArray(comments)) {
    for (let i = comments.length - 1; i >= 0; i--) {
      const text = comments[i]?.text || comments[i]?.comment || "";
      if (text.includes("[CLIENT REVISION REQUEST")) {
        const lines = text.split("\n");
        const headerMatch = lines[0]?.match(/\[CLIENT REVISION REQUEST\s*-\s*([^-]+)\s*-\s*([^\]]+)\]/);
        const category = headerMatch ? headerMatch[1].trim() : "General";
        const priority = headerMatch ? headerMatch[2].trim() : "NORMAL";

        let subject = "";
        let description = "";
        let attachmentUrl = "";

        lines.forEach((l: string) => {
          if (l.startsWith("Subject:")) subject = l.replace("Subject:", "").trim();
          else if (l.startsWith("Description:")) description = l.replace("Description:", "").trim();
          else if (l.startsWith("Attachment:")) attachmentUrl = l.replace("Attachment:", "").trim();
        });

        return {
          category,
          priority,
          subject: subject || "Revision Requested",
          description: description || rejectionNote || "",
          attachmentUrl,
          createdAt: comments[i].createdAt,
        };
      }
    }
  }

  if (rejectionNote) {
    return {
      category: "General",
      priority: "HIGH",
      subject: "Client Feedback",
      description: rejectionNote,
    };
  }

  return null;
}

export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IDEA: { label: "Idea", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  SCRIPTING: { label: "Scripting", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  DESIGNING: { label: "Designing", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  IN_REVIEW: { label: "In Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  ADMIN_APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  SCHEDULED: { label: "Scheduled", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  PUBLISHED: { label: "Published", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
};

export const FORMAT_OPTIONS = ["VIDEO", "PHOTO", "GRAPHIC", "CAROUSEL", "REEL", "STORY", "ANIMATION", "INFOGRAPHIC"];
export const PLATFORM_OPTIONS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "LINKEDIN", "TIKTOK", "TWITTER", "PINTEREST"];

export const PLATFORM_ICON: Record<string, React.ReactNode> = {
  INSTAGRAM: React.createElement(Instagram, { className: "h-3.5 w-3.5 text-pink-500" }),
  YOUTUBE: React.createElement(Youtube, { className: "h-3.5 w-3.5 text-red-500" }),
  FACEBOOK: React.createElement(Facebook, { className: "h-3.5 w-3.5 text-blue-500" }),
  LINKEDIN: React.createElement(Linkedin, { className: "h-3.5 w-3.5 text-blue-600" }),
  TIKTOK: React.createElement("span", { className: "h-3.5 w-3.5 text-[10px] font-bold leading-none" }, "TK"),
  TWITTER: React.createElement("span", { className: "h-3.5 w-3.5 text-[10px] font-bold leading-none" }, "𝕏"),
  PINTEREST: React.createElement("span", { className: "h-3.5 w-3.5 text-[10px] font-bold leading-none" }, "P"),
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type PostRecord = {
  id: string;
  platform?: string | null;
  contentType?: string | null;
  status?: string | null;
  caption?: string | null;
  scheduledAt?: string | null;
  shootDate?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  referenceUrl?: string | null;
  assetsLink?: string | null;
  mediaUrls?: string[] | null;
  format?: string | null;
  needsRevision?: string | null;
  approvalStatus?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  title?: string | null;
  rejectionNote?: string | null;
  customProperties?: { key: string; value: string }[] | null;
  comments?: { id: string; text: string; createdAt: string }[] | null;
  createdAt?: string | null;
};

export function getPostAttachmentUrl(post: {
  assetsLink?: string | null;
  referenceUrl?: string | null;
  mediaUrls?: string[] | null;
} | null | undefined): string | null {
  if (!post) return null;
  if (post.mediaUrls && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 && post.mediaUrls[0]) {
    return post.mediaUrls[0];
  }
  if (post.assetsLink && post.assetsLink.trim()) {
    return post.assetsLink.trim();
  }
  if (post.referenceUrl && post.referenceUrl.trim()) {
    return post.referenceUrl.trim();
  }
  return null;
}

export function triggerFileDownload(url: string, filename?: string) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  if (filename) {
    a.download = filename;
  } else {
    const parts = url.split("/");
    const last = parts[parts.length - 1];
    a.download = last && last.length > 0 ? last : "media-file";
  }
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export type PanelState =
  | { mode: "closed" }
  | { mode: "create"; defaultDate?: string }
  | { mode: "edit"; post: PostRecord };

export function emptyDraft(defaultDate?: string) {
  return {
    title: "",
    platform: "INSTAGRAM",
    contentType: "POST",
    status: "IDEA",
    caption: "",
    scheduledAt: defaultDate ?? "",
    shootDate: "",
    clientId: "",
    assetsLink: "",
    format: "",
    needsRevision: false as boolean | string,
    approvalStatus: "PENDING" as string,
    rejectionNote: "",
    customProperties: [] as { key: string; value: string }[],
    comments: [] as { id: string; text: string; createdAt: string }[],
  };
}

export function buildShareUrl(shareToken: string) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${window.location.origin}${base}/content-calendar/share/${shareToken}`;
}

export function getPostDateKey(scheduledAt: string | Date | null | undefined): string | null {
  if (!scheduledAt) return null;
  if (typeof scheduledAt === "string") {
    const datePart = scheduledAt.split("T")[0];
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }
  const d = new Date(scheduledAt);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPastDate(val: string | Date | null | undefined): boolean {
  if (!val) return false;
  let targetDate: Date;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return false;
    const datePart = trimmed.split("T")[0];
    const parts = datePart.split("-");
    if (parts.length === 3) {
      targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      targetDate = new Date(trimmed);
    }
  } else if (val instanceof Date) {
    targetDate = new Date(val);
  } else {
    targetDate = new Date(val);
  }

  if (isNaN(targetDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  return targetDate.getTime() < today.getTime();
}
