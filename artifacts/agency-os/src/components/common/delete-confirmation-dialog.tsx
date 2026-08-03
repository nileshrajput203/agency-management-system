import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle, Trash2 } from "lucide-react";

export interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  itemType?: string;
  isPrivileged: boolean;
  onConfirm: (scope: "me" | "everyone") => Promise<void> | void;
  isLoading?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  title,
  itemType = "Item",
  isPrivileged,
  onConfirm,
  isLoading = false,
}: DeleteConfirmationDialogProps) {
  const [selectedScope, setSelectedScope] = useState<"me" | "everyone">("me");

  const handleConfirm = async () => {
    const scopeToUse = isPrivileged ? selectedScope : "me";
    await onConfirm(scopeToUse);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            {title || `Delete ${itemType}`}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {isPrivileged
              ? "What would you like to do?"
              : `This ${itemType.toLowerCase()} will be removed from your workspace. The record will remain intact for company administration.`}
          </DialogDescription>
        </DialogHeader>

        {isPrivileged ? (
          <div className="py-2">
            <RadioGroup
              value={selectedScope}
              onValueChange={(val) => setSelectedScope(val as "me" | "everyone")}
              className="space-y-3"
            >
              <div
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedScope === "me"
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedScope("me")}
              >
                <RadioGroupItem value="me" id="delete-me" className="mt-1" />
                <div className="grid gap-1">
                  <Label htmlFor="delete-me" className="font-semibold cursor-pointer">
                    Delete for Me
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Removes this {itemType.toLowerCase()} only from your dashboard. Employees and other users still keep the item. Database record remains.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedScope === "everyone"
                    ? "border-red-500 bg-red-500/5 dark:bg-red-500/10"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedScope("everyone")}
              >
                <RadioGroupItem value="everyone" id="delete-everyone" className="mt-1" />
                <div className="grid gap-1">
                  <Label htmlFor="delete-everyone" className="font-semibold text-red-600 dark:text-red-400 cursor-pointer">
                    Delete for Everyone
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Completely removes the record from the system. Visible to nobody. Performs actual database deletion.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 my-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              As an employee, you can only choose "Delete for Me". This removes the {itemType.toLowerCase()} from your workspace without permanently removing company records.
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isPrivileged && selectedScope === "everyone" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? "Deleting..."
              : isPrivileged
              ? selectedScope === "everyone"
                ? "Delete for Everyone"
                : "Delete for Me"
              : "Delete for Me"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
