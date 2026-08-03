"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createProposal } from "@/lib/actions/proposals";
import type { ActionResult } from "@/lib/validations";
import { PROPOSAL_TEMPLATES } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";

const initial: ActionResult = { ok: false, error: "" };

export function ProposalForm({
  clients,
  onSuccess,
  prefill,
}: {
  clients: { id: string; companyName: string }[];
  onSuccess: () => void;
  prefill?: { title: string; subtotal: number; discount: number; templateKey: string };
}) {
  const [state, formAction] = useActionState(createProposal, initial);
  useEffect(() => {
    if (state.ok) { onSuccess(); toast.success("Proposal created"); }
    else if (!state.ok && state.error) toast.error(state.error);
  }, [state, onSuccess]);
  return (
    <form action={formAction} className="space-y-4" key={JSON.stringify(prefill)}>
      <div className="space-y-2"><Label>Client *</Label>
        <select name="clientId" required className="flex h-9 w-full rounded-md border px-3 text-sm bg-background">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </select>
      </div>
      <div className="space-y-2"><Label>Title *</Label><Input name="title" required defaultValue={prefill?.title || ""} /></div>
      <div className="space-y-2"><Label>Template</Label>
        <select name="templateKey" className="flex h-9 w-full rounded-md border px-3 text-sm bg-background" defaultValue={prefill?.templateKey || "website"}>
          {PROPOSAL_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Subtotal ₹</Label><Input name="subtotal" type="number" required defaultValue={prefill?.subtotal ?? 0} /></div>
        <div className="space-y-2"><Label>Discount ₹</Label><Input name="discount" type="number" defaultValue={prefill?.discount ?? 0} /></div>
      </div>
      <input type="hidden" name="status" value="DRAFT" />
      <SubmitButton label="Create proposal" />
    </form>
  );
}
