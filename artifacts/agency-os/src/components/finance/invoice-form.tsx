"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createInvoice as createInv } from "@/lib/actions/invoices";
import type { ActionResult } from "@/lib/validations";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: ActionResult = { ok: false, error: "" };

export function InvoiceForm({
  clients,
  onSuccess,
  prefill,
}: {
  clients: { id: string; companyName: string }[];
  onSuccess: () => void;
  prefill?: { lineDescription: string; subtotal: number; gstRate: number; dueDate: string };
}) {
  const [state, formAction] = useActionState(createInv, initial);
  useEffect(() => {
    if (state.ok) { onSuccess(); toast.success("Invoice created"); }
    else if (!state.ok && state.error) toast.error(state.error);
  }, [state, onSuccess]);
  return (
    <form action={formAction} className="space-y-4" key={JSON.stringify(prefill)}>
      <div className="space-y-2"><Label>Client *</Label>
        <select name="clientId" required className="flex h-9 w-full rounded-md border px-3 text-sm bg-background">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </select>
      </div>
      <div className="space-y-2"><Label>Description</Label><Input name="lineDescription" defaultValue={prefill?.lineDescription || "Professional services"} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Amount ₹</Label><Input name="subtotal" type="number" required defaultValue={prefill?.subtotal ?? ""} /></div>
        <div className="space-y-2"><Label>GST %</Label><Input name="gstRate" type="number" defaultValue={prefill?.gstRate ?? 18} /></div>
      </div>
      <div className="space-y-2"><Label>Due date</Label><Input name="dueDate" type="date" defaultValue={prefill?.dueDate || ""} /></div>
      <input type="hidden" name="status" value="SENT" />
      <input type="hidden" name="currency" value="INR" />
      <SubmitButton label="Create invoice" />
    </form>
  );
}
