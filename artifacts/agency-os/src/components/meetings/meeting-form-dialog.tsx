import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { isShootMeeting, MeetingItem, parseMeetingDescription, ShootDetails } from "./meeting-helpers";

const EMPTY_SHOOT_DETAILS: ShootDetails = {
  category: "",
  objective: "",
  shotList: "",
  deliverables: "",
  equipment: "",
  referenceLink: "",
  notes: "",
};

function toLocalDateTimeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

interface MeetingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalMode: "CREATE" | "EDIT";
  meetingToEdit?: MeetingItem | null;
  clients?: Array<{ id: string; companyName: string }>;
  projects?: Array<{ id: string; name: string }>;
  usersList?: Array<{ id: string; name: string; email: string }>;
  canViewClients: boolean;
  canViewProjects: boolean;
  canViewTeam: boolean;
  onSave: (payload: any) => Promise<void>;
}

export function MeetingFormDialog({
  open,
  onOpenChange,
  modalMode,
  meetingToEdit,
  clients,
  projects,
  usersList,
  canViewClients,
  canViewProjects,
  canViewTeam,
  onSave,
}: MeetingFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("SCHEDULED");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [meetingType, setMeetingType] = useState<"MEETING" | "SHOOT">("MEETING");
  const [shootDetails, setShootDetails] = useState<ShootDetails>(EMPTY_SHOOT_DETAILS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (modalMode === "EDIT" && meetingToEdit) {
      const parsedDescription = parseMeetingDescription(meetingToEdit.description);
      const isShoot = isShootMeeting(meetingToEdit);
      setTitle(meetingToEdit.title?.replace(/^\[SHOOT\]\s*/, "") ?? "");
      setDescription(parsedDescription.description);
      setStartTime(toLocalDateTimeInput(meetingToEdit.startTime));
      setEndTime(toLocalDateTimeInput(meetingToEdit.endTime));
      setMeetingLink(meetingToEdit.meetingLink ?? "");
      setLocation(meetingToEdit.location ?? "");
      setClientId(meetingToEdit.clientId ?? "");
      setProjectId(meetingToEdit.projectId ?? "");
      setStatus(meetingToEdit.status ?? "SCHEDULED");
      setMeetingType(isShoot ? "SHOOT" : "MEETING");
      setShootDetails(parsedDescription.shootDetails ?? EMPTY_SHOOT_DETAILS);
      setSelectedUserIds((meetingToEdit.attendees ?? [])
        .map((attendee) => attendee.userId ?? attendee.id)
        .filter((id) => !isShoot || id !== meetingToEdit.organizerId));
    } else if (modalMode === "CREATE") {
      setTitle("");
      setDescription("");
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const startIso = toLocalDateTimeInput(now.toISOString());
      now.setHours(now.getHours() + 1);
      const endIso = toLocalDateTimeInput(now.toISOString());
      setStartTime(startIso);
      setEndTime(endIso);
      setMeetingLink("");
      setLocation("");
      setClientId("");
      setProjectId("");
      setStatus("SCHEDULED");
      setSelectedUserIds([]);
      setMeetingType("MEETING");
      setShootDetails(EMPTY_SHOOT_DETAILS);
    }
  }, [modalMode, meetingToEdit, open]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingType === "SHOOT" && !selectedUserIds.length) return;
    setSubmitting(true);
    try {
      await onSave({
        title,
        description,
        startTime,
        endTime,
        meetingLink,
        location,
        clientId,
        projectId,
        status,
        meetingType,
        ...(meetingType === "SHOOT" ? { shootDetails } : {}),
        ...(canViewTeam ? { attendeeUserIds: selectedUserIds } : {}),
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {modalMode === "EDIT" ? "Edit Meeting Details" : "Schedule New Meeting"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Meeting Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={meetingType === "SHOOT" ? 194 : 200}
              placeholder="e.g., Q3 Strategy Review / Client Onboarding Call"
              required
            />
          </div>

          {canViewTeam && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Schedule Type</Label>
              <Select value={meetingType} onValueChange={(value: string) => setMeetingType(value as "MEETING" | "SHOOT")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEETING">Meeting</SelectItem>
                  <SelectItem value="SHOOT">Photo / Video Shoot</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {modalMode === "EDIT" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Meeting Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Date & Time *</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">End Date & Time *</Label>
              <Input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Meeting Link (Meet / Zoom)</Label>
              <Input
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/xyz-abc"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Location / Room</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Conference Room A / Online"
              />
            </div>
          </div>

          {(canViewClients || canViewProjects) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {canViewClients && (
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold">Related Client</Label>
                  <Select
                    value={clientId || "none"}
                    onValueChange={(val: string) => setClientId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[320px]">
                      <SelectItem value="none">None (Internal)</SelectItem>
                      {(clients ?? []).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <span className="truncate max-w-[260px] block" title={client.companyName}>
                            {client.companyName}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canViewProjects && (
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold">Related Project</Label>
                  <Select
                    value={projectId || "none"}
                    onValueChange={(val: string) => setProjectId(val === "none" ? "" : val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[320px]">
                      <SelectItem value="none">None</SelectItem>
                      {(projects ?? []).map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <span className="truncate max-w-[260px] block" title={project.name}>
                            {project.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {canViewTeam && <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description / Agenda</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline discussion items, goals, links..."
              rows={2}
            />
          </div>}

          {meetingType === "SHOOT" && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wide">Shoot brief</h3>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Shoot Category *</Label>
                <Select
                  value={shootDetails.category || "__none__"}
                  onValueChange={(value: string) => setShootDetails((current) => ({
                    ...current,
                    category: value === "__none__" ? "" : value,
                  }))}
                >
                  <SelectTrigger><SelectValue placeholder="Choose a shoot type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Choose a shoot type</SelectItem>
                    {["Product", "Brand / Campaign", "Portrait / Fashion", "Event", "Food", "Property", "Other"].map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!shootDetails.category && (
                  <p className="text-[11px] text-rose-600">Choose a category for this shoot.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Objective</Label>
                <Textarea value={shootDetails.objective} onChange={(e) => setShootDetails((d) => ({ ...d, objective: e.target.value }))} rows={2} placeholder="What should this shoot achieve?" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Shot List</Label>
                  <Textarea value={shootDetails.shotList} onChange={(e) => setShootDetails((d) => ({ ...d, shotList: e.target.value }))} rows={3} placeholder="Scenes, angles, or moments to capture" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Deliverables</Label>
                  <Textarea value={shootDetails.deliverables} onChange={(e) => setShootDetails((d) => ({ ...d, deliverables: e.target.value }))} rows={3} placeholder="Formats, quantities, aspect ratios, deadlines" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Equipment / Props</Label>
                  <Textarea value={shootDetails.equipment} onChange={(e) => setShootDetails((d) => ({ ...d, equipment: e.target.value }))} rows={2} placeholder="Gear, props, wardrobe, or setup" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Reference Link</Label>
                  <Input type="url" value={shootDetails.referenceLink} onChange={(e) => setShootDetails((d) => ({ ...d, referenceLink: e.target.value }))} placeholder="https://…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Special Instructions</Label>
                <Textarea value={shootDetails.notes} onChange={(e) => setShootDetails((d) => ({ ...d, notes: e.target.value }))} rows={2} placeholder="Access details, client constraints, safety notes…" />
              </div>
            </div>
          )}

          {canViewTeam && <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">{meetingType === "SHOOT" ? "Assigned Shoot Crew *" : "Invite Team Members"}</Label>
              <span className="text-[10px] text-muted-foreground font-medium">
                {selectedUserIds.length} selected
              </span>
            </div>
            <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-2 space-y-1 bg-muted/20">
              {(usersList ?? []).map((u) => {
                const isSelected = selectedUserIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUserSelection(u.id)}
                    className={cn(
                      "flex items-center justify-between text-xs p-1.5 rounded-md cursor-pointer transition-colors min-w-0",
                      isSelected ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                      <span className="truncate">{u.name}</span>
                      <span className="text-muted-foreground text-[10px] truncate">({u.email})</span>
                    </div>
                    <Badge variant={isSelected ? "default" : "outline"} className="text-[9px] shrink-0">
                      {isSelected ? "Invited" : "Select"}
                    </Badge>
                  </div>
                );
              })}
            </div>
            {meetingType === "SHOOT" && selectedUserIds.length === 0 && (
              <p className="text-[11px] text-rose-600">Select at least one active team member to assign this shoot.</p>
            )}
          </div>}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={submitting || (meetingType === "SHOOT" && (!selectedUserIds.length || !shootDetails.category))}
            >
              {submitting
                ? modalMode === "EDIT" ? "Saving..." : "Scheduling..."
                : modalMode === "EDIT" ? "Update Meeting" : "Schedule & Notify"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
