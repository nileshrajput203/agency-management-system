import { useState } from "react";
import { useListUsers, useUpdateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldAlert, ShieldCheck, UserCheck, Search, Shield, Key, History,
  CheckCircle2, Lock, Eye, AlertCircle, Sparkles, Building2, Users
} from "lucide-react";
import { useAuth } from "@/App";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNT_MANAGER: "Account Manager",
  CREATIVE_STRATEGIST: "Creative Strategist",
  DESIGNER: "Designer",
  DEVELOPER: "Developer",
  CONTENT_CREATOR: "Content Creator",
  EMPLOYEE: "Employee",
  CLIENT: "Client",
};

const ALL_MODULES = [
  { id: "clients", label: "Clients & Leads", desc: "Manage client profiles, contacts & accounts" },
  { id: "sales", label: "Sales & Pipelines", desc: "Access deal pipelines and sales tracking" },
  { id: "projects", label: "Projects", desc: "Create, edit, and oversee client projects" },
  { id: "tasks", label: "Tasks & Workflows", desc: "Assign, update, and manage task boards" },
  { id: "meetings", label: "Meetings & Schedule", desc: "Organize client meetings and team syncs" },
  { id: "content", label: "Content Ideation", desc: "Manage social posts and creative ideation" },
  { id: "finance", label: "Finance & Invoices", desc: "Invoices, quotations, proposals & purchase orders" },
  { id: "reports", label: "Reports & Analytics", desc: "Access agency performance and financial reports" },
  { id: "team", label: "User & Team Management", desc: "Manage team members and access controls" },
  { id: "settings", label: "System Settings", desc: "Configure global agency settings and parameters" },
];

