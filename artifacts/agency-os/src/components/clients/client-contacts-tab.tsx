import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, User, Mail, Phone, Trash2 } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

interface ClientContactsTabProps {
  contacts: Contact[];
  canEdit: boolean;
  isPending: boolean;
  onAddContact: (contactData: { name: string; role: string; email: string; phone: string; isPrimary: boolean }) => Promise<boolean>;
  onDeleteContact: (contactId: string) => void;
}

export function ClientContactsTab({
  contacts,
  canEdit,
  isPending,
  onAddContact,
  onDeleteContact,
}: ClientContactsTabProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    isPrimary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name) return;
    const success = await onAddContact(newContact);
    if (success) {
      setContactOpen(false);
      setNewContact({ name: "", role: "", email: "", phone: "", isPrimary: false });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-base text-foreground">Associated Contacts</h3>
          <p className="text-xs text-muted-foreground">Multiple department representatives</p>
        </div>

        {canEdit && (
          <Dialog open={contactOpen} onOpenChange={setContactOpen}>
            <DialogTrigger render={<Button size="sm" className="font-semibold text-xs" />}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Contact
            </DialogTrigger>
            <DialogContent className="max-w-md border bg-card/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle>Add Client Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Full Name *</Label>
                  <Input
                    id="c-name"
                    required
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    placeholder="e.g. Sarah Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-role">Role / Department</Label>
                  <Input
                    id="c-role"
                    value={newContact.role}
                    onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                    placeholder="e.g. Marketing Director"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-email">Email</Label>
                  <Input
                    id="c-email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="e.g. sarah@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Phone</Label>
                  <Input
                    id="c-phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="e.g. +91 99999 88888"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="c-primary"
                    checked={newContact.isPrimary}
                    onChange={(e) => setNewContact({ ...newContact, isPrimary: e.target.checked })}
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <Label htmlFor="c-primary" className="cursor-pointer">Set as Primary Client Contact</Label>
                </div>
                <Button type="submit" disabled={isPending} className="w-full mt-4 font-semibold">
                  {isPending ? "Adding..." : "Create Contact"}
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
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="font-semibold">Email</TableHead>
              <TableHead className="font-semibold">Phone</TableHead>
              <TableHead className="font-semibold">Primary</TableHead>
              {canEdit && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No contacts recorded. Add contacts to help coordinate campaigns.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-bold flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {c.name}
                  </TableCell>
                  <TableCell className="font-medium">{c.role || "—"}</TableCell>
                  <TableCell>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-primary hover:underline flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> {c.email}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="hover:text-primary flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> {c.phone}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.isPrimary ? (
                      <Badge variant="default" className="text-[10px] font-bold">Primary</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteContact(c.id)}
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
