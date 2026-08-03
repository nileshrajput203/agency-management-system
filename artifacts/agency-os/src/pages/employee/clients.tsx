import { useState } from "react";
import { useListClients, useListProjects } from "@workspace/api-client-react";
import { useAuth } from "@/App";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/common/SearchBar";
import { Building2, Phone, Mail, FileText, Eye } from "lucide-react";
import { cn, extractClientFields } from "@/lib/utils";

const HEALTH_MAP: Record<string, { label: string; className: string }> = {
  GREEN: { label: "Healthy", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300" },
  YELLOW: { label: "At Risk", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300" },
  RED: { label: "Critical", className: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300" },
};

const CATEGORY_MAP: Record<string, string> = {
  RETAINER: "Retainer",
  ONE_TIME: "One-Time",
  LEAD: "Lead",
  CHURNED: "Churned",
};

export default function EmployeeClientsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const { data: clients, isLoading } = useListClients({
    search: search || undefined,
  });
  const { data: projects } = useListProjects();

  // Find projects assigned to this employee to get assigned client IDs
  const myAssignedProjectClientIds = (projects ?? [])
    .filter((p: any) => p.assignedTo === user?.id || p.assignedTo === user?.name)
    .map((p: any) => p.clientId)
    .filter(Boolean);

  // Filter clients assigned to the employee
  const myClients = (clients ?? []).filter((c: any) => {
    const isDirectlyAssigned =
      c.assignedTo === user?.id ||
      c.assignedTo === user?.name ||
      c.contactPerson === user?.name ||
      c.accountManagerId === user?.id;
    const isAssignedViaProject = myAssignedProjectClientIds.includes(c.id);
    
    return isDirectlyAssigned || isAssignedViaProject;
  });

  const isFullAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(user?.systemRole || user?.role);
  const isDelegatedAdmin = Boolean(user?.isDelegatedAdmin);
  const userAllowedModules = Array.isArray(user?.allowedModules) ? user.allowedModules : [];

  const canManageClients = isFullAdmin || (isDelegatedAdmin && (userAllowedModules.length === 0 || userAllowedModules.includes("clients")));

  // Display clients list (if privileged / canManageClients, show all workspace clients; otherwise show strictly assigned clients)
  const displayClients = canManageClients ? (clients ?? []) : myClients;

  const openDetails = (client: any) => {
    setSelectedClient(client);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> My Assigned Clients
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View details and project contacts for clients assigned to your workspace
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SearchBar
            placeholder="Search assigned clients…"
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
      ) : displayClients.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl p-8">
          <div className="inline-flex p-4 rounded-2xl bg-muted/60 mb-4">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No assigned clients found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            You currently have no clients assigned to you directly or through project memberships.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayClients.map((c: any) => {
            const healthInfo = HEALTH_MAP[c.health ?? "GREEN"] ?? HEALTH_MAP.GREEN;
            return (
              <Card
                key={c.id}
                className="scale-hover border border-border/80 hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => openDetails(c)}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl border border-border bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                        {c.companyName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-sm group-hover:text-primary transition-colors">
                          {c.companyName}
                        </h3>
                        {c.contactPerson && (
                          <p className="text-xs text-muted-foreground truncate">{c.contactPerson}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0 font-semibold", healthInfo.className)}>
                      {healthInfo.label}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    {c.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded font-medium">{CATEGORY_MAP[c.category] || c.category}</span>
                    <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                      <Eye className="h-3.5 w-3.5" /> View Details
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Client Detail Dialog for Employee */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-lg">
          {selectedClient && (() => {
            const parsed = extractClientFields(selectedClient);
            return (
              <div className="space-y-5">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                    <Building2 className="h-5 w-5 text-primary" /> {selectedClient.companyName}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/50">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Contact Person</span>
                    <span className="font-semibold text-foreground">{selectedClient.contactPerson || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Billing Category</span>
                    <span className="font-semibold text-foreground">{CATEGORY_MAP[selectedClient.category] || selectedClient.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Email</span>
                    <span className="font-semibold text-foreground truncate block">{selectedClient.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Phone</span>
                    <span className="font-semibold text-foreground">{selectedClient.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Service</span>
                    <span className="font-semibold text-foreground">{parsed.serviceType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Platforms</span>
                    <span className="font-semibold text-foreground">{parsed.platforms}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Target Audience</span>
                    <span className="font-semibold text-foreground">{parsed.targetAudience}</span>
                  </div>
                </div>

                {/* Notes section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Notes & Directives
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card text-xs min-h-[80px] whitespace-pre-wrap text-muted-foreground">
                    {parsed.notes || "No notes entered for this client."}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Link href={`/clients/${selectedClient.id}`}>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> View Full Profile
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
