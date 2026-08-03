import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvoiceData, ClientData } from "./client-dashboard-types";
import { printInvoice } from "./client-print-utils";

export function ClientBillingTab({ invoices, client }: { invoices: InvoiceData[]; client: ClientData }) {
  return (
    <Card className="bg-slate-900/40 border-slate-800 text-white">
      <CardHeader><CardTitle className="text-md">Invoices & Receipts</CardTitle></CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">No invoices generated.</p>
        ) : (
          <Table className="border-slate-800">
            <TableHeader className="bg-slate-950/50">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Invoice Number</TableHead>
                <TableHead className="text-slate-400">Due Date</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Amount</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-900/20">
                  <TableCell className="font-medium text-slate-200">{inv.number}</TableCell>
                  <TableCell className="text-slate-300">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.status === "PAID" ? "default" : "outline"} className={inv.status === "PAID" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "border-slate-800 text-slate-400"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-200 font-medium">₹{inv.total.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Button size="xs" variant="ghost" onClick={() => printInvoice(inv, client)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
