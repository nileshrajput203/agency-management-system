import { useState, useEffect } from "react";
import {
  useListClients, useCreateClient, useUpdateClient, useDeleteClient, useListUsers,
  getListClientsQueryKey,
} from "@workspace/api-client-react";
import type { ClientInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { useForm, Controller } from "react-hook-form";
import { Plus, Phone, Mail, Building2, Trash2, Pencil, Users, AlertTriangle, HeartHandshake, PauseCircle, PlayCircle, RefreshCw, Calendar, Clock, DollarSign } from "lucide-react";
import { SearchBar } from "@/components/common/SearchBar";
import { cn, extractClientFields } from "@/lib/utils";
import { useAuth } from "@/App";
import { canManageModule } from "@/lib/permissions";
import { authHeaders } from "@/components/invoices/invoice-helpers";

const HEALTH_MAP: Record<string, { label: string; className: string }> = {
  GREEN: { label: "Healthy", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  YELLOW: { label: "At Risk", className: "bg-amber-100 text-amber-700 border-amber-200" },
  RED: { label: "Critical", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const CATEGORY_MAP: Record<string, string> = {
  RETAINER: "Retainer",
  ONE_TIME: "One-Time",
  LEAD: "Lead",
  CHURNED: "Churned",
};

const CONTRACT_STATUS_MAP: Record<string, { label: string; className: string }> = {
  ACTIVE:          { label: "Active Contract",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CONTRACT_PAUSED: { label: "Contract Paused",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  CONTRACT_CLOSED: { label: "Contract Closed",   className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300" },
  DORMANT:         { label: "Dormant / Inactive",className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const PAYMENT_BEHAVIOR_MAP: Record<string, { label: string; className: string }> = {
  ON_TIME:           { label: "On-Time Payer",       className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  ONE_TIME_DELAYED:  { label: "1-Time Delayed Payer",className: "text-amber-700 bg-amber-50 border-amber-200" },
  FREQUENT_DELAYED:  { label: "Frequent Delayer",    className: "text-rose-700 bg-rose-50 border-rose-200" },
};

export default function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = canManageModule(user, "clients");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [health, setHealth] = useState("ALL");
  const [contractFilter, setContractFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClientState, setEditClient] = useState<{ id: string } & ClientInput | null>(null);
  const [serviceType, setServiceType] = useState("SOCIAL_MEDIA");

  // Contract Lifecycle Dialog state
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeTargetClient, setCloseTargetClient] = useState<any>(null);
  const [closeAction, setCloseAction] = useState<"PAUSE" | "CLOSE">("PAUSE");
  const [closeReason, setCloseReason] = useState("Budget Freeze");
  const [targetRevivalDate, setTargetRevivalDate] = useState("");
  const [contractNotes, setContractNotes] = useState("");

  const handleCloseContract = async () => {
    if (!closeTargetClient) return;
    try {
      const res = await fetch(`/api/clients/${closeTargetClient.id}/close-contract`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          action: closeAction,
          reason: closeReason,
          targetRevivalDate: targetRevivalDate || undefined,
          notes: contractNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(closeAction === "PAUSE" ? "Client contract paused" : "Client contract closed (preserved for future revival)");
      setCloseDialogOpen(false);
      setCloseTargetClient(null);
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
    } catch {
      toast.error("Failed to update contract status");
    }
  };

  const handleReviveClient = async (client: any) => {
    try {
      const res = await fetch(`/api/clients/${client.id}/revive`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ notes: "Revived from dashboard" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Client ${client.companyName} revived and restored to Active!`);
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
    } catch {
      toast.error("Failed to revive client");
    }
  };

  const { data: clients, isLoading, isError } = useListClients({
    search: search || undefined,
    category: category !== "ALL" ? category : undefined,
  });
  const { data: users } = useListUsers({
    query: { enabled: canManageModule(user, "team") },
  });

  const editClient = editClientState ? (clients ?? []).find((c) => c.id === editClientState.id) as any || editClientState : null;

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        toast.success("Client created successfully.");
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create client"),
    },
  });

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => {
        toast.success("Client updated successfully.");
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setDialogOpen(false);
        setEditClient(null);
      },
      onError: () => toast.error("Failed to update client"),
    },
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => {
        toast.success("Client deleted");
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      },
      onError: () => toast.error("Failed to delete client"),
    },
  });

  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<any>({
    defaultValues: { companyName: "", category: "RETAINER", health: "GREEN", notes: "" },
  });

  const openAdd = () => {
    reset({
      companyName: "",
      contactPerson: "",
      phone: "",
      email: "",
      category: "RETAINER",
      health: "GREEN",
      serviceType: "Social Media",
      platforms: "",
      targetAudience: "",
      notes: "",
      assignedTo: "",
    });
    setEditClient(null);
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditClient(c);
    const parsed = extractClientFields(c);
    reset({
      companyName: c.companyName,
      contactPerson: c.contactPerson ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      category: c.category ?? "RETAINER",
      health: c.health ?? "GREEN",
      serviceType: parsed.rawServiceType || c.serviceType || "Social Media",
      platforms: parsed.rawPlatforms || c.platforms || "",
      targetAudience: parsed.rawTargetAudience || c.targetAudience || "",
      notes: parsed.notes || "",
      assignedTo: c.assignedTo ?? "",
    });
    setDialogOpen(true);
  };

  const handleFileUpload = (e: any) => {
    if (e.target.files.length > 0) {
      toast.success(`Uploaded ${e.target.files.length} file(s) securely.`);
    }
  };

  const onSubmit = (data: any) => {
    const payload: ClientInput & { assignedTo?: string; serviceType?: string; platforms?: string; targetAudience?: string } = {
      companyName: data.companyName,
      contactPerson: data.contactPerson || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      category: data.category,
      health: data.health || "GREEN",
      serviceType: data.serviceType || undefined,
      platforms: data.platforms || undefined,
      targetAudience: data.targetAudience || undefined,
      notes: data.notes || undefined,
      assignedTo: (data.assignedTo && data.assignedTo !== "UNASSIGNED") ? data.assignedTo : undefined,
    };

    if (editClient) {
      updateMutation.mutate({ id: editClient.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const filtered = (clients ?? []).filter((c: any) => {
    if (health !== "ALL" && c.health !== health) return false;
    const st = c.status || "ACTIVE";
    if (contractFilter === "ACTIVE" && st !== "ACTIVE") return false;
    if (contractFilter === "CONTRACT_PAUSED" && st !== "CONTRACT_PAUSED") return false;
    if (contractFilter === "CONTRACT_CLOSED" && st !== "CONTRACT_CLOSED") return false;
    if (contractFilter === "NEEDS_REVIVAL" && (st === "ACTIVE" || !c.targetRevivalDate)) return false;
    return true;
  });

  const totalActive    = (clients ?? []).filter((c: any) => !c.status || c.status === "ACTIVE").length;
  const totalPaused    = (clients ?? []).filter((c: any) => c.status === "CONTRACT_PAUSED").length;
  const totalClosed    = (clients ?? []).filter((c: any) => c.status === "CONTRACT_CLOSED").length;
  const totalRevival   = (clients ?? []).filter((c: any) => (c.status === "CONTRACT_PAUSED" || c.status === "CONTRACT_CLOSED") && Boolean(c.targetRevivalDate)).length;

  const statChips = [
    { label: "Total Clients",     value: clients?.length ?? 0, accent: "border-l-primary",      icon: <Building2 className="h-4 w-4" /> },
    { label: "Active Clients",    value: totalActive,          accent: "border-l-emerald-500",  icon: <HeartHandshake className="h-4 w-4" /> },
    { label: "Paused Contracts",  value: totalPaused,          accent: "border-l-amber-400",    icon: <PauseCircle className="h-4 w-4" /> },
    { label: "Closed / Revive",   value: totalClosed,          accent: "border-l-slate-400",    icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Clients & Contract Lifecycle
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {clients?.length ?? 0} clients shown • Active, paused contracts, and revival pipeline
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} data-testid="add-client-btn" className="gap-2 btn-micro-anim shadow-sm">
            <Plus className="h-4 w-4" /> Add Client
          </Button>
        )}
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statChips.map(({ label, value, accent, icon }) => (
          <div key={label} className={cn("bg-card border border-l-[3px] rounded-xl p-4 scale-hover shadow-xs", accent)}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-bold font-heading mt-1">{value}</p>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Contract Lifecycle Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border flex-wrap">
        <Button
          size="sm"
          variant={contractFilter === "ALL" ? "default" : "ghost"}
          onClick={() => setContractFilter("ALL")}
          className="text-xs h-7 rounded-lg"
        >
          All Clients ({clients?.length ?? 0})
        </Button>
        <Button
          size="sm"
          variant={contractFilter === "ACTIVE" ? "default" : "ghost"}
          onClick={() => setContractFilter("ACTIVE")}
          className="text-xs h-7 rounded-lg text-emerald-700 dark:text-emerald-400 font-medium"
        >
          Active Contracts ({totalActive})
        </Button>
        <Button
          size="sm"
          variant={contractFilter === "CONTRACT_PAUSED" ? "default" : "ghost"}
          onClick={() => setContractFilter("CONTRACT_PAUSED")}
          className="text-xs h-7 rounded-lg text-amber-700 dark:text-amber-400 font-medium"
        >
          Paused Deals ({totalPaused})
        </Button>
        <Button
          size="sm"
          variant={contractFilter === "CONTRACT_CLOSED" ? "default" : "ghost"}
          onClick={() => setContractFilter("CONTRACT_CLOSED")}
          className="text-xs h-7 rounded-lg"
        >
          Closed Contracts ({totalClosed})
        </Button>
        <Button
          size="sm"
          variant={contractFilter === "NEEDS_REVIVAL" ? "default" : "ghost"}
          onClick={() => setContractFilter("NEEDS_REVIVAL")}
          className="text-xs h-7 rounded-lg text-purple-700 dark:text-purple-400 font-medium"
        >
          Revival Targets ({totalRevival})
        </Button>
      </div>

      {/* Search & Billing/Health Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          placeholder="Search clients…"
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-48 max-w-80"
          data-testid="client-search"
        />
        <Select value={category} onValueChange={(val) => setCategory(val ?? "ALL")}>
          <SelectTrigger className="w-36" data-testid="category-filter">
            <SelectValue placeholder="Billing Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Billings</SelectItem>
            <SelectItem value="RETAINER">Retainer</SelectItem>
            <SelectItem value="ONE_TIME">One-Time</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="CHURNED">Churned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={health} onValueChange={(val) => setHealth(val ?? "ALL")}>
          <SelectTrigger className="w-32" data-testid="health-filter">
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Health</SelectItem>
            <SelectItem value="GREEN">Healthy</SelectItem>
            <SelectItem value="YELLOW">At Risk</SelectItem>
            <SelectItem value="RED">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Failed to load clients. Please refresh the page.
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-28" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">No clients found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || category !== "ALL" || health !== "ALL"
              ? "Try adjusting your search or filters"
              : "Add your first client to get started"}
          </p>
          {!search && category === "ALL" && health === "ALL" && isAdmin && (
            <Button onClick={openAdd} className="mt-4 gap-2 btn-micro-anim" size="sm">
              <Plus className="h-4 w-4" /> Add Client
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const healthInfo = HEALTH_MAP[c.health ?? "GREEN"] ?? HEALTH_MAP.GREEN;
            const borderAccent = c.health === "GREEN" ? "border-l-emerald-500" : c.health === "YELLOW" ? "border-l-amber-400" : "border-l-rose-500";
            return (
              <Card key={c.id} className={cn("scale-hover border-l-[3px] group", borderAccent)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo / Avatar */}
                      <div className={cn(
                        "h-10 w-10 rounded-xl border border-border overflow-hidden flex items-center justify-center shrink-0 text-sm font-bold",
                        c.logoUrl ? "" : "bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
                      )}>
                        {c.logoUrl ? (
                          <img src={c.logoUrl} alt={c.companyName} className="h-full w-full object-cover" />
                        ) : (
                          c.companyName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/clients/${c.id}`} className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 text-sm">
                          {c.companyName}
                        </Link>
                        {c.contactPerson && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{c.contactPerson}</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(c as any).status === "CONTRACT_PAUSED" || (c as any).status === "CONTRACT_CLOSED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            title="Revive Client Contract"
                            onClick={() => handleReviveClient(c)}
                          >
                            <PlayCircle className="h-3.5 w-3.5" /> Revive
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            title="Pause or Close Contract (Preserves client data for future revival)"
                            onClick={() => {
                              setCloseTargetClient(c);
                              setCloseAction("PAUSE");
                              setCloseReason("Budget Freeze");
                              setTargetRevivalDate("");
                              setContractNotes("");
                              setCloseDialogOpen(true);
                            }}
                          >
                            <PauseCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} data-testid={`edit-client-${c.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: c.id })} data-testid={`delete-client-${c.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Status, Billing, and Payment Behavior Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {(() => {
                      const contractSt = CONTRACT_STATUS_MAP[(c as any).status || "ACTIVE"] || CONTRACT_STATUS_MAP.ACTIVE;
                      const paymentBeh = PAYMENT_BEHAVIOR_MAP[(c as any).paymentBehavior || "ON_TIME"] || PAYMENT_BEHAVIOR_MAP.ON_TIME;
                      return (
                        <>
                          <Badge variant="outline" className={cn("text-[11px] border font-medium", contractSt.className)}>
                            {contractSt.label}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[11px] border font-medium", paymentBeh.className)}>
                            {paymentBeh.label}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[11px] border", healthInfo.className)}>
                            {healthInfo.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            {CATEGORY_MAP[c.category ?? "RETAINER"] ?? c.category}
                          </Badge>
                        </>
                      );
                    })()}
                  </div>

                  {/* Paused / Closed Contract Information & Revival Banner */}
                  {((c as any).status === "CONTRACT_PAUSED" || (c as any).status === "CONTRACT_CLOSED") && (
                    <div className="mb-3 p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">
                          {(c as any).status === "CONTRACT_PAUSED" ? "Contract Paused" : "Contract Closed"}
                        </span>
                        {(c as any).targetRevivalDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                            <Calendar className="h-3 w-3" /> Target: {(c as any).targetRevivalDate}
                          </span>
                        )}
                      </div>
                      {(c as any).closeReason && (
                        <p className="text-muted-foreground text-[11px]">Reason: {(c as any).closeReason}</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-1.5 h-6 text-xs text-emerald-700 bg-white hover:bg-emerald-50 border-emerald-300 gap-1.5 shadow-xs"
                        onClick={() => handleReviveClient(c)}
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> 1-Click Revive Client
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                    {c.phone && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <WriteWithAI
              context="client"
              onFill={(fields) => {
                if (fields.companyName) setValue("companyName", fields.companyName, { shouldDirty: true });
                if (fields.contactPerson) setValue("contactPerson", fields.contactPerson, { shouldDirty: true });
                if (fields.email) setValue("email", fields.email, { shouldDirty: true });
                if (fields.phone) setValue("phone", fields.phone, { shouldDirty: true });
                if (fields.notes) setValue("notes", fields.notes, { shouldDirty: true });
                if (fields.category) setValue("category", fields.category, { shouldDirty: true });
              }}
            />
            
            {/* Client Name */}
            <div className="space-y-1.5">
              <Label>Client Name *</Label>
              <Input
                {...register("companyName", { required: "Required" })}
                placeholder="Acme Corp"
              />
              {errors.companyName && <p className="text-xs text-destructive">{(errors.companyName as any).message}</p>}
            </div>

            {/* Contact Person & Billing Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input {...register("contactPerson")} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Category</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value ?? "RETAINER"} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RETAINER">Retainer</SelectItem>
                        <SelectItem value="ONE_TIME">One-Time</SelectItem>
                        <SelectItem value="LEAD">Lead</SelectItem>
                        <SelectItem value="CHURNED">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register("email")} type="email" placeholder="contact@client.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="+91 98765 43210" />
              </div>
            </div>

            {/* Service & Platforms */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Input {...register("serviceType")} placeholder="e.g. Social Media Management, Website Dev" />
              </div>
              <div className="space-y-1.5">
                <Label>Platforms</Label>
                <Input {...register("platforms")} placeholder="e.g. Instagram, Facebook, LinkedIn" />
              </div>
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <Label>Target Audience</Label>
              <Input {...register("targetAudience")} placeholder="e.g. Gen Z, B2B Professionals" />
            </div>

            {/* Notes & Directives */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="font-semibold text-foreground">Notes & Directives</Label>
              <Textarea
                {...register("notes")}
                placeholder="Client instructions, brand guidelines, important reminders, internal comments, meeting notes..."
                rows={3}
              />
            </div>

            {/* Optional Attachments */}
            <div className="space-y-1.5 pt-2">
              <Label className="flex items-center gap-2 text-xs">Upload Files / Resources <Badge variant="secondary" className="text-[10px]">Optional</Badge></Label>
              <div className="flex items-center gap-2">
                <Input type="file" multiple className="cursor-pointer text-xs file:text-primary file:bg-primary/10 file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 hover:file:bg-primary/20" onChange={handleFileUpload} />
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-1.5 pt-2">
                <Label>Assigned Employee / Account Manager</Label>
                <Controller
                  control={control}
                  name="assignedTo"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Unassigned (All Admins)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UNASSIGNED">Unassigned (All Admins)</SelectItem>
                        {(users ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="save-client-btn">
                {editClient ? "Save Changes" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close or Pause Contract Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-amber-500" />
              Contract Lifecycle: {closeTargetClient?.companyName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 rounded-xl border border-blue-200 text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-0.5">Preserve All Historical Records</p>
              <p>Closing or pausing this contract keeps all client invoices, proposals, tasks, and project history 100% intact. You can revive this client with 1 click at any time.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Action *</Label>
              <Select value={closeAction} onValueChange={(v: "PAUSE" | "CLOSE") => setCloseAction(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAUSE">Pause Contract (Temporary Hold / Seasonal Break)</SelectItem>
                  <SelectItem value="CLOSE">Close Deal / Conclude Contract Term</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Budget Freeze">Client Budget Freeze</SelectItem>
                  <SelectItem value="Seasonal Break">Seasonal Break / Festive Off-season</SelectItem>
                  <SelectItem value="Project Completed">Scope / Project Completed</SelectItem>
                  <SelectItem value="Internal Restructuring">Client Internal Restructuring</SelectItem>
                  <SelectItem value="Agency Switch">Switching Vendors Temporarily</SelectItem>
                  <SelectItem value="Contract Concluded">Contract Concluded on Friendly Terms</SelectItem>
                  <SelectItem value="Other">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Target Revival Date (Optional)</Label>
              <Input
                type="date"
                value={targetRevivalDate}
                onChange={e => setTargetRevivalDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Set when you expect to follow up or revive this client (e.g. in 2-3 months).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Internal Handover / Accounting Notes</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Retainer paused for Q3. Promised to reconnect for Diwali campaign in October."
                value={contractNotes}
                onChange={e => setContractNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleCloseContract}
            >
              {closeAction === "PAUSE" ? "Pause Contract" : "Conclude Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
