"use client";

import { useEffect, useState } from "react";
import { Plus, Download, Sparkles, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { updateProposalStatus } from "@/lib/actions/proposals";
import { markInvoicePaid as markPaid } from "@/lib/actions/invoices";
import { updateAgreementContent, signAgreement, updateAgreementStatus } from "@/lib/actions/agreements";
import { generateAIClause } from "@/lib/actions/ai-generator";
import { ENABLE_PROPOSALS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ProposalForm } from "./proposal-form";
import { InvoiceForm } from "./invoice-form";
import { FinanceAiCopilotDialog } from "./finance-ai-copilot-dialog";
import { FinanceAgreementDialog } from "./finance-agreement-dialog";
import { printInvoice } from "./finance-print-utils";

export function FinanceManager({
  proposals,
  invoices,
  agreements,
  clients,
  canManage,
}: {
  proposals: { id: string; title: string; status: string; total: number; client: { companyName: string } }[];
  invoices: { id: string; number: string; status: string; total: number; subtotal: number; gstRate: number; gstAmount: number; dueDate: Date | null; createdAt: Date; currency?: string; client: { companyName: string; email?: string | null; billingAddress?: string | null; gstin?: string | null } }[];
  agreements: { id: string; title: string; status: string; content: string; client: { companyName: string }; signedAt: Date | null }[];
  clients: { id: string; companyName: string }[];
  canManage: boolean;
}) {
  const [propOpen, setPropOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<typeof agreements[0] | null>(null);
  const [agreementContent, setAgreementContent] = useState("");
  const [signName, setSignName] = useState("");
  const [isListening, setIsListening] = useState(false);

  // AI template drafter states
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<"gemini" | "groq" | "openrouter" | "local">("local");
  const [aiApiKey, setAiApiKey] = useState("");

  // Prefill states
  const [prefilledProposal, setPrefilledProposal] = useState<{ title: string; subtotal: number; discount: number; templateKey: string } | null>(null);
  const [prefilledInvoice, setPrefilledInvoice] = useState<{ lineDescription: string; subtotal: number; gstRate: number; dueDate: string } | null>(null);

  // Clause writer states inside agreement view
  const [aiClausePrompt, setAiClausePrompt] = useState("");
  const [isClauseGenerating, setIsClauseGenerating] = useState(false);

  // Load saved AI configurations from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("blink_beyond_ai_key");
      const savedProvider = localStorage.getItem("blink_beyond_ai_provider");
      if (savedKey) setAiApiKey(savedKey);
      if (savedProvider) setAiProvider(savedProvider as any);
    }
  }, []);

  // Action handler for appending AI clause to current contract content
  const handleAIClauseAdd = async () => {
    setIsClauseGenerating(true);
    try {
      const res = await generateAIClause(aiClausePrompt, agreementContent, aiApiKey, aiProvider);
      if (res.ok && res.clause) {
        setAgreementContent(prev => prev + res.clause);
        setAiClausePrompt("");
        toast.success("Clause drafted and appended to agreement content!");
      } else {
        toast.error(res.error || "Failed to draft contract clause.");
      }
    } catch (e) {
      toast.error("Error communicating with AI service.");
    } finally {
      setIsClauseGenerating(false);
    }
  };

  // Load selected agreement content
  useEffect(() => {
    if (selectedAgreement) {
      setAgreementContent(selectedAgreement.content);
    }
  }, [selectedAgreement]);

  // Web Speech API Voice Dictation
  const startVoiceDictation = () => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Web Speech API not supported in this browser. Running simulation...");
        setIsListening(true);
        setTimeout(() => {
          setAgreementContent(prev => prev + "\n- Blink Beyond agrees to deliver campaign creatives, monthly performance audits, and optimized search engine ads.");
          setIsListening(false);
          toast.success("Simulated clause added!");
        }, 2500);
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-IN";

      rec.onstart = () => {
        setIsListening(true);
        toast.info("Listening... Speak now");
      };
      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setAgreementContent(prev => prev + " " + text);
        toast.success("Text added successfully!");
      };
      rec.onerror = () => {
        setIsListening(false);
        toast.error("Failed to capture speech");
      };
      rec.onend = () => {
        setIsListening(false);
      };
      rec.start();
    }
  };

  // Save changes to Agreement draft
  async function handleSaveAgreementDraft() {
    if (!selectedAgreement) return;
    const r = await updateAgreementContent(selectedAgreement.id, agreementContent);
    if (r.ok) toast.success("Draft saved"); else toast.error(r.error);
  }

  // Sign agreement action
  async function handleSignAgreement() {
    if (!selectedAgreement) return;
    if (!signName.trim()) {
      toast.error("Please enter your name to sign the agreement");
      return;
    }
    const r = await signAgreement(selectedAgreement.id, signName.trim());
    if (r.ok) {
      toast.success("Agreement signed successfully!");
      setSelectedAgreement(null);
      setSignName("");
    } else {
      toast.error(r.error);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 scale-hover soft-transition">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-violet-400 animate-pulse" />
              AI Copilot Draft Assistant
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Describe client requirements in plain text to automatically draft proposals, invoices, or agreements instantly.
            </p>
          </div>
          <Button onClick={() => setAiOpen(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs h-9 flex items-center gap-1.5 btn-micro-anim border-0">
            <Sparkles className="h-3.5 w-3.5 text-white" />
            Open AI Drafter
          </Button>
        </div>
      )}

      <Tabs defaultValue={ENABLE_PROPOSALS ? "proposals" : "agreements"}>
        <TabsList className={`grid w-full ${ENABLE_PROPOSALS ? "grid-cols-3" : "grid-cols-2"}`}>
          {ENABLE_PROPOSALS && <TabsTrigger value="proposals">Proposals</TabsTrigger>}
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {ENABLE_PROPOSALS && (
          <TabsContent value="proposals" className="space-y-4 mt-4">
            {canManage && (
              <Dialog open={propOpen} onOpenChange={setPropOpen}>
                <div className="flex justify-end"><DialogTrigger render={<Button />}><Plus className="h-4 w-4 mr-2" />New proposal</DialogTrigger></div>
                <DialogContent><DialogHeader><DialogTitle>New proposal</DialogTitle></DialogHeader>
                  <ProposalForm clients={clients} onSuccess={() => { setPropOpen(false); setPrefilledProposal(null); }} prefill={prefilledProposal || undefined} />
                </DialogContent>
              </Dialog>
            )}
            <div className="space-y-2">
              {proposals.map((p) => (
                <Card key={p.id}><CardContent className="py-4 flex justify-between items-center">
                  <div><p className="font-medium">{p.title}</p><p className="text-sm text-muted-foreground">{p.client.companyName}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge>{p.status}</Badge><span className="font-medium">₹{p.total.toLocaleString("en-IN")}</span>
                    {canManage && (
                      <select className="text-xs border rounded px-2 h-8 bg-background" value={p.status} onChange={async (e) => {
                        const r = await updateProposalStatus(p.id, e.target.value);
                        if (r.ok) toast.success("Updated"); else toast.error(r.error);
                      }}>
                        <option value="DRAFT">Draft</option><option value="SENT">Sent</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
                      </select>
                    )}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* Agreements Tab */}
        <TabsContent value="agreements" className="space-y-4 mt-4">
          <div className="space-y-2">
            {agreements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                No agreements generated yet. Approve a proposal to generate a draft contract.
              </div>
            ) : (
              agreements.map((a) => (
                <Card key={a.id}>
                  <CardContent className="py-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.client.companyName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === "SIGNED" ? "default" : "outline"}>
                        {a.status}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => setSelectedAgreement(a)}>
                        <FileSignature className="h-4 w-4 mr-1.5" />
                        {a.status === "SIGNED" ? "View & Print" : "View & Sign"}
                      </Button>
                      {canManage && a.status !== "SIGNED" && (
                        <select className="text-xs border rounded px-2 h-8 bg-background" value={a.status} onChange={async (e) => {
                          const r = await updateAgreementStatus(a.id, e.target.value);
                          if (r.ok) toast.success("Status updated"); else toast.error(r.error);
                        }}>
                          <option value="DRAFT">Draft</option>
                          <option value="SENT">Sent</option>
                          <option value="SIGNED">Signed</option>
                          <option value="EXPIRED">Expired</option>
                        </select>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4 mt-4">
          {canManage && (
            <Dialog open={invOpen} onOpenChange={setInvOpen}>
              <div className="flex justify-end"><DialogTrigger render={<Button />}><Plus className="h-4 w-4 mr-2" />New invoice</DialogTrigger></div>
              <DialogContent><DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
                <InvoiceForm clients={clients} onSuccess={() => { setInvOpen(false); setPrefilledInvoice(null); }} prefill={prefilledInvoice || undefined} />
              </DialogContent>
            </Dialog>
          )}
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Card key={inv.id}><CardContent className="py-4 flex justify-between items-center">
                <div><p className="font-medium">{inv.number}</p><p className="text-sm text-muted-foreground">{inv.client.companyName}</p></div>
                <div className="flex items-center gap-2">
                  <Badge>{inv.status}</Badge><span>₹{inv.total.toLocaleString("en-IN")}</span>
                  <Button size="sm" variant="outline" className="h-9 scale-hover btn-micro-anim" onClick={() => printInvoice(inv)}>
                    <Download className="h-4 w-4 mr-1.5" /> PDF Print
                  </Button>
                  {canManage && inv.status !== "PAID" && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const r = await markPaid(inv.id);
                      if (r.ok) toast.success("Marked paid"); else toast.error(r.error);
                    }}>Mark paid</Button>
                  )}
                </div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* View/Edit/Sign Agreement Dialog */}
        <FinanceAgreementDialog
          selectedAgreement={selectedAgreement}
          setSelectedAgreement={setSelectedAgreement}
          agreementContent={agreementContent}
          setAgreementContent={setAgreementContent}
          signName={signName}
          setSignName={setSignName}
          isListening={isListening}
          startVoiceDictation={startVoiceDictation}
          aiClausePrompt={aiClausePrompt}
          setAiClausePrompt={setAiClausePrompt}
          isClauseGenerating={isClauseGenerating}
          aiProvider={aiProvider}
          handleAIClauseAdd={handleAIClauseAdd}
          handleSaveAgreementDraft={handleSaveAgreementDraft}
          handleSignAgreement={handleSignAgreement}
        />
      </Tabs>

      {/* AI Drafter Dialog */}
      <FinanceAiCopilotDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        clients={clients}
        onApplyDraft={(type, result) => {
          if (type === "invoice") {
            setPrefilledInvoice({
              lineDescription: result.lineDescription || result.title || "AI Drafted Professional Retainer Services",
              subtotal: Number(result.subtotal || result.total) || 0,
              gstRate: Number(result.gstRate) || 18,
              dueDate: result.dueDate || "",
            });
            setInvOpen(true);
            toast.success("Draft applied to invoice creator!");
          } else if (type === "proposal") {
            setPrefilledProposal({
              title: result.title || "AI Proposal Draft",
              subtotal: Number(result.total || result.subtotal) || 0,
              discount: Number(result.discount) || 0,
              templateKey: "website",
            });
            setPropOpen(true);
            toast.success("Draft applied to proposal creator!");
          } else if (type === "agreement") {
            navigator.clipboard.writeText(result.content || "");
            toast.success("Agreement text copied to clipboard!");
          }
        }}
      />
    </div>
  );
}
