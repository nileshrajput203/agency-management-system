// @ts-nocheck
import { useState } from "react";
import {
  useListLeads, useCreateLead, useUpdateLead, useDeleteLead,
  useGetPipelineSummary, getListLeadsQueryKey,
} from "@workspace/api-client-react";
import type { LeadInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useForm, Controller } from "react-hook-form";
import { Plus, Trash2, TrendingUp, IndianRupee, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "LEAD", label: "Lead", color: "border-t-slate-400" },
  { key: "CONTACTED", label: "Contacted", color: "border-t-blue-400" },
  { key: "DEMO_GIVEN", label: "Demo Given", color: "border-t-indigo-400" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "border-t-violet-400" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-amber-400" },
  { key: "WON", label: "Won", color: "border-t-emerald-500" },
  { key: "LOST", label: "Lost", color: "border-t-rose-400" },
];

const STAGE_TIPS: Record<string, string[]> = {
  LEAD: [
    "Research the company before first contact — check their social media and recent news.",
    "Personalize your outreach by mentioning a specific pain point.",
    "Use a compelling subject line in emails — keep it under 50 characters.",
  ],
  CONTACTED: [
    "Follow up within 48 hours if no reply — persistence pays off.",
    "Send a value-packed resource (case study, checklist) to add immediate value.",
    "Ask open-ended questions to understand their goals.",
  ],
  DEMO_GIVEN: [
    "Send a personalized summary within 24 hours after the demo.",
    "Address objections raised during the demo proactively.",
    "Share a relevant success story from a similar client.",
  ],
  PROPOSAL_SENT: [
    "Schedule a follow-up call 2-3 days after sending the proposal.",
    "Offer to walk them through the proposal live on a call.",
    "Highlight ROI and tangible outcomes, not just features.",
  ],
  NEGOTIATION: [
    "Focus on value, not price — explain the ROI clearly.",
    "Offer alternatives (phased delivery, bundled packages) instead of discounts.",
    "Set a clear decision deadline to create urgency without pressure.",
  ],
  WON: [
    "Send a welcome email immediately after closing — excitement is contagious!",
    "Schedule a kick-off meeting within the first week.",
    "Ask for a referral or testimonial within 30 days of great results.",
  ],
  LOST: [
    "Send a gracious closing email — relationships can be revived later.",
    "Ask for feedback: 'What would have made us a better fit?'",
    "Keep them in your nurture sequence for future opportunities.",
  ],
};

