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
import {
  Plus, Search, Phone, Mail, Building2, Trash2, Pencil,
  Globe, Instagram, Youtube, Facebook, Linkedin, Twitter, Pin,
  Target, Layers, Monitor, Megaphone, Users, LayoutDashboard,
  ShoppingCart, FileText, CalendarDays, MessageCircle, CheckSquare,
} from "lucide-react";
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

const SERVICE_TYPES = [
  { value: "SOCIAL_MEDIA", label: "Social Media", icon: <Instagram className="h-4 w-4" /> },
  { value: "WEBSITE", label: "Website", icon: <Globe className="h-4 w-4" /> },
  { value: "OTHER", label: "Other", icon: <Megaphone className="h-4 w-4" /> },
];

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
  { value: "facebook", label: "Facebook", icon: <Facebook className="h-4 w-4" /> },
  { value: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4" /> },
  { value: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
  { value: "twitter", label: "Twitter/X", icon: <Twitter className="h-4 w-4" /> },
  { value: "pinterest", label: "Pinterest", icon: <Pin className="h-4 w-4" /> },
];

const SOCIAL_GOALS = [
  { value: "brand_awareness", label: "Brand Awareness" },
  { value: "lead_gen", label: "Lead Generation" },
  { value: "sales", label: "Drive Sales" },
  { value: "community", label: "Community Building" },
  { value: "thought_leadership", label: "Thought Leadership" },
  { value: "customer_support", label: "Customer Support" },
];

const CONTENT_TYPES = [
  { value: "reels", label: "Reels / Shorts" },
  { value: "stories", label: "Stories" },
  { value: "posts", label: "Feed Posts" },
  { value: "carousels", label: "Carousels" },
  { value: "live", label: "Live Sessions" },
  { value: "ugc", label: "UGC / Testimonials" },
];

const CONTENT_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "3x_week", label: "3× per week" },
  { value: "2x_week", label: "2× per week" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const WEBSITE_TYPES = [
  { value: "new_site", label: "New Website", icon: <Monitor className="h-4 w-4" /> },
  { value: "redesign", label: "Redesign", icon: <Layers className="h-4 w-4" /> },
  { value: "landing_page", label: "Landing Page", icon: <FileText className="h-4 w-4" /> },
  { value: "ecommerce", label: "E-commerce", icon: <ShoppingCart className="h-4 w-4" /> },
];

const WEBSITE_FEATURES = [
  { value: "contact_form", label: "Contact Form" },
  { value: "booking", label: "Booking / Appointments" },
  { value: "gallery", label: "Photo / Video Gallery" },
  { value: "blog", label: "Blog / News" },
  { value: "ecommerce", label: "Online Store" },
  { value: "live_chat", label: "Live Chat" },
  { value: "seo", label: "SEO Optimization" },
  { value: "multilingual", label: "Multi-language" },
];

const CMS_OPTIONS = [
  { value: "wordpress", label: "WordPress" },
  { value: "shopify", label: "Shopify" },
  { value: "webflow", label: "Webflow" },
  { value: "wix", label: "Wix" },
  { value: "custom", label: "Custom Code" },
  { value: "no_preference", label: "No Preference" },
];

const BUDGET_RANGES = [
  { value: "under_25k", label: "Under ₹25,000" },
  { value: "25k_50k", label: "₹25,000 – ₹50,000" },
  { value: "50k_1l", label: "₹50,000 – ₹1,00,000" },
  { value: "1l_3l", label: "₹1,00,000 – ₹3,00,000" },
  { value: "above_3l", label: "Above ₹3,00,000" },
];

function parseCSV(val: string | null | undefined): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}
function toCSV(vals: string[]): string {
  return vals.join(",");
}

