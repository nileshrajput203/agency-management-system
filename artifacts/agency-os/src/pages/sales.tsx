import { useState } from "react";
import {
  useListLeads, useCreateLead, useUpdateLead, useDeleteLead,
  useGetPipelineSummary, getListLeadsQueryKey,
} from "@workspace/api-client-react";
import { SearchBar } from "@/components/common/SearchBar";
import type { LeadInput } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { useForm, Controller } from "react-hook-form";
import {
  Plus, Trash2, IndianRupee, TrendingUp, Calendar, Phone,
  PhoneCall, AlertCircle, Clock, Edit2, ListTodo,
} from "lucide-react";
import { cn, formatDateOnly } from "@/lib/utils";
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STAGES = [
  { key: "LEAD", label: "Lead", color: "border-t-slate-400" },
  { key: "CONTACTED", label: "Contacted", color: "border-t-blue-400" },
  { key: "DEMO_GIVEN", label: "Demo Given", color: "border-t-indigo-400" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "border-t-violet-400" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-t-amber-400" },
  { key: "WON", label: "Won", color: "border-t-emerald-500" },
  { key: "LOST", label: "Lost", color: "border-t-rose-400" },
];

function callStatusBadge(status: string) {
  if (status === "OVERDUE") return <Badge className="text-[9px] px-1 py-0 bg-red-100 text-red-700 border-red-200">Overdue</Badge>;
  if (status === "TODAY") return <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 border-amber-200">Today</Badge>;
  return <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-200">Upcoming</Badge>;
}

/* ─── Sortable lead card (matches task kanban animation) ─── */
function SortableLeadCard({
  lead, deleteMutation, isDragOverlay, onEdit,
}: {
  lead: any;
  deleteMutation?: any;
  isDragOverlay?: boolean;
  onEdit?: (lead: any) => void;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const nextCall = lead.nextCallDate ? new Date(lead.nextCallDate) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const callIsToday = nextCall && nextCall >= today && nextCall < new Date(today.getTime() + 86400000);
  const callIsOverdue = nextCall && nextCall < today;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      className={cn(
        "bg-card border border-border rounded-lg p-3 shadow-sm group select-none",
        isDragOverlay
          ? "cursor-grabbing shadow-lg opacity-90"
          : "cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
        isDragging && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold line-clamp-2 flex-1 leading-snug">{lead.title}</p>
        {!isDragOverlay && (
          <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon" variant="ghost"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit?.(lead); }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button
              size="icon" variant="ghost"
              className="h-5 w-5 text-destructive hover:text-destructive"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); deleteMutation?.mutate({ id: lead.id }); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {lead.companyName && <p className="text-[11px] text-muted-foreground mt-0.5">{lead.companyName}</p>}
      {lead.contactName && <p className="text-[11px] text-muted-foreground">{lead.contactName}</p>}

      {(lead.value ?? 0) > 0 && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-primary font-medium">
          <IndianRupee className="h-3 w-3" />
          {(lead.value ?? 0).toLocaleString("en-IN")}
        </div>
      )}

      {lead.expectedCloseDate && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Close: {formatDateOnly(lead.expectedCloseDate)}</span>
        </div>
      )}

      {nextCall && (
        <div className={cn(
          "flex items-center gap-1 mt-1 text-[10px] font-medium rounded px-1 py-0.5",
          callIsOverdue ? "text-red-600 bg-red-50" : callIsToday ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50/60",
        )}>
          <Phone className="h-3 w-3" />
          <span>Call: {formatDateOnly(nextCall.toISOString())}</span>
          {callIsToday && <span className="ml-0.5 font-bold">• Today!</span>}
          {callIsOverdue && <span className="ml-0.5 font-bold">• Overdue</span>}
        </div>
      )}

      {lead.daysInStage != null && lead.daysInStage > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">{lead.daysInStage}d in stage</p>
      )}

      {lead.description && (
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 line-clamp-2 bg-muted/30 p-1.5 rounded border border-border/40 font-mono whitespace-pre-wrap">
          {lead.description}
        </p>
      )}
    </div>
  );
}

/* ─── Droppable stage column ─── */
function DroppableStage({ stage, stageLeads, activeId, deleteMutation, onEdit }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-w-[220px] max-w-[240px] shrink-0 rounded-xl border border-border border-t-2 bg-muted/30 transition-colors flex flex-col",
        stage.color,
        isOver && "ring-2 ring-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 bg-card/50 rounded-t-xl border-b border-border/50">
        <p className="text-sm font-semibold">{stage.label}</p>
        <Badge variant="secondary" className="text-xs px-1.5 py-0">{stageLeads.length}</Badge>
      </div>

      <div className="p-2 space-y-2 flex-1 min-h-[150px]">
        <SortableContext items={stageLeads.map((l: any) => l.id)} strategy={verticalListSortingStrategy}>
          {stageLeads.map((lead: any) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              deleteMutation={deleteMutation}
              onEdit={onEdit}
            />
          ))}
        </SortableContext>

        {stageLeads.length === 0 && (
          <div className="flex items-center justify-center py-6 h-full">
            <div className="flex flex-col items-center text-muted-foreground/40">
              <TrendingUp className="h-5 w-5 mb-1" />
              <p className="text-xs">Drop here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sales Tasks tab ─── */
function SalesTasksTab({ onEdit }: { onEdit: (lead: any) => void }) {
  const { data: scheduled = [], isLoading } = useQuery({
    queryKey: ["leads-scheduled"],
    queryFn: async () => {
      const res = await fetch("/api/leads/scheduled-calls", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="space-y-3 mt-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );

  if (scheduled.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
        <PhoneCall className="h-10 w-10 mb-3" />
        <p className="font-medium">No scheduled calls</p>
        <p className="text-sm mt-1">Set a call date on any lead to see it here</p>
      </div>
    );
  }

  const overdue = scheduled.filter((l: any) => l.callStatus === "OVERDUE");
  const today = scheduled.filter((l: any) => l.callStatus === "TODAY");
  const upcoming = scheduled.filter((l: any) => l.callStatus === "UPCOMING");

  const Section = ({ title, leads, icon: Icon, color }: any) => leads.length === 0 ? null : (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 text-sm font-semibold", color)}>
        <Icon className="h-4 w-4" />
        <span>{title}</span>
        <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {leads.map((lead: any) => (
          <div
            key={lead.id}
            onClick={() => onEdit(lead)}
            className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{lead.title}</p>
                {lead.companyName && <p className="text-xs text-muted-foreground">{lead.companyName}</p>}
                {lead.contactName && <p className="text-xs text-muted-foreground">{lead.contactName}</p>}
              </div>
              {callStatusBadge(lead.callStatus)}
            </div>
            <div className={cn(
              "flex items-center gap-1.5 mt-2.5 text-xs font-medium",
              lead.callStatus === "OVERDUE" ? "text-red-600" : lead.callStatus === "TODAY" ? "text-amber-600" : "text-blue-600",
            )}>
              <Phone className="h-3.5 w-3.5" />
              {formatDateOnly(lead.nextCallDate)}
            </div>
            <div className="flex items-center justify-between mt-2">
              <Badge variant="outline" className="text-[10px]">{lead.stage?.replace(/_/g, " ")}</Badge>
              {(lead.value ?? 0) > 0 && (
                <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                  <IndianRupee className="h-3 w-3" />
                  {(lead.value ?? 0).toLocaleString("en-IN")}
                </span>
              )}
            </div>
            {lead.description && (
              <p className="text-[10px] text-muted-foreground/70 mt-2 line-clamp-2">{lead.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 mt-4">
      <Section title="Overdue Calls" leads={overdue} icon={AlertCircle} color="text-red-600" />
      <Section title="Call Today" leads={today} icon={PhoneCall} color="text-amber-600" />
      <Section title="Upcoming" leads={upcoming} icon={Clock} color="text-blue-600" />
    </div>
  );
}

/* ─── Lead form fields (shared between create & edit) ─── */
function LeadFormFields({ register, control, setValue, isEdit = false }: any) {
  return (
    <div className="space-y-4">
      {!isEdit && (
        <WriteWithAI
          context="lead"
          onFill={(fields) => {
            if (fields.title) setValue("title", fields.title, { shouldDirty: true });
            if (fields.companyName) setValue("companyName", fields.companyName, { shouldDirty: true });
            if (fields.contactName) setValue("contactName", fields.contactName, { shouldDirty: true });
            if (fields.email) setValue("email", fields.email, { shouldDirty: true });
            if (fields.value) setValue("value", Number(fields.value) as any, { shouldDirty: true });
            if (fields.stage) setValue("stage", fields.stage, { shouldDirty: true });
          }}
        />
      )}

      <div className="space-y-1.5">
        <Label>Lead Title</Label>
        <Input {...register("title", { required: "Required" })} placeholder="Social Media Management" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Company Name</Label>
          <Input {...register("companyName")} placeholder="Acme Inc" />
        </div>
        <div className="space-y-1.5">
          <Label>Contact Name</Label>
          <Input {...register("contactName")} placeholder="Jane Doe" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Value (₹)</Label>
          <Input {...register("value")} type="number" placeholder="50000" />
        </div>
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input {...register("email")} type="email" placeholder="lead@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Expected Close Date</Label>
          <Input {...register("expectedCloseDate")} type="date" />
        </div>
      </div>

      {/* Next Call Scheduling */}
      <div className="space-y-1.5 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
        <Label className="flex items-center gap-2 text-blue-700 font-semibold">
          <Phone className="h-3.5 w-3.5" />
          Schedule Next Call
        </Label>
        <Input
          {...register("nextCallDate")}
          type="date"
          className="border-blue-200 focus-visible:ring-blue-300"
          min={new Date().toISOString().split("T")[0]}
        />
        <p className="text-[10px] text-blue-500/80">
          On that day, this lead will appear in the Sales Tasks tab with a reminder.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Description / Research Notes</Label>
        <Textarea
          {...register("description")}
          rows={6}
          placeholder={`• Company Location: Mumbai, Maharashtra
• Industry: Digital Marketing
• Looking for Website + Social Media Management
• Budget approximately ₹80,000/month
• Decision maker: Marketing Manager
• Best time to call: 3 PM – 5 PM
• Competitors: XYZ Agency`}
          className="text-xs resize-y w-full whitespace-pre-wrap font-mono sm:font-sans"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Internal Notes</Label>
        <Textarea
          {...register("notes")}
          rows={3}
          placeholder="Follow-up after demo, waiting for budget approval…"
          className="text-xs resize-y"
        />
      </div>
    </div>
  );
}

/* ─── Main page ─── */
export default function SalesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"funnel" | "tasks">("funnel");
  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<any | null>(null);
  const [activeLead, setActiveLead] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: leads = [], isLoading } = useListLeads();
  const { data: pipeline } = useGetPipelineSummary();

  const createMutation = useCreateLead({
    mutation: {
      onSuccess: () => {
        toast.success("Lead created");
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: ["leads-scheduled"] });
        setCreateOpen(false);
      },
      onError: () => toast.error("Failed to create lead"),
    },
  });

  const updateMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: ["leads-scheduled"] });
        setEditLead(null);
        toast.success("Lead updated");
      },
      onError: () => toast.error("Failed to update lead"),
    },
  });

  const stageMutation = useUpdateLead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      },
      onError: () => toast.error("Failed to move lead"),
    },
  });

  const deleteMutation = useDeleteLead({
    mutation: {
      onSuccess: () => {
        toast.success("Lead deleted");
        qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        qc.invalidateQueries({ queryKey: ["leads-scheduled"] });
      },
    },
  });

  /* Create form */
  const createForm = useForm<LeadInput>({ defaultValues: { title: "", stage: "LEAD" } });
  const onCreateSubmit = (data: LeadInput) => {
    createMutation.mutate({ data: { ...data, value: data.value ? Number(data.value) : undefined } as any });
  };

  /* Edit form */
  const editForm = useForm<any>();
  const openEdit = (lead: any) => {
    const toDateInput = (val: any) => {
      if (!val) return "";
      try { return new Date(val).toISOString().split("T")[0]; } catch { return ""; }
    };
    editForm.reset({
      ...lead,
      expectedCloseDate: toDateInput(lead.expectedCloseDate),
      nextCallDate: toDateInput(lead.nextCallDate),
    });
    setEditLead(lead);
  };
  const onEditSubmit = (data: any) => {
    const { id, createdAt, updatedAt, stageChangedAt, daysInStage, callStatus, ...rest } = data;
    updateMutation.mutate({ id: editLead.id, data: { ...rest, value: rest.value ? Number(rest.value) : undefined } as any });
  };

  /* Drag handlers */
  const handleDragStart = (event: any) => {
    const lead = leads.find((l: any) => l.id === event.active.id);
    setActiveLead(lead || null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;
    const leadId = active.id as string;
    const newStage = over.id as string;
    const lead = leads.find((l: any) => l.id === leadId);
    if (lead && (lead as any).stage !== newStage && STAGES.some(s => s.key === newStage)) {
      qc.setQueryData(getListLeadsQueryKey(), (old: any) =>
        old ? old.map((l: any) => l.id === leadId ? { ...l, stage: newStage } : l) : old
      );
      stageMutation.mutate({ id: leadId, data: { stage: newStage } as any });
    }
  };

  const pipelineTotal = (pipeline ?? []).reduce((sum: number, s: any) => sum + (s.totalValue ?? 0), 0);

  const filteredLeads = leads.filter((l: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title?.toLowerCase().includes(q) ||
      l.companyName?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.stage?.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.contactName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 animated-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Sales Funnel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredLeads.length} leads &nbsp;·&nbsp; Pipeline: ₹{pipelineTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search leads…" value={searchQuery} onChange={setSearchQuery} />
          <Button
            onClick={() => { createForm.reset({ title: "", stage: "LEAD" }); setCreateOpen(true); }}
            className="gap-2 btn-micro-anim"
            data-testid="add-lead-btn"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setTab("funnel")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
            tab === "funnel" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" /> Funnel
        </button>
        <button
          onClick={() => setTab("tasks")}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
            tab === "tasks" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ListTodo className="h-3.5 w-3.5" /> Sales Tasks
        </button>
      </div>

      {tab === "tasks" ? (
        <SalesTasksTab onEdit={openEdit} />
      ) : (
        <>
          {/* Pipeline summary */}
          {pipeline && pipeline.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
              {STAGES.map((stage) => {
                const s = (pipeline as any[]).find((p) => p.stage === stage.key);
                const stageColor = stage.color.replace("border-t-", "border-l-");
                return (
                  <div key={stage.key} className={cn(
                    "flex-1 min-w-[110px] rounded-xl border border-l-[3px] bg-card px-3 py-3 shrink-0 shadow-xs scale-hover",
                    stageColor,
                  )}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{stage.label}</p>
                    <p className="text-xl font-bold font-heading mt-1">{s?.count ?? 0}</p>
                    {(s?.totalValue ?? 0) > 0 && (
                      <p className="text-[10px] text-primary font-medium mt-0.5">₹{((s?.totalValue ?? 0) / 1000).toFixed(0)}k</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Kanban board */}
          {isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2 flex-1">
              {STAGES.map((s) => (
                <div key={s.key} className="min-w-[220px] rounded-xl border border-border bg-muted/30 p-3">
                  <Skeleton className="h-5 w-20 mb-3" />
                  <Skeleton className="h-24 mb-2" />
                  <Skeleton className="h-24" />
                </div>
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
                {STAGES.map((stage) => {
                  const stageLeads = filteredLeads.filter((l: any) => l.stage === stage.key);
                  return (
                    <DroppableStage
                      key={stage.key}
                      stage={stage}
                      stageLeads={stageLeads}
                      activeId={activeLead?.id}
                      deleteMutation={deleteMutation}
                      onEdit={openEdit}
                    />
                  );
                })}
              </div>
              <DragOverlay>
                {activeLead ? (
                  <SortableLeadCard lead={activeLead} isDragOverlay />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {/* Create lead dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="mt-2">
            <LeadFormFields
              register={createForm.register}
              control={createForm.control}
              setValue={createForm.setValue}
              isEdit={false}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-lead-btn">
                Add Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit lead dialog */}
      <Dialog open={!!editLead} onOpenChange={(open) => { if (!open) setEditLead(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              Edit Lead
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="mt-2">
            <LeadFormFields
              register={editForm.register}
              control={editForm.control}
              setValue={editForm.setValue}
              isEdit={true}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditLead(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
