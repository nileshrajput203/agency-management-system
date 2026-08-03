import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  CalendarDays, Plus, Clock, Video, MapPin, Trash2, ExternalLink,
  FolderKanban, MoreVertical, Edit3, Copy, CheckCircle,
  XCircle, Search, Eye, Filter
} from "lucide-react";
import { useListClients, useListProjects, useListUsers } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { MeetingDetailsDialog } from "@/components/meetings/meeting-details-dialog";
import { MeetingItem, formatDateTime } from "@/components/meetings/meeting-helpers";

export default function MeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [editingMeeting, setEditingMeeting] = useState<MeetingItem | null>(null);

  // View Details Modal
  const [viewMeeting, setViewMeeting] = useState<MeetingItem | null>(null);

  // Delete Confirmation Dialog
  const [deleteMeetingId, setDeleteMeetingId] = useState<string | null>(null);

  const { data: clients } = useListClients();
  const { data: projects } = useListProjects();
  const { data: usersList } = useListUsers();

  const isFullAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(user?.systemRole || user?.role);
  const isDelegatedAdmin = Boolean(user?.isDelegatedAdmin);
  const userAllowedModules = Array.isArray(user?.allowedModules) ? user.allowedModules : [];

  const isUserAdminOrManager = isFullAdmin || (isDelegatedAdmin && (userAllowedModules.length === 0 || userAllowedModules.includes("meetings")));

  const canManageMeeting = (m: MeetingItem) => {
    if (!m) return false;
    if (isUserAdminOrManager) return true;
    return m.organizerId === user?.id || m.organizerId === (user as any)?.userId;
  };

  const getAuthToken = () => localStorage.getItem("agency_token") || localStorage.getItem("auth_token") || localStorage.getItem("token") || "";

  const fetchMeetings = async () => {
    try {
      const res = await fetch("/api/meetings", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load meetings");
      const data = await res.json();
      setMeetings(data || []);
    } catch (err: any) {
      toast.error(err.message || "Could not fetch meetings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 3500);

    const handleRefresh = () => fetchMeetings();
    window.addEventListener("agency_meetings_updated", handleRefresh);
    window.addEventListener("agency_notifications_updated", handleRefresh);
    window.addEventListener("agency_notifications_refresh", handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener("agency_meetings_updated", handleRefresh);
      window.removeEventListener("agency_notifications_updated", handleRefresh);
      window.removeEventListener("agency_notifications_refresh", handleRefresh);
    };
  }, []);

  // Handle URL deep-linking via query parameter ?id=xyz
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const targetId = searchParams.get("id");
    if (targetId) {
      if (meetings.length > 0) {
        const found = meetings.find((m) => m.id === targetId);
        if (found) setViewMeeting(found);
      } else {
        fetch(`/api/meetings/${targetId}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((m) => { if (m) setViewMeeting(m); })
          .catch(() => {});
      }
    }
  }, [meetings]);

  const openCreateDialog = () => {
    setModalMode("CREATE");
    setEditingMeeting(null);
    setDialogOpen(true);
  };

  const openEditDialog = (m: MeetingItem) => {
    setModalMode("EDIT");
    setEditingMeeting(m);
    setDialogOpen(true);
  };

  const handleSaveMeeting = async (payload: any) => {
    try {
      const url = modalMode === "EDIT" && editingMeeting ? `/api/meetings/${editingMeeting.id}` : "/api/meetings";
      const method = modalMode === "EDIT" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save meeting");
      }

      toast.success(modalMode === "EDIT" ? "Meeting updated successfully" : "Meeting scheduled successfully");
      fetchMeetings();
      window.dispatchEvent(new CustomEvent("agency_notifications_refresh"));
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
      throw err;
    }
  };

  const handleDeleteMeeting = async () => {
    if (!deleteMeetingId) return;
    try {
      const res = await fetch(`/api/meetings/${deleteMeetingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Failed to delete meeting");
      toast.success("Meeting deleted");
      setDeleteMeetingId(null);
      if (viewMeeting?.id === deleteMeetingId) setViewMeeting(null);
      fetchMeetings();
      window.dispatchEvent(new CustomEvent("agency_notifications_refresh"));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete meeting");
    }
  };

  const handleStatusChange = async (meetingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update meeting status");
      toast.success(`Meeting status updated to ${newStatus.toLowerCase()}`);
      fetchMeetings();
      window.dispatchEvent(new CustomEvent("agency_notifications_refresh"));
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    }
  };

  const copyMeetingLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20 font-semibold text-[10px]">Upcoming</Badge>;
      case "COMPLETED":
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 font-semibold text-[10px]">Completed</Badge>;
      case "CANCELLED":
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20 font-semibold text-[10px]">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.clientName && m.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.projectName && m.projectName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [meetings, searchQuery, statusFilter]);

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animated-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" /> Meetings & Syncs
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule, manage, and coordinate team & client meetings seamlessly.
            </p>
          </div>
          {isUserAdminOrManager && (
            <Button onClick={openCreateDialog} className="gap-2 shadow-xs shrink-0">
              <Plus className="h-4 w-4" /> Schedule Meeting
            </Button>
          )}
        </div>

        {/* Filters & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings by title, client, or project..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg text-xs">
              {["ALL", "SCHEDULED", "COMPLETED", "CANCELLED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                    statusFilter === st
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {st.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Meetings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground border border-dashed">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
            <h3 className="text-base font-semibold text-foreground">No meetings found</h3>
            <p className="text-xs mt-1">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search query or status filters."
                : 'Click "Schedule Meeting" above to set up a new meeting with your team or client.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMeetings.map((m) => (
              <Card
                key={m.id}
                className="shadow-2xs border border-border hover:border-primary/40 transition-all flex flex-col justify-between overflow-hidden group bg-card"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {getStatusBadge(m.status)}
                      {m.clientName && (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="text-[10px] text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded-md truncate max-w-[130px] block border border-border">
                              🏢 {m.clientName}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{m.clientName}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="focus:outline-none">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setViewMeeting(m)}>
                          <Eye className="h-4 w-4 mr-2 text-blue-500" /> View Details
                        </DropdownMenuItem>

                        {m.meetingLink && (
                          <DropdownMenuItem onClick={() => copyMeetingLink(m.meetingLink!)}>
                            <Copy className="h-4 w-4 mr-2 text-indigo-500" /> Copy Video Link
                          </DropdownMenuItem>
                        )}

                        {canManageMeeting(m) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(m)}>
                              <Edit3 className="h-4 w-4 mr-2 text-amber-500" /> Edit Meeting
                            </DropdownMenuItem>

                            {m.status !== "COMPLETED" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(m.id, "COMPLETED")}>
                                <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" /> Mark as Completed
                              </DropdownMenuItem>
                            )}

                            {m.status !== "CANCELLED" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(m.id, "CANCELLED")}>
                                <XCircle className="h-4 w-4 mr-2 text-orange-500" /> Cancel Meeting
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteMeetingId(m.id)}
                              className="text-rose-600 dark:text-rose-400 focus:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Meeting
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardTitle
                    className="text-base font-semibold mt-2 leading-snug cursor-pointer hover:text-primary transition-colors line-clamp-2"
                    onClick={() => setViewMeeting(m)}
                  >
                    {m.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                  <div>
                    {m.description && (
                      <p className="text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}

                    <div className="space-y-1.5 text-foreground/90 font-medium">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          {formatDateTime(m.startTime, "dd MMM yyyy, HH:mm")} ({m.durationMinutes} mins)
                        </span>
                      </div>

                      {m.meetingLink && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <a
                            href={m.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 font-semibold truncate"
                          >
                            Join Video Call <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </div>
                      )}

                      {m.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{m.location}</span>
                        </div>
                      )}

                      {m.projectName && (
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderKanban className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <Tooltip>
                            <TooltipTrigger className="text-left truncate">
                              <span className="truncate block">{m.projectName}</span>
                            </TooltipTrigger>
                            <TooltipContent>{m.projectName}</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  </div>

                  {m.attendees && m.attendees.length > 0 && (
                    <div className="pt-2 border-t border-border mt-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold mb-1.5">
                        <span className="uppercase tracking-wider">Attendees ({m.attendees.length})</span>
                        <span>Organizer: {m.organizerName}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {m.attendees.slice(0, 3).map((att) => (
                          <Badge key={att.id} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal truncate max-w-[120px]">
                            {att.name}
                          </Badge>
                        ))}
                        {m.attendees.length > 3 && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground font-medium">
                            +{m.attendees.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Meeting Details Dialog */}
        <MeetingDetailsDialog
          meeting={viewMeeting}
          onClose={() => setViewMeeting(null)}
          getStatusBadge={getStatusBadge}
          copyMeetingLink={copyMeetingLink}
          canManageMeeting={canManageMeeting}
          openEditDialog={openEditDialog}
        />

        {/* Schedule / Edit Meeting Dialog */}
        <MeetingFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          modalMode={modalMode}
          meetingToEdit={editingMeeting}
          clients={clients}
          projects={projects}
          usersList={usersList}
          onSave={handleSaveMeeting}
        />

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={!!deleteMeetingId} onOpenChange={(open) => !open && setDeleteMeetingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this meeting?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The meeting record will be permanently deleted from the system and attendees notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMeeting} className="bg-rose-600 hover:bg-rose-700 text-white">
                Delete Meeting
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