function MultiToggle({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string[];
  onChange: (v: string[]) => void;
  cols?: number;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => toggle(opt.value)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left",
            value.includes(opt.value)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
      onSuccess: () => { toast.success("Client created"); qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); setDialogOpen(false); },
      onError: () => toast.error("Failed to create client"),
    },
  });

  const updateMutation = useUpdateClient({
    mutation: {
      onSuccess: () => { toast.success("Client updated"); qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); setDialogOpen(false); setEditClient(null); },
      onError: () => toast.error("Failed to update client"),
    },
  });

  const deleteMutation = useDeleteClient({
    mutation: {
      onSuccess: () => { toast.success("Client deleted"); qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); },
      onError: () => toast.error("Failed to delete client"),
    },
  });

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<ClientInput>({
    defaultValues: { companyName: "", category: "RETAINER", health: "GREEN", serviceType: "" },
  });

  const watchedServiceType = watch("serviceType");

  const openAdd = () => {
    reset({ companyName: "", category: "RETAINER", health: "GREEN", serviceType: "" });
    setEditClient(null);
    setDialogOpen(true);
  };

  const openEdit = (c: NonNullable<typeof clients>[number]) => {
    const vals: ClientInput = {
      companyName: c.companyName,
      category: c.category ?? "RETAINER",
      health: c.health ?? "GREEN",
      contactPerson: c.contactPerson ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      notes: c.notes ?? "",
      serviceType: c.serviceType ?? "",
      serviceDetails: c.serviceDetails ?? "",
      socialHandles: c.socialHandles ?? "",
      websiteUrl: c.websiteUrl ?? "",
      contentFrequency: c.contentFrequency ?? "",
      targetAudience: c.targetAudience ?? "",
      platforms: c.platforms ?? "",
      socialGoals: c.socialGoals ?? "",
      contentTypes: c.contentTypes ?? "",
      websiteType: c.websiteType ?? "",
      websiteFeatures: c.websiteFeatures ?? "",
      cmsPreference: c.cmsPreference ?? "",
      budgetRange: c.budgetRange ?? "",
    };
    setEditClient({ id: c.id, ...vals });
    reset(vals);
    setDialogOpen(true);
  };

  const onSubmit = (data: ClientInput) => {
    if (editClient) { updateMutation.mutate({ id: editClient.id, data }); }
    else { createMutation.mutate({ data }); }
  };

  const filtered = (clients ?? []).filter((c) => {
    if (health !== "ALL" && c.health !== health) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-5 animated-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients?.length ?? 0} total clients</p>
        </div>
        <Button onClick={openAdd} data-testid="add-client-btn" className="gap-2 btn-micro-anim">
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="client-search" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36" data-testid="category-filter"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="RETAINER">Retainer</SelectItem>
            <SelectItem value="ONE_TIME">One-Time</SelectItem>
            <SelectItem value="LEAD">Lead</SelectItem>
            <SelectItem value="CHURNED">Churned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={health} onValueChange={setHealth}>
          <SelectTrigger className="w-32" data-testid="health-filter"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Health</SelectItem>
            <SelectItem value="GREEN">Healthy</SelectItem>
            <SelectItem value="YELLOW">At Risk</SelectItem>
            <SelectItem value="RED">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-5"><Skeleton className="h-28" /></CardContent></Card>)}
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
            const svcType = SERVICE_TYPES.find((s) => s.value === c.serviceType);
            const platformList = parseCSV(c.platforms);
            return (
              <Card key={c.id} className="scale-hover group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Link href={`/clients/${c.id}`} className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                      {c.companyName}
                    </Link>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} data-testid={`edit-client-${c.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: c.id })} data-testid={`delete-client-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className={cn("text-[11px] border", healthInfo.className)}>{healthInfo.label}</Badge>
                    <Badge variant="secondary" className="text-[11px]">{CATEGORY_MAP[c.category ?? "RETAINER"] ?? c.category}</Badge>
                    {svcType && <Badge variant="outline" className="text-[11px] gap-1">{svcType.icon}{svcType.label}</Badge>}
                    {platformList.slice(0, 3).map((p) => {
                      const pl = SOCIAL_PLATFORMS.find((x) => x.value === p);
                      return pl ? (
                        <Badge key={p} variant="outline" className="text-[11px] gap-1">{pl.icon}</Badge>
                      ) : null;
                    })}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.contactPerson && <p className="truncate font-medium text-foreground/80">{c.contactPerson}</p>}
                    {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /><span>{c.phone}</span></div>}
                    {c.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span></div>}
                    {c.websiteUrl && <div className="flex items-center gap-1.5"><Globe className="h-3 w-3 shrink-0" /><a href={c.websiteUrl.startsWith("http") ? c.websiteUrl : `https://${c.websiteUrl}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-primary">{c.websiteUrl}</a></div>}
                    {c.targetAudience && <div className="flex items-center gap-1.5"><Users className="h-3 w-3 shrink-0" /><span className="truncate">{c.targetAudience}</span></div>}
                    {c.budgetRange && <div className="flex items-center gap-1.5"><Target className="h-3 w-3 shrink-0" /><span>{BUDGET_RANGES.find((b) => b.value === c.budgetRange)?.label ?? c.budgetRange}</span></div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editClient ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">

            <div className="space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input {...register("companyName", { required: "Required" })} placeholder="Acme Corp" data-testid="client-company-name" />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Contact Person</Label><Input {...register("contactPerson")} placeholder="John Doe" /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input {...register("phone")} placeholder="+91 98765 43210" /></div>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input {...register("email")} type="email" placeholder="contact@client.com" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client Category</Label>
                <Controller control={control} name="category" render={({ field }) => (
                  <Select value={field.value ?? "RETAINER"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RETAINER">Retainer</SelectItem>
                      <SelectItem value="ONE_TIME">One-Time</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                      <SelectItem value="CHURNED">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Health Status</Label>
                <Controller control={control} name="health" render={({ field }) => (
                  <Select value={field.value ?? "GREEN"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GREEN">Healthy</SelectItem>
                      <SelectItem value="YELLOW">At Risk</SelectItem>
                      <SelectItem value="RED">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>What service does this client need?</Label>
              <Controller control={control} name="serviceType" render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {SERVICE_TYPES.map((svc) => (
                    <button type="button" key={svc.value}
                      onClick={() => field.onChange(field.value === svc.value ? "" : svc.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all",
                        field.value === svc.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {svc.icon}
                      {svc.label}
                    </button>
                  ))}
                </div>
              )} />
            </div>

            {watchedServiceType === "SOCIAL_MEDIA" && (
              <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/30 animated-fade-in">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Instagram className="h-3.5 w-3.5" /> Social Media Details
                </p>

                <div className="space-y-2">
                  <Label className="text-sm">Which platforms?</Label>
                  <Controller control={control} name="platforms" render={({ field }) => (
                    <MultiToggle
                      options={SOCIAL_PLATFORMS}
                      value={parseCSV(field.value)}
                      onChange={(v) => field.onChange(toCSV(v))}
                      cols={3}
                    />
                  )} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">What are their goals?</Label>
                  <Controller control={control} name="socialGoals" render={({ field }) => (
                    <MultiToggle
                      options={SOCIAL_GOALS}
                      value={parseCSV(field.value)}
                      onChange={(v) => field.onChange(toCSV(v))}
                      cols={2}
                    />
                  )} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Content types needed</Label>
                  <Controller control={control} name="contentTypes" render={({ field }) => (
                    <MultiToggle
                      options={CONTENT_TYPES}
                      value={parseCSV(field.value)}
                      onChange={(v) => field.onChange(toCSV(v))}
                      cols={3}
                    />
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Posting Frequency</Label>
                    <Controller control={control} name="contentFrequency" render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                        <SelectContent>
                          {CONTENT_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Budget Range</Label>
                    <Controller control={control} name="budgetRange" render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                        <SelectContent>
                          {BUDGET_RANGES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Social Handles</Label>
                  <Input {...register("socialHandles")} placeholder="e.g. @brand_ig, @brand_fb, @brand_yt" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Audience</Label>
                  <Input {...register("targetAudience")} placeholder="e.g. Women 25-40, fitness enthusiasts in Mumbai" />
                </div>
                <div className="space-y-1.5">
                  <Label>Brand Notes</Label>
                  <Textarea {...register("serviceDetails")} rows={2} placeholder="Brand tone, content themes, competitor references, special requirements..." />
                </div>
              </div>
            )}

            {watchedServiceType === "WEBSITE" && (
              <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/30 animated-fade-in">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Website Details
                </p>

                <div className="space-y-2">
                  <Label className="text-sm">What type of website?</Label>
                  <Controller control={control} name="websiteType" render={({ field }) => (
                    <div className="grid grid-cols-2 gap-2">
                      {WEBSITE_TYPES.map((wt) => (
                        <button type="button" key={wt.value}
                          onClick={() => field.onChange(field.value === wt.value ? "" : wt.value)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all text-left",
                            field.value === wt.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {wt.icon}
                          {wt.label}
                        </button>
                      ))}
                    </div>
                  )} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Features needed</Label>
                  <Controller control={control} name="websiteFeatures" render={({ field }) => (
                    <MultiToggle
                      options={WEBSITE_FEATURES}
                      value={parseCSV(field.value)}
                      onChange={(v) => field.onChange(toCSV(v))}
                      cols={2}
                    />
                  )} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>CMS Preference</Label>
                    <Controller control={control} name="cmsPreference" render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select CMS" /></SelectTrigger>
                        <SelectContent>
                          {CMS_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Budget Range</Label>
                    <Controller control={control} name="budgetRange" render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                        <SelectContent>
                          {BUDGET_RANGES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Current Website URL</Label>
                  <Input {...register("websiteUrl")} placeholder="https://example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Audience</Label>
                  <Input {...register("targetAudience")} placeholder="e.g. B2B professionals in manufacturing" />
                </div>
                <div className="space-y-1.5">
                  <Label>Project Scope / Notes</Label>
                  <Textarea {...register("serviceDetails")} rows={2} placeholder="Number of pages, special integrations, reference sites, timeline..." />
                </div>
              </div>
            )}

            {watchedServiceType === "OTHER" && (
              <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/30 animated-fade-in">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Megaphone className="h-3.5 w-3.5" /> Service Details
                </p>
                <div className="space-y-1.5">
                  <Label>Budget Range</Label>
                  <Controller control={control} name="budgetRange" render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="max-w-xs"><SelectValue placeholder="Select range" /></SelectTrigger>
                      <SelectContent>
                        {BUDGET_RANGES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label>Service Description</Label>
                  <Textarea {...register("serviceDetails")} rows={3} placeholder="Describe the service scope, deliverables, and expectations..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Audience</Label>
                  <Input {...register("targetAudience")} placeholder="Describe target audience" />
                </div>
              </div>
            )}

            <div className="space-y-1.5"><Label>Internal Notes</Label><Textarea {...register("notes")} placeholder="Internal notes, references, or anything the team should know..." rows={2} /></div>

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
