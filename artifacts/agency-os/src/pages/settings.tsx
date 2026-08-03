import { useEffect } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import type { AgencySettingsUpdate } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useTheme } from "@/App";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Palette, ShieldAlert, BadgeIndianRupee, Sun, Moon,
  Shield, Plug, Bell, CheckCircle2, Lock, Key, Clock,
  Sparkles, Check
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { UserAccessManagement } from "@/components/UserAccessManagement";

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: settings, isLoading } = useGetSettings();

  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";

  const updateMutation = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        toast.success("Settings updated successfully");
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to update settings");
      },
    },
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AgencySettingsUpdate>();

  useEffect(() => {
    if (settings) {
      reset({
        agencyName: settings.agencyName,
        email: settings.email ?? "",
        phone: settings.phone ?? "",
        address: settings.address ?? "",
        website: settings.website ?? "",
        primaryColor: settings.primaryColor ?? "#6366f1",
        currency: settings.currency ?? "INR",
        taxLabel: settings.taxLabel ?? "GST",
        taxPercent: settings.taxPercent ?? 18,
        workDayStart: settings.workDayStart ?? "09:00",
        workDayEnd: settings.workDayEnd ?? "18:00",
      });
    }
  }, [settings, reset]);

  const onSubmit = (data: AgencySettingsUpdate) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can update settings");
      return;
    }
    // Convert taxPercent to number
    if (data.taxPercent !== undefined) {
      data.taxPercent = Number(data.taxPercent);
    }
    updateMutation.mutate({ data });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animated-fade-in">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure agency credentials, brand aesthetic, tax rules, and operational integrations
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="lg:col-span-9">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="general" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Vertical Navigation Sidebar */}
            <div className="lg:col-span-3 w-full shrink-0 space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 hidden lg:block">
                Settings Menu
              </div>
              <TabsList className="flex flex-row lg:flex-col h-auto w-full bg-card border border-border/80 rounded-xl p-1.5 shrink-0 space-y-0 lg:space-y-1 overflow-x-auto lg:overflow-x-visible justify-start gap-1 lg:gap-0 scrollbar-none shadow-2xs">
                
                <TabsTrigger
                  value="general"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-general"
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">General</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Profile & work schedule</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">General</span>
                </TabsTrigger>

                <TabsTrigger
                  value="branding"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-branding"
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">Branding & Theme</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Colors, logo & dark mode</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">Branding</span>
                </TabsTrigger>

                <TabsTrigger
                  value="financials"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-financials"
                >
                  <BadgeIndianRupee className="h-4 w-4 shrink-0" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">Taxes & Currency</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Default GST & currencies</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">Taxes & Currency</span>
                </TabsTrigger>

                <TabsTrigger
                  value="security"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-security"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">Security & Access</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Session rules & permissions</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">Security</span>
                </TabsTrigger>

                <TabsTrigger
                  value="integrations"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-integrations"
                >
                  <Plug className="h-4 w-4 shrink-0" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">Integrations</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Social API & AI Copilot</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">Integrations</span>
                </TabsTrigger>

                <TabsTrigger
                  value="access"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-user-access"
                >
                  <Shield className="h-4 w-4 shrink-0 text-amber-500" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">User Access Management</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Delegated admin & permissions</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">User Access</span>
                </TabsTrigger>

                <TabsTrigger
                  value="notifications"
                  className="justify-start gap-3 px-3 py-2.5 w-full text-left rounded-lg text-xs lg:text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs hover:bg-muted/60"
                  data-testid="tab-notifications"
                >
                  <Bell className="h-4 w-4 shrink-0" />
                  <div className="hidden lg:block text-left truncate">
                    <div className="font-semibold text-xs leading-none">Notifications</div>
                    <div className="text-[10px] opacity-80 font-normal mt-1 truncate">Alert preferences</div>
                  </div>
                  <span className="lg:hidden whitespace-nowrap">Notifications</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Selected Content Area */}
            <div className="lg:col-span-9 w-full min-w-0 space-y-6">

              {/* General Section */}
              <TabsContent value="general" className="mt-0 space-y-6">
                <Card className="shadow-xs border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" /> Agency Profile & Details
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Update your primary contact information, business address, and standard operating hours.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Agency Name *</Label>
                        <Input
                          {...register("agencyName", { required: "Required" })}
                          disabled={!isSuperAdmin}
                          placeholder="Blink Beyond"
                          data-testid="agency-name-input"
                          className="h-10"
                        />
                        {errors.agencyName && <p className="text-xs text-destructive">{errors.agencyName.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Website URL</Label>
                        <Input
                          {...register("website")}
                          disabled={!isSuperAdmin}
                          placeholder="https://blinkbeyond.com"
                          data-testid="agency-website-input"
                          className="h-10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Contact Email</Label>
                        <Input
                          {...register("email")}
                          disabled={!isSuperAdmin}
                          type="email"
                          placeholder="hello@blinkbeyond.com"
                          data-testid="agency-email-input"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Contact Phone</Label>
                        <Input
                          {...register("phone")}
                          disabled={!isSuperAdmin}
                          placeholder="+91 98765 43210"
                          data-testid="agency-phone-input"
                          className="h-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Business Address</Label>
                      <Input
                        {...register("address")}
                        disabled={!isSuperAdmin}
                        placeholder="123 Creative Studio, Bangalore, India"
                        data-testid="agency-address-input"
                        className="h-10"
                      />
                    </div>

                    <div className="border-t border-border pt-6 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating Schedule</h4>
                        <p className="text-xs text-muted-foreground">Set standard daily work hours for check-ins and task SLA calculations.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Work Day Start Time</Label>
                          <Input
                            {...register("workDayStart")}
                            disabled={!isSuperAdmin}
                            type="time"
                            data-testid="agency-work-start"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Work Day End Time</Label>
                          <Input
                            {...register("workDayEnd")}
                            disabled={!isSuperAdmin}
                            type="time"
                            data-testid="agency-work-end"
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Branding Section */}
              <TabsContent value="branding" className="mt-0 space-y-6">
                <Card className="shadow-xs border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" /> Branding & System Theme
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Customize theme palettes, primary brand colors, and workspace visual marks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Brand Color Picker */}
                    <div className="space-y-3">
                      <Label className="text-xs font-medium">Brand Accent Color</Label>
                      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
                        <Input
                          {...register("primaryColor")}
                          disabled={!isSuperAdmin}
                          type="color"
                          className="w-12 h-10 p-1 border rounded-lg cursor-pointer shrink-0"
                          data-testid="agency-color-picker"
                        />
                        <Controller
                          control={control}
                          name="primaryColor"
                          render={({ field }) => (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium bg-background px-2.5 py-1 rounded-md border text-muted-foreground">
                                {field.value || "#6366f1"}
                              </span>
                              <div className="flex gap-2 ml-2">
                                {["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"].map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    disabled={!isSuperAdmin}
                                    onClick={() => field.onChange(color)}
                                    className={`w-7 h-7 rounded-full border border-border transition-all hover:scale-110 flex items-center justify-center ${field.value === color ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                    style={{ backgroundColor: color }}
                                  >
                                    {field.value === color && <Check className="h-3 w-3 text-white drop-shadow-xs" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    {/* Dark/Light Mode */}
                    <div className="border-t border-border pt-6 space-y-3">
                      <div>
                        <Label className="text-xs font-medium">Workspace Theme Mode</Label>
                        <p className="text-xs text-muted-foreground">Switch between light and dark high-contrast dashboard interfaces.</p>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <Button
                          type="button"
                          variant={theme === "light" ? "default" : "outline"}
                          onClick={theme === "dark" ? toggleTheme : undefined}
                          className="gap-2 h-9 px-4"
                          data-testid="light-theme-btn"
                        >
                          <Sun className="h-4 w-4 text-amber-500" /> Light Theme
                        </Button>
                        <Button
                          type="button"
                          variant={theme === "dark" ? "default" : "outline"}
                          onClick={theme === "light" ? toggleTheme : undefined}
                          className="gap-2 h-9 px-4"
                          data-testid="dark-theme-btn"
                        >
                          <Moon className="h-4 w-4 text-indigo-400" /> Dark Theme
                        </Button>
                      </div>
                    </div>

                    {/* Agency Logo Asset */}
                    <div className="border-t border-border pt-6 space-y-3">
                      <Label className="text-xs font-medium">Official Agency Logo Mark</Label>
                      <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/20">
                        <CompanyLogo variant="sidebar" size={48} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Blink Beyond Vector Mark</p>
                          <p className="text-xs text-muted-foreground">Used across Navigation Sidebar, Quotations, Invoices & Login Screen</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financials Section */}
              <TabsContent value="financials" className="mt-0 space-y-6">
                <Card className="shadow-xs border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BadgeIndianRupee className="h-4 w-4 text-primary" /> Taxes & Billing Currency
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Set system-wide currency, tax labels, and default percentage rates for invoices and proposals.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Primary Billing Currency</Label>
                        <Controller
                          control={control}
                          name="currency"
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={!isSuperAdmin}
                            >
                              <SelectTrigger data-testid="agency-currency-select" className="h-10">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INR">INR (₹ - Indian Rupee)</SelectItem>
                                <SelectItem value="USD">USD ($ - US Dollar)</SelectItem>
                                <SelectItem value="AED">AED (Dh - UAE Dirham)</SelectItem>
                                <SelectItem value="GBP">GBP (£ - British Pound)</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Tax Label</Label>
                          <Input
                            {...register("taxLabel")}
                            disabled={!isSuperAdmin}
                            placeholder="GST"
                            data-testid="agency-tax-label"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Tax Percent (%)</Label>
                          <Input
                            {...register("taxPercent")}
                            disabled={!isSuperAdmin}
                            type="number"
                            placeholder="18"
                            data-testid="agency-tax-percent"
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                        <BadgeIndianRupee className="h-4 w-4 shrink-0" /> Tax Compliance Summary
                      </p>
                      <p className="text-amber-700/90 dark:text-amber-300/80">
                        All newly generated invoices automatically calculate CGST + SGST or IGST based on these settings. Tax percentage can be modified per invoice during draft creation.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Section */}
              <TabsContent value="security" className="mt-0 space-y-6">
                <Card className="shadow-xs border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" /> Security & Access Controls
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manage session timeouts, authentication protocols, and workspace access restrictions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Session Inactivity Timeout (minutes)</Label>
                        <Input
                          type="number"
                          defaultValue={60}
                          disabled={!isSuperAdmin}
                          className="h-10"
                        />
                        <p className="text-[11px] text-muted-foreground">Auto logout after inactivity (15–1440 min)</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Daily Attendance Cutoff (24h)</Label>
                        <Input
                          type="time"
                          defaultValue="10:30"
                          disabled={!isSuperAdmin}
                          className="h-10"
                        />
                        <p className="text-[11px] text-muted-foreground">Check-ins after this time are tagged as Late</p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access Control Status</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-emerald-500" /> Role-Based Access (RBAC)</span>
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40">Enforced</Badge>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-2"><Key className="h-3.5 w-3.5 text-indigo-500" /> JWT Token Expiry</span>
                          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40">24 Hours</Badge>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-blue-500" /> Audit Logging</span>
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40">Active</Badge>
                        </div>
                        <div className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-amber-500" /> Database Fallback Mode</span>
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-950/40">Disabled (Supabase)</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integrations Section */}
              <TabsContent value="integrations" className="mt-0 space-y-6">
                <Card className="shadow-xs border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Plug className="h-4 w-4 text-primary" /> Third-Party Integrations & API Keys
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Manage external API tokens for social publishing and AI content generation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Ayrshare Card */}
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-violet-500" />
                          <h4 className="text-sm font-semibold">Ayrshare Social Publishing API</h4>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Configured
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Powers direct 1-click publishing to Instagram, YouTube, LinkedIn, and Facebook from the Content Calendar.
                      </p>
                    </div>

                    {/* AI Copilot Keys */}
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-indigo-500" />
                          <h4 className="text-sm font-semibold">AI Template Copilot (Gemini & Groq)</h4>
                        </div>
                        <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 border-indigo-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Server Active
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Generates AI draft contracts, proposals, and content captions using Gemini 2.5 Flash and Groq models.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Section */}
              <TabsContent value="notifications" className="mt-0 space-y-6">
                <Card className="shadow-xs border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" /> Notification Triggers
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Choose which system activities generate real-time alerts in your notification center.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "New Lead Assignment", desc: "Alert when a new lead is assigned to your account", enabled: true },
                      { label: "Invoice Past Due", desc: "Send warning when unpaid invoices pass deadline", enabled: true },
                      { label: "Content Approval Request", desc: "Notify when draft post is waiting for review", enabled: true },
                      { label: "Project Milestone Due", desc: "Alert 3 days before project deadline", enabled: true },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={item.enabled}
                          disabled={!isSuperAdmin}
                          className="h-4 w-4 rounded border-input text-primary accent-primary cursor-pointer"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* User Access Management Section */}
              <TabsContent value="access" className="mt-0 space-y-6">
                <UserAccessManagement />
              </TabsContent>

            </div>
          </Tabs>

          {/* Form Submit Footer */}
          {isSuperAdmin ? (
            <div className="flex justify-end gap-3 border-t border-border pt-6">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-micro-anim px-8 h-10 font-medium"
                data-testid="save-settings-btn"
              >
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 flex gap-3 items-center">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                You are viewing system settings in read-only mode. Only system Administrators (Super Admin) can update agency configurations.
              </p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

