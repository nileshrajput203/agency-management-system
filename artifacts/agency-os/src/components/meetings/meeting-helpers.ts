import { format } from "date-fns";

export interface MeetingAttendee {
  id: string;
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
