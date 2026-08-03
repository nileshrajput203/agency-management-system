import { getCurrentUser } from "@/lib/access";
import { canPerform } from "@/lib/access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientsManager } from "@/components/clients/clients-manager";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { projects: true } } },
  });

  const isFullAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(user.systemRole);
  const isDelegatedAdmin = Boolean((user as any).isDelegatedAdmin);
  const userAllowedModules = Array.isArray((user as any).allowedModules) ? (user as any).allowedModules : [];
  const hasSpecialPrivileges = (isDelegatedAdmin && (userAllowedModules.length === 0 || userAllowedModules.includes("clients"))) || Boolean((user as any).canEditClients);

  const canManage = isFullAdmin || hasSpecialPrivileges;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients & CRM</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add and manage all client accounts.
        </p>
      </div>
      <ClientsManager
        clients={clients}
        canCreate={canManage}
        canEdit={canManage}
        canDelete={canManage}
      />
    </div>
  );
}
