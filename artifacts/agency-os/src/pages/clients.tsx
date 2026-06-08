import { useState } from "react";
import {
  useListClients, useCreateClient, useUpdateClient, useDeleteClient,
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
import { useForm, Controller } from "react-hook-form";
import { Plus, Search, Phone, Mail, Building2, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [health, setHealth] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<{ id: string } & ClientInput | null>(null);

  const { data: clients, isLoading } = useListClients({
    query: {
      queryKey: getListClientsQueryKey({ search: search || undefined, category: category !== "ALL" ? category : undefined }),
    },
    params: { query: { search: search || undefined, category: category !== "ALL" ? category : undefined } },
  });

  const createMutation = useCreateClient({
    mutation: {
      onSuccess: () => {
        toast.success("Client created");
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create client"),
    },
  });

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => {
        toast.success("Client updated");
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

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ClientInput>({
    defaultValues: { companyName: "", category: "RETAINER", health: "GREEN" },
  });

  const openAdd = () => {
    reset({ companyName: "", category: "RETAINER", health: "GREEN" });
    setEditClient(null);
    setDialogOpen(true);
  };

  const openEdit = (c: typeof clients extends (infer T)[] | undefined ? NonNullable<T> : never) => {
    setEditClient({ id: c.id, companyName: c.companyName, category: c.category ?? "RETAINER", health: c.health ?? "GREEN" });
    reset({ companyName: c.companyName, category: c.category ?? "RETAINER", health: c.health ?? "GREEN" });
    setDialogOpen(true);
  };

  const onSubmit = (data: ClientInput) => {
    if (editClient) {
      updateMutation.mutate({ id: editClient.id, data });
    } else {
      createMutation.mutate({ data });
    }
  };

  const filtered = (clients ?? []).filter((c) => {
    if (health !== "ALL" && c.health !== health) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5 animated-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients?.length ?? 0} total clients</p>
        </div>
        <Button onClick={openAdd} data-testid="add-client-btn" className="gap-2 btn-micro-anim">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="client-search"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36" data-testid="category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="RETAINER">Retainer</SelectItem>
            <SelectItem value="ONE_TIME">One-Time</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="CHURNED">Churned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={health} onValueChange={setHealth}>
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-28" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No clients found</p>
          <p className="text-sm">Add your first client to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const healthInfo = HEALTH_MAP[c.health ?? "GREEN"];
            return (
              <Card key={c.id} className="scale-hover">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Link href={`/clients/${c.id}`}>
                      <a className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                        {c.companyName}
                      </a>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEdit(c)}
                        data-testid={`edit-client-${c.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: c.id })}
                        data-testid={`delete-client-${c.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className={cn("text-[11px] border", healthInfo.className)}>
                      {healthInfo.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {CATEGORY_MAP[c.category ?? "RETAINER"] ?? c.category}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.contactPerson && (
                      <p className="truncate">{c.contactPerson}</p>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1.5">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editClient ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input
                {...register("companyName", { required: "Required" })}
                placeholder="Acme Corp"
                data-testid="client-company-name"
              />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input {...register("contactPerson")} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input {...register("email")} type="email" placeholder="contact@client.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
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
              <div className="space-y-1.5">
                <Label>Health Status</Label>
                <Controller
                  control={control}
                  name="health"
                  render={({ field }) => (
                    <Select value={field.value ?? "GREEN"} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GREEN">Healthy</SelectItem>
                        <SelectItem value="YELLOW">At Risk</SelectItem>
                        <SelectItem value="RED">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} placeholder="Internal notes..." rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="save-client-btn">
                {editClient ? "Save Changes" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
