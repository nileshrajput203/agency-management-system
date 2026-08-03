"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateLeadStage } from "@/lib/actions/leads";
import { FUNNEL_STAGES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadCaptureDialog } from "@/components/sales/lead-capture-dialog";

type Lead = {
  id: string;
  title: string;
  companyName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  value: number | null;
  stage: string;
  lostReason: string | null;
  followUpAt: Date | string | null;
  owner?: { id?: string; name: string } | null;
  ownerId?: string | null;
};

type Owner = { id: string; name: string };

export function SalesManager({
  leads,
  owners,
  canManage,
}: {
  leads: Lead[];
  owners: Owner[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  const byStage = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.key),
  }));

  async function moveStage(id: string, stage: string) {
    const r = await updateLeadStage(id, stage);
    if (r.ok) toast.success("Stage updated");
    else toast.error(r.error);
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add lead
          </Button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {byStage.map((col) => (
          <Card key={col.key} className="min-w-[240px] shrink-0">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex justify-between">
                {col.label}
                <span className="font-normal text-muted-foreground">{col.leads.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {col.leads.map((lead) => (
                <div key={lead.id} className="rounded-md border bg-card p-3 text-sm">
                  <p className="font-medium">{lead.title}</p>
                  <p className="text-xs text-muted-foreground">{lead.companyName ?? "—"}</p>
                  {lead.value != null && (
                    <p className="text-xs mt-1 font-medium">
                      ₹{Math.round(lead.value).toLocaleString("en-IN")}
                    </p>
                  )}
                  {canManage && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditLead(lead)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <select
                        className="text-[10px] border rounded px-1 h-7"
                        value={lead.stage}
                        onChange={(e) => void moveStage(lead.id, e.target.value)}
                      >
                        {FUNNEL_STAGES.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Lead Dialog */}
      <LeadCaptureDialog
        open={open}
        onOpenChange={setOpen}
        owners={owners}
      />

      {/* Edit Lead Dialog */}
      <LeadCaptureDialog
        open={!!editLead}
        onOpenChange={(v) => !v && setEditLead(null)}
        lead={editLead}
        owners={owners}
        onSuccess={() => setEditLead(null)}
      />
    </div>
  );
}
