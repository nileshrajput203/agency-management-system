import { FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AgreementData, ProposalData } from "./client-dashboard-types";

export function ClientDocumentsTab({
  agreements,
  proposals,
  onSelectAgreement,
}: {
  agreements: AgreementData[];
  proposals: ProposalData[];
  onSelectAgreement: (agreement: AgreementData) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Agreements */}
      <Card className="bg-slate-900/40 border-slate-800 text-white">
        <CardHeader><CardTitle className="text-md">Contracts & Agreements</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {agreements.length === 0 ? (
            <p className="text-sm text-slate-400">No agreement documents listed.</p>
          ) : (
            agreements.map((a) => (
              <div key={a.id} className="flex justify-between items-center border border-slate-800/80 bg-slate-950/60 p-3 rounded-lg text-sm">
                <div>
                  <p className="font-semibold text-slate-200">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {a.signedAt ? `Signed on ${new Date(a.signedAt).toLocaleDateString()}` : "Pending Signature"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900" onClick={() => onSelectAgreement(a)}>
                    <FileSignature className="h-3.5 w-3.5 mr-1" />
                    {a.status === "SIGNED" ? "View Completed" : "Review & Sign"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Proposals */}
      <Card className="bg-slate-900/40 border-slate-800 text-white">
        <CardHeader><CardTitle className="text-md">Proposals</CardTitle></CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <p className="text-sm text-slate-400">No proposals available.</p>
          ) : (
            <Table className="border-slate-800">
              <TableHeader className="bg-slate-950/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Proposal</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => (
                  <TableRow key={p.id} className="border-slate-800 hover:bg-slate-900/20">
                    <TableCell className="font-medium text-slate-200">{p.title}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "APPROVED" ? "default" : "outline"} className={p.status === "APPROVED" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "border-slate-800 text-slate-400"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-200 font-medium">₹{p.total.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