export default function SalesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [activeTipsStage, setActiveTipsStage] = useState<string | null>(null);

  const { data: leads, isLoading } = useListLeads();
  const { data: pipeline } = useGetPipelineSummary();

  const createMutation = useCreateLead({
    mutation: {
      onSuccess: () => { toast.success("Lead created"); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); setDialogOpen(false); },
      onError: () => toast.error("Failed to create lead"),
    },
  });

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); },
      onError: () => toast.error("Failed to move lead"),
    },
  });

  const deleteMutation = useDeleteLead({
    mutation: {
      onSuccess: () => { toast.success("Lead deleted"); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); },
    },
  });

  const { register, handleSubmit, control, reset } = useForm<LeadInput>({
    defaultValues: { title: "", stage: "LEAD" },
  });

  const onSubmit = (data: LeadInput) => {
    createMutation.mutate({ data: { ...data, value: data.value ? Number(data.value) : undefined } });
  };

  const handleDrop = (leadId: string, newStage: string) => {
    updateMutation.mutate({ id: leadId, data: { stage: newStage } });
  };

  const pipelineTotal = (pipeline ?? []).reduce((sum, s) => sum + (s.totalValue ?? 0), 0);

  return (
    <div className="p-6 animated-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Sales Funnel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads?.length ?? 0} leads &nbsp;·&nbsp; Pipeline: ₹{pipelineTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <Button onClick={() => { reset({ title: "", stage: "LEAD" }); setDialogOpen(true); }} className="gap-2 btn-micro-anim" data-testid="add-lead-btn">
          <Plus className="h-4 w-4" /> Add Lead
        </Button>
      </div>

      {/* Pipeline summary */}
      {pipeline && pipeline.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STAGES.map((stage) => {
            const s = pipeline.find((p) => p.stage === stage.key);
            return (
              <div key={stage.key} className="flex-1 min-w-[110px] rounded-lg border border-border bg-card p-3 text-center shrink-0">
                <p className="text-[11px] text-muted-foreground font-medium">{stage.label}</p>
                <p className="text-lg font-bold font-heading mt-0.5">{s?.count ?? 0}</p>
                {(s?.totalValue ?? 0) > 0 && (
                  <p className="text-[10px] text-muted-foreground">₹{((s?.totalValue ?? 0) / 1000).toFixed(0)}k</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STAGES.map((s) => (
            <div key={s.key} className="min-w-[220px] rounded-xl border border-border bg-muted/30 p-3">
              <Skeleton className="h-5 w-20 mb-3" />
              <Skeleton className="h-24 mb-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = (leads ?? []).filter((l) => l.stage === stage.key);
            const isDrop = dropTarget === stage.key;
            const tipsOpen = activeTipsStage === stage.key;
            const tips = STAGE_TIPS[stage.key] ?? [];

            return (
              <div
                key={stage.key}
                className={cn(
                  "min-w-[220px] max-w-[240px] shrink-0 rounded-xl border border-t-2 bg-muted/30 transition-all duration-150",
                  stage.color,
                  isDrop ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20 scale-[1.01]" : "border-border"
                )}
                onDragOver={(e) => { e.preventDefault(); setDropTarget(stage.key); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) { handleDrop(dragging, stage.key); setDragging(null); }
                  setDropTarget(null);
                }}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{stage.label}</p>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{stageLeads.length}</Badge>
                  </div>
                  <button
                    onClick={() => setActiveTipsStage(tipsOpen ? null : stage.key)}
                    title="Sales tips"
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center transition-colors",
                      tipsOpen ? "text-amber-500 bg-amber-50" : "text-muted-foreground hover:text-amber-500"
                    )}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Sales tactics tips */}
                {tipsOpen && (
                  <div className="mx-2 mb-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-2.5 space-y-1.5 animated-fade-in">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> Tips for {stage.label}
                    </p>
                    {tips.map((tip, i) => (
                      <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        · {tip}
                      </p>
                    ))}
                  </div>
                )}

                <div className="p-2 space-y-2 min-h-16">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        setDragging(lead.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                      className={cn(
                        "bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing group transition-all duration-150",
                        dragging === lead.id && "opacity-40 scale-95 rotate-1"
                      )}
                      data-testid={`lead-card-${lead.id}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold line-clamp-2 flex-1">{lead.title}</p>
                        <Button
                          size="icon" variant="ghost" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: lead.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {lead.companyName && <p className="text-[11px] text-muted-foreground mt-0.5">{lead.companyName}</p>}
                      {lead.contactName && <p className="text-[11px] text-muted-foreground">{lead.contactName}</p>}
                      {(lead.value ?? 0) > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-primary font-medium">
                          <IndianRupee className="h-3 w-3" />
                          {(lead.value ?? 0).toLocaleString("en-IN")}
                        </div>
                      )}
                      {lead.daysInStage != null && lead.daysInStage > 0 && (
                        <p className={cn(
                          "text-[10px] mt-1",
                          lead.daysInStage > 14 ? "text-rose-500" : lead.daysInStage > 7 ? "text-amber-500" : "text-muted-foreground"
                        )}>
                          {lead.daysInStage}d in stage{lead.daysInStage > 14 ? " ⚠️" : ""}
                        </p>
                      )}
                    </div>
                  ))}

                  {stageLeads.length === 0 && !isDrop && (
                    <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/40">
                      <TrendingUp className="h-5 w-5 mb-1" />
                      <p className="text-xs">Drop here</p>
                    </div>
                  )}

                  {isDrop && dragging && (
                    <div className="border-2 border-dashed border-primary/40 rounded-lg py-6 flex items-center justify-center text-primary/60 text-xs">
                      Move here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Lead Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Lead Title</Label>
              <Input {...register("title", { required: "Required" })} placeholder="Social Media Management" data-testid="lead-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Company Name</Label><Input {...register("companyName")} placeholder="Acme Inc" /></div>
              <div className="space-y-1.5"><Label>Contact Name</Label><Input {...register("contactName")} placeholder="Jane Doe" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Value (₹)</Label><Input {...register("value")} type="number" placeholder="50000" /></div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Controller control={control} name="stage" render={({ field }) => (
                  <Select value={field.value ?? "LEAD"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              // @ts-ignore
              <Input {...register("email")} type="email" placeholder="lead@company.com" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-lead-btn">Add Lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
