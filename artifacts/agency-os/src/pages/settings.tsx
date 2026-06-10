import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth, useTheme } from "@/App";
import { Building2, Bell, Palette, Shield, IndianRupee, Save } from "lucide-react";

interface AgencySettings {
  agencyName: string;
  tagline: string;
  gstin: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [reminderNotifs, setReminderNotifs] = useState(true);
  const [paymentNotifs, setPaymentNotifs] = useState(true);
  const [currency, setCurrency] = useState("INR");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  const { register, handleSubmit, formState: { isDirty } } = useForm<AgencySettings>({
    defaultValues: {
      agencyName: "Blink Beyond Agency",
      tagline: "Creative Marketing Solutions",
      gstin: "27AADCB2230M1ZT",
      pan: "AADCB2230M",
      email: "hello@blinkbeyond.com",
      phone: "+91 98765 43210",
      address: "2nd Floor, Creative Hub, MG Road, Bangalore - 560001",
      bankName: "HDFC Bank",
      accountNumber: "50100123456789",
      ifsc: "HDFC0001234",
      upiId: "blinkbeyond@hdfc",
    },
  });

  const onSave = (data: AgencySettings) => {
    toast.success("Agency settings saved");
    console.info("Saved settings:", data);
  };

  return (
    <div className="p-6 space-y-6 animated-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-heading">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage agency profile, billing info, and preferences</p>
      </div>

      {/* Agency Profile */}
      <form onSubmit={handleSubmit(onSave)}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Agency Profile
            </CardTitle>
            <CardDescription>Basic information shown on invoices and proposals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Agency Name</Label><Input {...register("agencyName")} /></div>
              <div className="space-y-1.5"><Label>Tagline</Label><Input {...register("tagline")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input {...register("email")} type="email" /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input {...register("phone")} /></div>
            </div>
            <div className="space-y-1.5"><Label>Office Address</Label><Textarea {...register("address")} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>GSTIN</Label><Input {...register("gstin")} placeholder="27AADCB2230M1ZT" /></div>
              <div className="space-y-1.5"><Label>PAN</Label><Input {...register("pan")} placeholder="AADCB2230M" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-primary" /> Banking & Payment Details
            </CardTitle>
            <CardDescription>Pre-filled on invoices for client reference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Bank Name</Label><Input {...register("bankName")} /></div>
              <div className="space-y-1.5"><Label>Account Number</Label><Input {...register("accountNumber")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>IFSC Code</Label><Input {...register("ifsc")} /></div>
              <div className="space-y-1.5"><Label>UPI ID</Label><Input {...register("upiId")} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button type="submit" className="gap-2 btn-micro-anim" data-testid="save-settings-btn">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </form>

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Light or dark appearance</p>
            </div>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">Used in invoices and pipeline</p>
            </div>
            <Select value={currency} onValueChange={(v) => setCurrency(v ?? "")}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ INR</SelectItem>
                <SelectItem value="USD">$ USD</SelectItem>
                <SelectItem value="EUR">€ EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Date Format</p>
              <p className="text-xs text-muted-foreground">How dates are displayed</p>
            </div>
            <Select value={dateFormat} onValueChange={(v) => setDateFormat(v ?? "")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Get updates sent to your email</p>
            </div>
            <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} data-testid="email-notif-toggle" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Task Reminders</p>
              <p className="text-xs text-muted-foreground">Reminders for overdue tasks</p>
            </div>
            <Switch checked={reminderNotifs} onCheckedChange={setReminderNotifs} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Payment Alerts</p>
              <p className="text-xs text-muted-foreground">Invoice due date notifications</p>
            </div>
            <Switch checked={paymentNotifs} onCheckedChange={setPaymentNotifs} />
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Logged in as</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium">{user?.systemRole?.replace("_", " ")}</span>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => toast.info("Password change email sent")} data-testid="change-password-btn">
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
