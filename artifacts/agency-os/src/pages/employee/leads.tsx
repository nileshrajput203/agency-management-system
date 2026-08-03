import { useState } from "react";
import { useListLeads, useUpdateLead, getListLeadsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchBar } from "@/components/common/SearchBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Calendar, Phone, Mail, FileText, ArrowRight } from "lucide-react";
import { cn, formatDateOnly } from "@/lib/utils";

const STAGES = [
  { key: "LEAD", label: "Lead", color: "border-t-slate-400" },
  { key: "CONTACTED", label: "Contacted", color: "border-t-blue-400" },
  { key: "DEMO_GIVEN", label: "Demo Given", color: "border-t-indigo-400" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "border-t-violet-400" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-amber-400" },
  { key: "WON", label: "Won", color: "border-t-emerald-500" },
  { key: "LOST", label: "Lost", color: "border-t-rose-400" },
];

export default function EmployeeLeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Form states for lead update
  const [stage, setStage] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const { data: leads, isLoading } = useListLeads({
    search: search || undefined,
  });

  // Filter leads assigned to logged in employee
  const myLeads = (leads ?? []).filter((l: any) =>
    l.assignedTo === user?.id ||
    l.assignedTo === user?.name ||
    l.assignedTo === user?.email ||
    l.createdBy === user?.id
  );

  const isFullAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(user?.systemRole || user?.role);
  const isDelegatedAdmin = Boolean(user?.isDelegatedAdmin);
  const userAllowedModules = Array.isArray(user?.allowedModules) ? user.allowedModules : [];

  const canManageLeads = isFullAdmin || (isDelegatedAdmin && (userAllowedModules.length === 0 || userAllowedModules.includes("leads") || userAllowedModules.includes("sales")));

  // Fallback if no explicit assignedTo filter matches
  const displayLeads = canManageLeads
    ? (leads ?? [])
    : (myLeads.length > 0 ? myLeads : (leads ?? []).filter((l: any) => l.assignedTo === user?.id || l.assignedTo === user?.name));

  const updateLeadMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        toast.success("Lead updated successfully");
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        setSelectedLead(null);
      },
      onError: () => toast.error("Failed to update lead"),
    },
  });

  const openEditModal = (lead: any) => {
    setSelectedLead(lead);
    setStage(lead.status || "LEAD");
    setFollowUpDate(lead.followUpDate ? lead.followUpDate.split("T")[0] : "");
    setDescription(lead.description || "");
    setNotes(lead.notes || "");
  };

  const handleSave = () => {
    if (!selectedLead) return;
    updateLeadMutation.mutate({
      id: selectedLead.id,
      data: {
        status: stage,
        followUpDate: followUpDate || undefined,
        description,
        notes,
      } as any,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> My Assigned Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage stages, follow-up timelines, and discussion notes for assigned sales leads
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SearchBar
            placeholder="Search leads…"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-28" /></CardContent></Card>
          ))}
        </div>
      ) : displayLeads.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl p-8">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No assigned leads found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            There are currently no sales leads assigned to your account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayLeads.map((l: any) => {
            const stageConfig = STAGES.find(s => s.key === l.status) || STAGES[0];
            return (
              <Card
                key={l.id}
                className="scale-hover border border-border/80 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => openEditModal(l)}
              >
                <CardContent className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors line-clamp-1">
                        {l.title || l.contactName}
                      </h3>
                      {l.companyName && (
                        <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">{l.companyName}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold shrink-0">
                      {stageConfig.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    {l.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{l.email}</span>
                      </div>
                    )}
                    {l.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{l.phone}</span>
                      </div>
                    )}
                    {l.followUpDate && (
                      <div className="flex items-center gap-2 text-amber-500 font-medium">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>Follow-up: {formatDateOnly(l.followUpDate)}</span>
                      </div>
                    )}
                    {l.description && (
                      <div className="mt-2 text-xs bg-muted/40 p-2 rounded-lg border border-border/50 text-foreground/90 whitespace-pre-wrap line-clamp-3 font-mono text-[11px]">
                        {l.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                    <span className="font-semibold text-primary">{l.value ? `₹${l.value.toLocaleString()}` : "Value N/A"}</span>
                    <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                      Update Lead <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Lead Modal for Employee */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-lg">
          {selectedLead && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                  <TrendingUp className="h-5 w-5 text-primary" /> Update Lead Progress
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold">Lead Stage</Label>
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.key} value={s.key} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Next Follow-Up Date</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Lead Description / Research Notes</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    placeholder={`• Company Location: Mumbai, Maharashtra
• Industry: Digital Marketing
• Website: www.company.com
• Contacted through LinkedIn
• Looking for Website + Social Media Management
• Existing Marketing Agency contract ends next month
• Budget approximately ₹80,000/month
• Decision maker: Marketing Manager
• Best time to call: 3 PM – 5 PM
• Follow-up after proposal submission
• Competitors: XYZ Agency
• Additional observations...`}
                    className="mt-1 text-xs resize-y w-full whitespace-pre-wrap font-mono sm:font-sans bg-background"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Activity Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Log recent conversation details or client feedback..."
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateLeadMutation.isPending}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