export function UserAccessManagement() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const { data: users, isLoading } = useListUsers();

  const { data: auditLogs, isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["user-audit-logs"],
    queryFn: async () => {
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/users/audit-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast.success("User access permissions updated");
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        refetchLogs();
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to update permissions");
      },
    },
  });

  const handleToggleDelegation = (user: any, enabled: boolean) => {
    if (user.id === currentUser?.id) {
      toast.error("Security Rule: You cannot modify your own delegated administrative privileges.");
      return;
    }

    updateMutation.mutate({
      id: user.id,
      data: {
        isDelegatedAdmin: enabled,
        portalMode: user.portalMode || "MODE_1",
        viewAllClients: enabled ? user.viewAllClients : false,
        allowedModules: user.allowedModules || [],
        auditReason: enabled ? "Granted delegated administrative privileges" : "Revoked delegated administrative access",
      } as any,
    });
  };

  const handleModeChange = (user: any, mode: "MODE_1" | "MODE_2") => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot modify your own portal mode.");
      return;
    }
    updateMutation.mutate({
      id: user.id,
      data: {
        isDelegatedAdmin: user.isDelegatedAdmin,
        portalMode: mode,
        auditReason: `Updated portal access mode to ${mode === "MODE_1" ? "Mode 1 (Employee Portal)" : "Mode 2 (Admin Portal)"}`,
      } as any,
    });
  };

  const handleToggleViewAllClients = (user: any, enabled: boolean) => {
    updateMutation.mutate({
      id: user.id,
      data: {
        viewAllClients: enabled,
        auditReason: enabled ? "Granted 'View All Clients' privilege" : "Revoked 'View All Clients' privilege",
      } as any,
    });
  };

  const handleToggleModule = (user: any, moduleId: string) => {
    const currentMods: string[] = user.allowedModules || [];
    const nextMods = currentMods.includes(moduleId)
      ? currentMods.filter((m) => m !== moduleId)
      : [...currentMods, moduleId];

    updateMutation.mutate({
      id: user.id,
      data: {
        allowedModules: nextMods,
        auditReason: `Updated module permissions: ${currentMods.includes(moduleId) ? "Removed" : "Added"} ${moduleId}`,
      } as any,
    });
  };

  const filteredUsers = (users ?? []).filter((u: any) => {
    const term = searchTerm.toLowerCase();
    return u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || (u.systemRole || "").toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="permissions" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold font-heading flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              User Access & Administrative Delegation
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grant or revoke delegated administrative permissions without altering primary user roles.
            </p>
          </div>
          <TabsList className="bg-muted p-1 rounded-lg">
            <TabsTrigger value="permissions" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Team Permissions
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" /> Audit Trail
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TEAM PERMISSIONS TAB */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team member by name, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredUsers.map((u: any) => {
              const isSelf = u.id === currentUser?.id;
              const isPrimaryAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(u.systemRole);

              return (
                <Card key={u.id} className={cn("transition-all border", u.isDelegatedAdmin ? "border-primary/40 bg-primary/5 shadow-2xs" : "border-border")}>
                  <CardContent className="p-5 space-y-4">
                    {/* User Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-border/60">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0", u.isDelegatedAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                          {u.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{u.name}</h3>
                            {isSelf && <Badge variant="outline" className="text-[10px] py-0 px-1.5">You</Badge>}
                            {u.isDelegatedAdmin && (
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] gap-1">
                                <Sparkles className="h-3 w-3" /> Delegated Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[11px] text-muted-foreground">Primary Role</p>
                          <Badge variant="secondary" className="text-xs font-medium">
                            {ROLE_LABELS[u.systemRole] || u.systemRole}
                          </Badge>
                        </div>

                        {/* Grant Delegated Access Toggle */}
                        <div className="flex items-center gap-2 border-l pl-3 border-border/80">
                          <div className="text-right">
                            <p className="text-xs font-semibold leading-tight">Grant Administrative Access</p>
                            <p className="text-[10px] text-muted-foreground">{u.isDelegatedAdmin ? "ON" : "OFF"}</p>
                          </div>
                          <Switch
                            checked={Boolean(u.isDelegatedAdmin)}
                            onCheckedChange={(val) => handleToggleDelegation(u, val)}
                            disabled={isSelf || isPrimaryAdmin || updateMutation.isPending}
                            data-testid={`toggle-delegation-${u.id}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Extended Configuration for Delegated Admins or Module Customization */}
                    {u.isDelegatedAdmin ? (
                      <div className="space-y-4 pt-1 animated-fade-in">
                        {/* Option 1: Portal Mode Configuration */}
                        <div className="bg-background border rounded-lg p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs font-bold flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-primary" />
                                Portal Access Mode
                              </Label>
                              <p className="text-[11px] text-muted-foreground">
                                Choose which portal experience this delegated employee receives.
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={u.portalMode === "MODE_1" || !u.portalMode ? "default" : "outline"}
                                className="h-7 text-xs"
                                onClick={() => handleModeChange(u, "MODE_1")}
                                disabled={isSelf}
                              >
                                Mode 1: Employee Portal
                              </Button>
                              <Button
                                size="sm"
                                variant={u.portalMode === "MODE_2" ? "default" : "outline"}
                                className="h-7 text-xs"
                                onClick={() => handleModeChange(u, "MODE_2")}
                                disabled={isSelf}
                              >
                                Mode 2: Full Admin Portal
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Option 2: Client Access Restriction Scope */}
                        <div className="bg-background border rounded-lg p-3.5 flex items-center justify-between">
                          <div>
                            <Label className="text-xs font-bold flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5 text-indigo-500" />
                              View All Clients Permission
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              {u.viewAllClients
                                ? "User can view all company clients across all departments."
                                : "User remains restricted to viewing only assigned clients."}
                            </p>
                          </div>
                          <Switch
                            checked={Boolean(u.viewAllClients)}
                            onCheckedChange={(val) => handleToggleViewAllClients(u, val)}
                            disabled={isSelf}
                          />
                        </div>

                        {/* Option 3: Granular Module Access Selection */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold flex items-center gap-1.5">
                            <Key className="h-3.5 w-3.5 text-emerald-500" />
                            Delegated Administrative Modules
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Enable specific administrative capabilities for this user:
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                            {ALL_MODULES.map((m) => {
                              const isEnabled = (u.allowedModules || []).includes(m.id);
                              return (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "flex items-center justify-between p-2.5 rounded-lg border transition-all text-xs",
                                    isEnabled ? "bg-accent/40 border-primary/30" : "bg-card border-border/60 opacity-80"
                                  )}
                                >
                                  <div>
                                    <p className="font-semibold text-xs">{m.label}</p>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">{m.desc}</p>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={() => handleToggleModule(u, m.id)}
                                    disabled={isSelf}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Standard User Module Access Summary */
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Assigned Modules ({u.allowedModules?.length || 0}):</span>
                        <div className="flex flex-wrap gap-1">
                          {(u.allowedModules || []).map((mod: string) => (
                            <Badge key={mod} variant="outline" className="text-[10px] uppercase">
                              {mod}
                            </Badge>
                          ))}
                          {(!u.allowedModules || u.allowedModules.length === 0) && (
                            <span className="italic text-[11px]">Standard Employee View</span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* AUDIT TRAIL TAB */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Delegation & Permission Audit Logs
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time security trail recording all privilege assignments, modifications, and revocations.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading audit records...</div>
              ) : (!auditLogs || auditLogs.length === 0) ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No access modification logs recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-y text-muted-foreground uppercase text-[10px] font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Admin User</th>
                        <th className="py-2.5 px-4">Target User</th>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-4">Permissions Modified</th>
                        <th className="py-2.5 px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {auditLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-4 whitespace-nowrap text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 font-medium">{log.adminUserName || "Admin"}</td>
                          <td className="py-2.5 px-4 font-medium">{log.targetUserName || "User"}</td>
                          <td className="py-2.5 px-4">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px]",
                                log.action === "DELEGATED_ACCESS_REVOKED"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              )}
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="space-y-1">
                              {log.permissionsAdded && log.permissionsAdded.length > 0 && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                  + Added: {log.permissionsAdded.join(", ")}
                                </div>
                              )}
                              {log.permissionsRemoved && log.permissionsRemoved.length > 0 && (
                                <div className="text-[10px] text-rose-600 dark:text-rose-400">
                                  - Removed: {log.permissionsRemoved.join(", ")}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">{log.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
