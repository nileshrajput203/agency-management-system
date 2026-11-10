import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Video, Copy, MapPin, Building2, FolderKanban, User, Edit3,
} from "lucide-react";
import {
  getMeetingDisplayTitle,
  MeetingItem,
  formatDateTime,
  formatTimeOnly,
  isShootMeeting,
  parseMeetingDescription,
} from "./meeting-helpers";

interface MeetingDetailsDialogProps {
  meeting: MeetingItem | null;
  onClose: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  copyMeetingLink: (url: string) => void;
  canManageMeeting: (meeting: MeetingItem) => boolean;
  openEditDialog: (meeting: MeetingItem) => void;
}

export function MeetingDetailsDialog({
  meeting,
  onClose,
  getStatusBadge,
  copyMeetingLink,
  canManageMeeting,
  openEditDialog,
}: MeetingDetailsDialogProps) {
  return (
    <Dialog
      open={!!meeting}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          if (window.location.search.includes("id=")) {
            window.history.replaceState({}, "", "/meetings");
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-lg max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        {meeting && (
          <div className="space-y-4">
            {(() => {
              const { description, shootDetails } = parseMeetingDescription(meeting.description);
              const isShoot = isShootMeeting(meeting);
              return (
                <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                {getStatusBadge(meeting.status)}
                {isShoot && <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-300">Shoot</Badge>}
                <span className="text-xs text-muted-foreground font-medium">
                  Organized by {meeting.organizerName}
                </span>
              </div>
              <DialogTitle className="text-lg font-bold">{getMeetingDisplayTitle(meeting.title)}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              {description && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <p className="font-semibold text-muted-foreground text-[10px] uppercase mb-1">Agenda / Description</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{description}</p>
                </div>
              )}

              {shootDetails && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2 dark:border-violet-900 dark:bg-violet-950/20">
                  <p className="font-semibold text-violet-800 dark:text-violet-300 text-[10px] uppercase tracking-wide">
                    Shoot brief · {shootDetails.category}
                  </p>
                  {[
                    ["Objective", shootDetails.objective],
                    ["Shot list", shootDetails.shotList],
                    ["Deliverables", shootDetails.deliverables],
                    ["Equipment / Props", shootDetails.equipment],
                    ["Special instructions", shootDetails.notes],
                  ].filter(([, value]) => value).map(([label, value]) => (
                    <div key={label} className="space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
                      <p className="whitespace-pre-wrap leading-relaxed">{value}</p>
                    </div>
                  ))}
                  {shootDetails.referenceLink && (
                    <a
                      href={shootDetails.referenceLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-blue-600 hover:underline break-all"
                    >
                      Open reference
                    </a>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-foreground font-medium p-3 bg-muted/20 rounded-lg border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-semibold uppercase tracking-wider mb-0.5">Start Time</span>
                  <span className="block text-sm font-bold text-foreground">{formatDateTime(meeting.startTime, "dd MMM yyyy")}</span>
                  <span className="block text-xs font-semibold text-primary">{formatTimeOnly(meeting.startTime, "HH:mm")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block font-semibold uppercase tracking-wider mb-0.5">End Time</span>
                  <span className="block text-sm font-bold text-foreground">{formatDateTime(meeting.endTime, "dd MMM yyyy")}</span>
                  <span className="block text-xs font-semibold text-primary">{formatTimeOnly(meeting.endTime, "HH:mm")}</span>
                </div>
              </div>

              {meeting.meetingLink && (
                <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Video className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="font-medium truncate text-blue-700 dark:text-blue-300">
                      {meeting.meetingLink}
                    </span>
                  </div>
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0 bg-background"
                    onClick={() => copyMeetingLink(meeting.meetingLink!)}
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                </div>
              )}

              {meeting.location && (
                <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border">
                  <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{meeting.location}</span>
                </div>
              )}

              {meeting.clientName && (
                <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border min-w-0">
                  <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="truncate">Client: <strong>{meeting.clientName}</strong></span>
                </div>
              )}

              {meeting.projectName && (
                <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg border border-border min-w-0">
                  <FolderKanban className="h-4 w-4 text-violet-500 shrink-0" />
                  <span className="truncate">Project: <strong>{meeting.projectName}</strong></span>
                </div>
              )}

              {meeting.attendees && meeting.attendees.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isShoot ? "Assigned Crew" : "Invited Attendees"} ({meeting.attendees.length})
                  </p>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {meeting.attendees.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{a.name}</span>
                          {a.email && <span className="text-muted-foreground text-[10px] truncate">({a.email})</span>}
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize shrink-0">
                          {a.status.toLowerCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {canManageMeeting(meeting) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const m = meeting;
                    onClose();
                    openEditDialog(m);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit Meeting
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  if (window.location.search.includes("id=")) {
                    window.history.replaceState({}, "", "/meetings");
                  }
                }}
                className="text-xs"
              >
                Close
              </Button>
            </DialogFooter>
                </>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
