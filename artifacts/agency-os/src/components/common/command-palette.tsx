import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Film,
  Users,
  CheckSquare,
  DollarSign,
  FileText,
  Calendar,
  Clock,
  Settings,
  Sparkles,
  TrendingUp,
  FolderKanban,
  Receipt,
  FileCheck2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/App";

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const isEmployee = user?.portalMode === "MODE_2" || user?.role === "TEAM_MEMBER" || user?.role === "EMPLOYEE";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or jump to page... (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>No matching pages or actions found.</CommandEmpty>

        <CommandGroup heading="Quick Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/dashboard" : "/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
            <span>Dashboard</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/content-calendar" : "/content"))}>
            <Film className="mr-2 h-4 w-4 text-rose-500" />
            <span>PC Approval & Production Studio</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/tasks" : "/tasks"))}>
            <CheckSquare className="mr-2 h-4 w-4 text-amber-500" />
            <span>Tasks & Daily Operations</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/clients" : "/clients"))}>
            <Users className="mr-2 h-4 w-4 text-blue-500" />
            <span>Clients & Brands</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/projects" : "/projects"))}>
            <FolderKanban className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Projects & Deliverables</span>
          </CommandItem>

          {!isEmployee && (
            <>
              <CommandItem onSelect={() => runCommand(() => navigate("/sales"))}>
                <TrendingUp className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Sales Pipeline & Won Leads</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate("/invoices"))}>
                <Receipt className="mr-2 h-4 w-4 text-teal-500" />
                <span>Invoices & Billing</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate("/quotations"))}>
                <FileCheck2 className="mr-2 h-4 w-4 text-orange-500" />
                <span>Quotations & Estimates</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate("/proposals"))}>
                <FileText className="mr-2 h-4 w-4 text-violet-500" />
                <span>Proposals & Markups</span>
              </CommandItem>

              <CommandItem onSelect={() => runCommand(() => navigate("/payroll"))}>
                <Wallet className="mr-2 h-4 w-4 text-yellow-500" />
                <span>Payroll & Salary Register</span>
              </CommandItem>
            </>
          )}

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/work-reports" : "/work-reports"))}>
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            <span>Work Reports & Daily Accomplishments</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/attendance" : "/attendance"))}>
            <Clock className="mr-2 h-4 w-4 text-cyan-500" />
            <span>Attendance & Punch In/Out</span>
          </CommandItem>

          <CommandItem onSelect={() => runCommand(() => navigate(isEmployee ? "/employee/leave" : "/leaves"))}>
            <Calendar className="mr-2 h-4 w-4 text-rose-400" />
            <span>Leave Requests & Balances</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings & Admin">
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Agency & Workspace Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
