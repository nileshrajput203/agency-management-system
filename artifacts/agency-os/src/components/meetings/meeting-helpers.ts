import { format } from "date-fns";

export interface ShootDetails {
  category: string;
  objective: string;
  shotList: string;
  deliverables: string;
  equipment: string;
  referenceLink: string;
  notes: string;
}

export const STANDARD_SHOOT_EQUIPMENT = [
  "Camera Reflectors",
  "3 Tripods",
  "2 Light Stands",
  "Camera Gimbal",
  "Phone Gimbal",
  "Small Gimbal",
  "Light Extension",
  "Softbox",
  "Charger",
  "Memory Card",
  "Camera Battery",
  "Torch",
  "Lens",
  "Big Lens No. 1",
  "Small Lens No. 2",
  "DJI Mic",
  "ND Filters",
  "Magic Arm",
  "Mobile Holder",
  "Chest Cam",
] as const;

export function parseEquipmentString(raw?: string): {
  selectedItems: string[];
  customItems: string[];
  notes: string;
} {
  if (!raw || !raw.trim()) {
    return { selectedItems: [], customItems: [], notes: "" };
  }

  let itemsPart = raw;
  let notes = "";
  const notesMarkerIndex = raw.search(/(?:\r?\n|^|\s)Notes:\s*/i);
  if (notesMarkerIndex >= 0) {
    itemsPart = raw.slice(0, notesMarkerIndex).trim();
    notes = raw.slice(notesMarkerIndex).replace(/^(?:\r?\n|^|\s)Notes:\s*/i, "").trim();
  }

  const tokens = itemsPart
    .split(/[,;\n•\r]+/)
    .map((t) => t.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);

  const selectedItems: string[] = [];
  const customItems: string[] = [];

  const standardLowerMap = new Map<string, string>();
  for (const std of STANDARD_SHOOT_EQUIPMENT) {
    standardLowerMap.set(std.toLowerCase(), std);
  }

  for (const token of tokens) {
    const matched = standardLowerMap.get(token.toLowerCase());
    if (matched) {
      if (!selectedItems.includes(matched)) {
        selectedItems.push(matched);
      }
    } else {
      if (!customItems.includes(token)) {
        customItems.push(token);
      }
    }
  }

  return { selectedItems, customItems, notes };
}

export function serializeEquipmentString(
  selectedItems: string[],
  customItems: string[] = [],
  notes = ""
): string {
  const allItems = [...selectedItems, ...customItems].filter(Boolean);
  const itemsText = allItems.join(", ");
  const cleanNotes = notes.trim();
  if (!cleanNotes) return itemsText;
  if (!itemsText) return `Notes: ${cleanNotes}`;
  return `${itemsText}\nNotes: ${cleanNotes}`;
}

const SHOOT_MARKER = "[[AGENCYOS_SHOOT_V1]]";
const SHOOT_TITLE_PREFIX = "[SHOOT] ";

export interface MeetingAttendee {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  location?: string;
  meetingLink?: string;
  status: string;
  organizerId: string;
  organizerName: string;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  attendees: MeetingAttendee[];
}

export function parseMeetingDescription(description?: string | null): {
  description: string;
  shootDetails: ShootDetails | null;
} {
  if (!description) return { description: "", shootDetails: null };
  const markerIndex = description.lastIndexOf(SHOOT_MARKER);
  if (markerIndex < 0) return { description, shootDetails: null };
  const plainDescription = description.slice(0, markerIndex).trim();
  try {
    const encodedDetails = description.slice(markerIndex + SHOOT_MARKER.length).trim();
    const parsed = JSON.parse(decodeURIComponent(encodedDetails));
    return {
      description: plainDescription,
      shootDetails: {
        category: String(parsed.category ?? ""),
        objective: String(parsed.objective ?? ""),
        shotList: String(parsed.shotList ?? ""),
        deliverables: String(parsed.deliverables ?? ""),
        equipment: String(parsed.equipment ?? ""),
        referenceLink: String(parsed.referenceLink ?? ""),
        notes: String(parsed.notes ?? ""),
      },
    };
  } catch {
    return { description, shootDetails: null };
  }
}

export function isShootMeeting(meeting: Pick<MeetingItem, "title" | "description">): boolean {
  return meeting.title.startsWith(SHOOT_TITLE_PREFIX) ||
    parseMeetingDescription(meeting.description).shootDetails !== null;
}

export function getMeetingDisplayTitle(title: string): string {
  return title.startsWith(SHOOT_TITLE_PREFIX) ? title.slice(SHOOT_TITLE_PREFIX.length) : title;
}

export function formatDateTime(isoString: string, fmt = "MMM d, yyyy h:mm a") {
  if (!isoString) return "";
  try {
    return format(new Date(isoString), fmt);
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string, fmt = "h:mm a") {
  if (!isoString) return "";
  try {
    return format(new Date(isoString), fmt);
  } catch {
    return isoString;
  }
}
