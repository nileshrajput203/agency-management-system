import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  name: string;
  systemRole?: string;
}

interface MultiAssigneePickerProps {
  users: User[];
  value: string[];           // array of user IDs
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function MultiAssigneePicker({
  users,
  value,
  onChange,
  label = "Additional Assignees",
  placeholder = "Select team members…",
  className,
}: MultiAssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  const selected = users.filter((u) => value.includes(u.id));

  return (
    <div className={cn("space-y-1.5", className)} ref={ref}>
      {label && (
        <Label className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </Label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "hover:bg-accent/40 transition-colors",
          open && "ring-2 ring-ring",
        )}
      >
        <span className={cn("flex items-center gap-1 flex-wrap flex-1 min-w-0", selected.length === 0 && "text-muted-foreground")}>
          {selected.length === 0 ? (
            placeholder
          ) : (
            selected.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full font-medium"
              >
                {u.name.split(" ")[0]}
                <button
                  type="button"
                  onMouseDown={(e) => { e.stopPropagation(); toggle(u.id); }}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform ml-1", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] max-w-[320px] rounded-md border bg-popover shadow-md overflow-hidden">
          <div className="max-h-48 overflow-y-auto p-1">
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">No users available</p>
            ) : (
              users.map((u) => {
                const checked = value.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      checked && "bg-primary/5",
                    )}
                  >
                    <div className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}>
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1 text-left truncate">{u.name}</span>
                    {u.systemRole && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{u.systemRole}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
