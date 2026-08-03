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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { MeetingItem } from "./meeting-helpers";

interface MeetingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalMode: "CREATE" | "EDIT";
  meetingToEdit?: MeetingItem | null;
  clients?: Array<{ id: string; companyName: string }>;
  projects?: Array<{ id: string; name: string }>;
  usersList?: Array<{ id: string; name: string; email: string }>;
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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (modalMode === "EDIT" && meetingToEdit) {
      setTitle(meetingToEdit.title ?? "");
      setDescription(meetingToEdit.description ?? "");
      setStartTime(meetingToEdit.startTime ? new Date(meetingToEdit.startTime).toISOString().slice(0, 16) : "");
      setEndTime(meetingToEdit.endTime ? new Date(meetingToEdit.endTime).toISOString().slice(0, 16) : "");
      setMeetingLink(meetingToEdit.meetingLink ?? "");
      setLocation(meetingToEdit.location ?? "");
      setClientId(meetingToEdit.clientId ?? "");
      setProjectId(meetingToEdit.projectId ?? "");
      setStatus(meetingToEdit.status ?? "SCHEDULED");
      setSelectedUserIds((meetingToEdit.attendees ?? []).map((a) => a.id));
    } else if (modalMode === "CREATE") {
      setTitle("");
      setDescription("");
      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const startIso = now.toISOString().slice(0, 16);
      now.setHours(now.getHours() + 1);
      const endIso = now.toISOString().slice(0, 16);
      setStartTime(startIso);
      setEndTime(endIso);
      setMeetingLink("");
      setLocation("");
      setClientId("");
      setProjectId("");
      setStatus("SCHEDULED");
      setSelectedUserIds([]);
    }
  }, [modalMode, meetingToEdit, open]);

  const selectedClient = (clients ?? []).find((c) => c.id === clientId);
  const selectedProject = (projects ?? []).find((p) => p.id === projectId);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        attendeeUserIds: selectedUserIds,
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
              placeholder="e.g., Q3 Strategy Review / Client Onboarding Call"
              required
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold">Related Client</Label>
              <Select
                value={clientId || "none"}
                onValueChange={(val) => setClientId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="w-full">
                  <Tooltip>
                    <TooltipTrigger className="w-full text-left truncate">
                      <SelectValue placeholder="Select client">
                        {selectedClient ? selectedClient.companyName : undefined}
                      </SelectValue>
                    </TooltipTrigger>
                    {selectedClient && <TooltipContent>{selectedClient.companyName}</TooltipContent>}
                  </Tooltip>
                </SelectTrigger>
                <SelectContent className="max-w-[320px]">
                  <SelectItem value="none">None (Internal)</SelectItem>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="truncate max-w-[260px] block" title={c.companyName}>
                        {c.companyName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs font-semibold">Related Project</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(val) => setProjectId(val === "none" ? "" : val)}
              >
                <SelectTrigger className="w-full">
                  <Tooltip>
                    <TooltipTrigger className="w-full text-left truncate">
                      <SelectValue placeholder="Select project">
                        {selectedProject ? selectedProject.name : undefined}
                      </SelectValue>
                    </TooltipTrigger>
                    {selectedProject && <TooltipContent>{selectedProject.name}</TooltipContent>}
                  </Tooltip>
                </SelectTrigger>
                <SelectContent className="max-w-[320px]">
                  <SelectItem value="none">None</SelectItem>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="truncate max-w-[260px] block" title={p.name}>
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Description / Agenda</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline discussion items, goals, links..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Invite Team Members</Label>
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
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
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
