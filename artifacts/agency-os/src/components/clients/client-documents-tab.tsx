import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileDown, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";

type Document = {
  id: string;
  name: string;
  fileUrl: string;
  type: string | null;
  createdAt: Date;
};

interface ClientDocumentsTabProps {
  documents: Document[];
  canEdit: boolean;
  isPending: boolean;
  onAddDoc: (docData: { name: string; fileUrl: string; type: string }) => Promise<boolean>;
  onDeleteDoc: (docId: string) => void;
}

export function ClientDocumentsTab({
  documents,
  canEdit,
  isPending,
  onAddDoc,
  onDeleteDoc,
}: ClientDocumentsTabProps) {
  const [docOpen, setDocOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({
    name: "",
    fileUrl: "",
    type: "Contract",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.name || !newDoc.fileUrl) return;
    const success = await onAddDoc(newDoc);
    if (success) {
      setDocOpen(false);
      setNewDoc({ name: "", fileUrl: "", type: "Contract" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-base text-foreground">Client Document Manager</h3>
          <p className="text-xs text-muted-foreground">Store agreements, requirements briefing files, credentials and branding PDFs</p>
        </div>

        {canEdit && (
          <Dialog open={docOpen} onOpenChange={setDocOpen}>
            <DialogTrigger render={<Button size="sm" className="font-semibold text-xs" />}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Document
            </DialogTrigger>
            <DialogContent className="max-w-md border bg-card/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle>Store Client Document</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="d-name">Document Name *</Label>
                  <Input
                    id="d-name"
                    required
                    value={newDoc.name}
                    onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                    placeholder="e.g. Website Branding Guidelines"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-url">File Link (Mock Upload) *</Label>
                  <Input
                    id="d-url"
                    required
                    value={newDoc.fileUrl}
                    onChange={(e) => setNewDoc({ ...newDoc, fileUrl: e.target.value })}
                    placeholder="e.g. https://drive.google.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d-type">Document Classification</Label>
                  <select
                    id="d-type"
                    value={newDoc.type}
                    onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
                  >
                    <option value="Contract">Agreement/Contract</option>
                    <option value="Branding">Branding Asset</option>
                    <option value="Briefing">Briefing Document</option>
                    <option value="Receipt">Invoice/Receipt</option>
                  </select>
                </div>
                <Button type="submit" disabled={isPending} className="w-full mt-4 font-semibold">
                  {isPending ? "Saving..." : "Save Document Link"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border bg-card/65 backdrop-blur overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/15">
            <TableRow>
              <TableHead className="font-semibold">Document Name</TableHead>
              <TableHead className="font-semibold">Classification</TableHead>
              <TableHead className="font-semibold">Added On</TableHead>
              <TableHead className="font-semibold">View File</TableHead>
              {canEdit && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No documents uploaded. Add contracts or asset link logs here.
                </TableCell>
              </TableRow>
            ) : (
              documents.map((d) => (
                <TableRow key={d.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-bold flex items-center gap-2">
                    <FileDown className="h-4 w-4 text-primary" />
                    {d.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{d.type || "Other"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(d.createdAt), "PPP")}
                  </TableCell>
                  <TableCell>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      Launch link <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteDoc(d.id)}
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
