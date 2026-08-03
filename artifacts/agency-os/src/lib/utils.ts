import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateOnly(dateVal?: string | null | Date, fmt = "dd MMM yyyy"): string {
  if (!dateVal) return "—";

  const hasTimeFmt = /[Hhmsa]/.test(fmt);

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "—";
    return format(dateVal, fmt);
  }

  const str = String(dateVal).trim();
  if (!str) return "—";

  if (hasTimeFmt) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return format(d, fmt);
    }
  }

  const clean = str.split("T")[0];
  if (!clean) return "—";
  const parts = clean.split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return format(d, fmt);
    return "—";
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return format(d, fmt);
}

export function formatDateTime(dateVal?: string | null | Date, fmt = "dd MMM yyyy, HH:mm"): string {
  if (!dateVal) return "—";
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return "—";
    return format(d, fmt);
  } catch {
    return "—";
  }
}

export function formatTimeOnly(dateVal?: string | null | Date, fmt = "HH:mm"): string {
  if (!dateVal) return "—";
  try {
    const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    if (isNaN(d.getTime())) return "—";
    return format(d, fmt);
  } catch {
    return "—";
  }
}

export function toInputDate(dateVal?: string | null): string {
  if (!dateVal) return "";
  return dateVal.split("T")[0] || "";
}

export function extractClientFields(client: any) {
  let serviceType = client?.serviceType || "";
  let platforms = client?.platforms || "";
  let targetAudience = client?.targetAudience || client?.audience || "";
  let notes = client?.notes || "";

  if (notes) {
    if (!serviceType) {
      const match = notes.match(/Service:\s*([^\n]+)/i);
      if (match) serviceType = match[1].trim();
    }
    if (!platforms) {
      const match = notes.match(/Platforms:\s*([^\n]+)/i);
      if (match) platforms = match[1].trim();
    }
    if (!targetAudience) {
      const match = notes.match(/(?:Target Audience|Audience):\s*([^\n]+)/i);
      if (match) targetAudience = match[1].trim();
    }
    notes = notes
      .replace(/Service:\s*[^\n]+\n?/gi, "")
      .replace(/Platforms:\s*[^\n]+\n?/gi, "")
      .replace(/(?:Target Audience|Audience):\s*[^\n]+\n?/gi, "")
      .replace(/Site Type:\s*[^\n]+\n?/gi, "")
      .replace(/Tech Stack:\s*[^\n]+\n?/gi, "")
      .trim();
  }

  return {
    serviceType: serviceType || "—",
    platforms: platforms || "—",
    targetAudience: targetAudience || "—",
    notes: notes,
    rawServiceType: serviceType,
    rawPlatforms: platforms,
    rawTargetAudience: targetAudience,
  };
}

