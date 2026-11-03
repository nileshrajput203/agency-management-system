import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  Building2,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Receipt,
  Calendar,
  Clock,
  Sparkles,
  Users,
  Film,
  Wallet,
  ArrowRight,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigateTo = (path: string) => {
    setOpen(false);
    setQuery("");
    setLocation(path);
  };

  const quickActions = [
    { label: "New Task", icon: <CheckSquare className="h-4 w-4 text-purple-500" />, path: "/tasks?create=true" },
    { label: "New Client", icon: <Building2 className="h-4 w-4 text-blue-500" />, path: "/clients?create=true" },
    { label: "New Lead", icon: <TrendingUp className="h-4 w-4 text-pink-500" />, path: "/sales?create=true" },
    { label: "Create Invoice", icon: <Receipt className="h-4 w-4 text-emerald-500" />, path: "/invoices?create=true" },
    { label: "Content Calendar", icon: <Calendar className="h-4 w-4 text-amber-500" />, path: "/content" },
    { label: "Production Shoots", icon: <Film className="h-4 w-4 text-rose-500" />, path: "/content?tab=shoots" },
    { label: "Vendors & Creators", icon: <Users className="h-4 w-4 text-indigo-500" />, path: "/vendors" },
    { label: "Payroll & Salaries", icon: <Wallet className="h-4 w-4 text-teal-500" />, path: "/payroll" },
    { label: "Check In / Out", icon: <Clock className="h-4 w-4 text-orange-500" />, path: "/attendance" },
    { label: "Auto-Fill Work Report", icon: <Sparkles className="h-4 w-4 text-yellow-500" />, path: "/work-reports" },
  ];

  const navigationPages = [
    { label: "Dashboard", category: "Core", path: "/dashboard" },
    { label: "Clients & CRM", category: "CRM", path: "/clients" },
    { label: "Sales Pipeline & Leads", category: "Sales", path: "/sales" },
    { label: "Projects Portfolio", category: "Operations", path: "/projects" },
    { label: "Tasks & Board", category: "Operations", path: "/tasks" },
    { label: "Content Studio", category: "Creative", path: "/content" },
    { label: "Invoices & GST", category: "Finance", path: "/invoices" },
    { label: "Quotations", category: "Finance", path: "/quotations" },
    { label: "Proposals & Pitches", category: "Finance", path: "/proposals" },
    { label: "Purchase Orders", category: "Finance", path: "/purchase-orders" },
    { label: "Expenses & Reimbursements", category: "Finance", path: "/expenses" },
    { label: "Team & Roles", category: "HR", path: "/users" },
    { label: "Attendance & Time", category: "HR", path: "/attendance" },
    { label: "Leave Requests", category: "HR", path: "/leaves" },
    { label: "Work Reports", category: "HR", path: "/work-reports" },
    { label: "Monthly Performance", category: "HR", path: "/performance-report" },
    { label: "Agency Settings", category: "Settings", path: "/settings" },
  ];

  const filteredPages = navigationPages.filter(p =>
    p.label.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );

  const filteredActions = quickActions.filter(a =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden shadow-2xl border-border bg-card/95 backdrop-blur-md">
        <div className="flex items-center px-4 py-3 border-b border-border/60">
          <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, page name, or action... (e.g. Invoices, Tasks, Shoots)"
            className="border-0 focus-visible:ring-0 shadow-none px-0 text-base bg-transparent h-9 placeholder:text-muted-foreground/60"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground ml-2">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-3 space-y-4 text-sm">
          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {filteredActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigateTo(action.path)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors text-left text-foreground font-medium group cursor-pointer"
                  >
                    {action.icon}
                    <span className="truncate group-hover:text-primary transition-colors">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Pages */}
          {filteredPages.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                Go to Workspace
              </div>
              <div className="space-y-1">
                {filteredPages.slice(0, 8).map((page) => (
                  <button
                    key={page.path}
                    onClick={() => navigateTo(page.path)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/60 transition-colors text-left text-foreground font-medium group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      <span>{page.label}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded font-mono">
                      {page.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredActions.length === 0 && filteredPages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No matching commands or pages found.
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-4 py-2 bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>Navigation: <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd></span>
            <span>Close: <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd></span>
          </div>
          <span className="font-semibold text-primary">BlinkBeyond OS</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

