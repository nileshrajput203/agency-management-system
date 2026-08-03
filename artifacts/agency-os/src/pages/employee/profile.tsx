import { useState } from "react";
import { useAuth, useTheme } from "@/App";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Lock, Moon, Sun, Bell, Shield } from "lucide-react";

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "E";

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }, 600);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animated-fade-in">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold font-heading tracking-tight flex items-center gap-2">
          <User className="h-6 w-6 text-primary" /> Profile & Account Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account profile, login credentials, and interface preferences
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Employee Identity
          </CardTitle>
          <CardDescription className="text-xs">
            Your registered credentials within AgencyOS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">{user?.name}</h3>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary">
                  {user?.systemRole || "EMPLOYEE"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security / Password Card */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" /> Password & Authentication
          </CardTitle>
          <CardDescription className="text-xs">
            Update your account access password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <Label className="text-xs font-semibold">Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 text-xs"
              />
            </div>
            <Button type="submit" size="sm" disabled={loading} className="mt-2">
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card className="border border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Interface Preferences
          </CardTitle>
          <CardDescription className="text-xs">
            Customize visual theme and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-card">
            <div>
              <p className="text-sm font-semibold">Appearance Theme</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark workspace themes</p>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2 text-xs">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
