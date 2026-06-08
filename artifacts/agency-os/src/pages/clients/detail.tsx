import { useGetClient, useGetClientContracts, useListProjects, useListInvoices } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Phone, Mail, Globe, MapPin, Instagram, Youtube, Facebook, Linkedin } from "lucide-react";
import { format } from "date-fns";

const STATUS_MAP: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  UNDER_REVIEW: "Under Review",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

const INV_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  SENT: { label: "Sent", variant: "outline" },
  PAID: { label: "Paid", variant: "default" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
};

export default function ClientDetailPage({ id }: { id: string }) {
  const { data: client, isLoading } = useGetClient(id);
  const { data: contracts } = useGetClientContracts(id);
  const { data: projects } = useListProjects({ params: { query: { clientId: id } } });
  const { data: invoices } = useListInvoices({ params: { query: { clientId: id } } });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Client not found.</p>
        <Link href="/clients"><a className="text-primary text-sm mt-2 inline-block">Back to Clients</a></Link>
      </div>
    );
  }

  const HEALTH_MAP: Record<string, { label: string; className: string }> = {
    GREEN: { label: "Healthy", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    YELLOW: { label: "At Risk", className: "bg-amber-100 text-amber-700 border-amber-200" },
    RED: { label: "Critical", className: "bg-rose-100 text-rose-700 border-rose-200" },
  };

  const healthInfo = HEALTH_MAP[client.health ?? "GREEN"];

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* Back + header */}
      <div>
        <Link href="/clients">
          <a className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 w-fit">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
          </a>
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">{client.companyName}</h1>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className={healthInfo.className}>{healthInfo.label}</Badge>
              <Badge variant="secondary">{client.category}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.contactPerson && <p className="font-medium">{client.contactPerson}</p>}
            {client.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4 shrink-0" />
                <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary truncate hover:underline">
                  {client.website}
                </a>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{client.address}</span>
              </div>
            )}

            {/* Social handles */}
            {(client.instagramHandle || client.youtubeHandle || client.facebookHandle || client.linkedinHandle) && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social Accounts</p>
                {client.instagramHandle && (
                  <div className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-500" /><span>{client.instagramHandle}</span></div>
                )}
                {client.youtubeHandle && (
                  <div className="flex items-center gap-2"><Youtube className="h-4 w-4 text-red-500" /><span>{client.youtubeHandle}</span></div>
                )}
                {client.facebookHandle && (
                  <div className="flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-500" /><span>{client.facebookHandle}</span></div>
                )}
                {client.linkedinHandle && (
                  <div className="flex items-center gap-2"><Linkedin className="h-4 w-4 text-blue-600" /><span>{client.linkedinHandle}</span></div>
                )}
              </div>
            )}

            {client.notes && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                <p className="text-muted-foreground text-xs whitespace-pre-line">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Projects + invoices + contracts */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contracts */}
          {contracts && contracts.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Content Contracts</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {contracts.map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{c.platform}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.postsPerMonth}P / {c.reelsPerMonth}R / {c.storiesPerMonth}S per month
                        </p>
                      </div>
                      <p className="text-sm font-semibold">₹{c.retainerAmount?.toLocaleString("en-IN")}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Projects */}
          <Card>
            <CardHeader><CardTitle className="text-base">Projects</CardTitle></CardHeader>
            <CardContent>
              {!projects || projects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No projects linked</p>
              ) : (
                <div className="divide-y divide-border">
                  {projects.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{STATUS_MAP[p.status ?? "NOT_STARTED"]}</p>
                      </div>
                      <div className="w-24">
                        <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                          <span>{p.progress ?? 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress ?? 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
            <CardContent>
              {!invoices || invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No invoices found</p>
              ) : (
                <div className="divide-y divide-border">
                  {invoices.slice(0, 5).map((inv) => {
                    const s = INV_STATUS_MAP[inv.status ?? "DRAFT"] ?? { label: inv.status, variant: "secondary" as const };
                    return (
                      <div key={inv.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{inv.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yyyy") : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                          <p className="text-sm font-semibold">₹{inv.total?.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
