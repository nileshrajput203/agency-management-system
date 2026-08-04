import { useState } from "react";
import { Sparkles, FileText, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FinanceAiCopilotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; companyName: string }[];
  onApplyDraft: (type: "invoice" | "proposal" | "agreement", result: any) => void;
}

const DRAFT_PRESETS = {
  website: {
    clientName: "Nike Retail",
    projectTitle: "E-Commerce Website Development",
    amount: "120000",
    revisions: "3",
    termsDays: "15",
    scope: "Design, development, and launch of a fully responsive e-commerce web application with custom product pages, checkout flow, search filters, and an admin dashboard interface.",
  },
  social: {
    clientName: "Adidas Originals",
    projectTitle: "Social Media Campaign Retainer",
    amount: "45000",
    revisions: "2",
    termsDays: "10",
    scope: "Creation of 15 social media assets per month, monthly calendar setup, post scheduling, performance analytics tracking, and community engagement for Instagram and LinkedIn channels.",
  },
  performance: {
    clientName: "Puma Fitness",
    projectTitle: "Paid Performance Marketing",
    amount: "80000",
    revisions: "2",
    termsDays: "15",
    scope: "Management of paid advertisement campaigns across Meta Ads Manager and Google Ads. A/B testing copy, audience segmentation, budget optimization, and bi-weekly growth reports.",
  },
  retainer: {
    clientName: "Reebok India",
    projectTitle: "Full-Service Digital Agency Retainer",
    amount: "150000",
    revisions: "4",
    termsDays: "30",
    scope: "Comprehensive marketing and technical support including search engine optimization (SEO), custom landing pages, monthly creative creatives, newsletter copy, and server maintenance.",
  },
};

export function FinanceAiCopilotDialog({
  open,
  onOpenChange,
  clients,
  onApplyDraft,
}: FinanceAiCopilotDialogProps) {
  const [aiType, setAiType] = useState<"invoice" | "proposal" | "agreement">("invoice");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Structured fields for template drafting
  const [aiClientName, setAiClientName] = useState("");
  const [aiProjectTitle, setAiProjectTitle] = useState("");
  const [aiAmount, setAiAmount] = useState("");
  const [aiScope, setAiScope] = useState("");
  const [aiRevisions, setAiRevisions] = useState("3");
  const [aiTermsDays, setAiTermsDays] = useState("15");

  const handleApplyPreset = (key: keyof typeof DRAFT_PRESETS) => {
    const p = DRAFT_PRESETS[key];
    setAiClientName(p.clientName);
    setAiProjectTitle(p.projectTitle);
    setAiAmount(p.amount);
    setAiRevisions(p.revisions);
    setAiTermsDays(p.termsDays);
    setAiScope(p.scope);
    toast.success(`Loaded preset: ${key.toUpperCase()}`);
  };

  const generateDraftInstantly = () => {
    const cName = aiClientName || "Acme Global";
    const proj = aiProjectTitle || "Digital Marketing & Design Services";
    const amt = parseFloat(aiAmount) || 50000;
    const rev = parseInt(aiRevisions) || 3;
    const days = parseInt(aiTermsDays) || 15;
    const scopeStr = aiScope || "Scope includes strategy, design assets, and campaign execution.";

    if (aiType === "invoice") {
      const draft = {
        title: `Invoice: ${proj}`,
        clientName: cName,
        number: `INV-DRAFT-${Math.floor(1000 + Math.random() * 9000)}`,
        subtotal: amt,
        gstRate: 18,
        gstAmount: Math.round(amt * 0.18),
        total: Math.round(amt * 1.18),
        items: [
          { description: `${proj} - Phase 1 Deliverables`, quantity: 1, rate: Math.round(amt * 0.6) },
          { description: `${proj} - Milestone 2 & Final Handover`, quantity: 1, rate: Math.round(amt * 0.4) },
        ],
        notes: `Payment due within ${days} days of invoice issuance. Max ${rev} revision cycles included.`,
      };
      setAiResult(draft);
    } else if (aiType === "proposal") {
      const draft = {
        title: `Proposal: ${proj}`,
        clientName: cName,
        total: amt,
        scopeOfWork: scopeStr,
        deliverables: [
          "Strategy & Creative Brief",
          "Production of Core Assets & Handover",
          "Bi-Weekly Analytics Reporting",
        ],
        terms: `Net ${days} days payment terms. ${rev} revisions included in baseline scope.`,
      };
      setAiResult(draft);
    } else {
      const draft = {
        title: `Master Service Agreement - ${proj}`,
        clientName: cName,
        content: `MASTER SERVICES AGREEMENT\n\nThis Agreement is entered into between Agency OS and ${cName}.\n\n1. SCOPE OF SERVICES\n${scopeStr}\n\n2. FINANCIAL TERMS\nTotal Contract Value: ₹${amt.toLocaleString()}\nPayment Term: Within ${days} days of invoice date.\n\n3. REVISION POLICY\nClient is entitled to up to ${rev} rounds of revisions per milestone.\n\n4. CONFIDENTIALITY & GOVERNING LAW\nBoth parties agree to protect proprietary information. Governed by applicable local jurisdiction.`,
      };
      setAiResult(draft);
    }
    toast.success("Draft generated instantly!");
  };

  const getAuthToken = () =>
    localStorage.getItem("agency_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("agency_jwt_token") ||
    "";

  const handleAITemplateGenerate = async () => {
    setIsAiGenerating(true);
    setAiResult(null);

    const promptText = `Client: ${aiClientName || 'Client'}, Project: ${aiProjectTitle || 'Services'}, Amount: ₹${aiAmount || '50000'}, Revisions: ${aiRevisions}, Payment terms: ${aiTermsDays} days, Scope: ${aiScope || 'General digital agency services'}`;

    try {
      const token = getAuthToken();
      const res = await fetch("/api/ai/generate-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: aiType, prompt: promptText }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || `Server error ${res.status}`);
      }

      const json = await res.json();
      setAiResult(json.data);
      toast.success("AI draft refined successfully!");
    } catch (err: any) {
      toast.error(err.message || "AI generation failed");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleApply = () => {
    if (!aiResult) return;
    onApplyDraft(aiType, aiResult);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-violet-400 animate-pulse" />
            AI & Template Copilot
          </DialogTitle>
          <CardDescription className="text-slate-400">
            Generate proposals, invoices, or agreements instantly from structured inputs and templates. Optionally refine with AI.
          </CardDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Select Document Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["invoice", "proposal", "agreement"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setAiType(t); setAiResult(null); }}
                  className={`py-2 text-xs font-semibold rounded-lg border capitalize transition-all ${aiType === t ? 'border-primary bg-primary/15 text-primary font-bold' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Template Presets */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Load a Preset Template (Optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {(["website", "social", "performance", "retainer"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className="text-[11px] px-2.5 py-1 bg-slate-950 border border-slate-850 text-slate-350 hover:bg-slate-800 rounded-md transition"
                >
                  ✨ {key === "website" ? "Website Build" : key === "social" ? "Social Retainer" : key === "performance" ? "Paid Ads" : "Full Retainer"}
                </button>
              ))}
            </div>
          </div>

          {/* Structured Fields */}
          <div className="space-y-3 border-t border-slate-850 pt-3">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. Document Specifications</Label>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="aiClientName" className="text-[10px] text-slate-450">Client / Company Name</Label>
                <Input
                  id="aiClientName"
                  value={aiClientName}
                  onChange={(e) => setAiClientName(e.target.value)}
                  placeholder="e.g. Nike Retail"
                  className="bg-slate-950 border-slate-850 h-8 text-xs text-white placeholder-slate-700"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aiProjectTitle" className="text-[10px] text-slate-455">Project / Service Title</Label>
                <Input
                  id="aiProjectTitle"
                  value={aiProjectTitle}
                  onChange={(e) => setAiProjectTitle(e.target.value)}
                  placeholder="e.g. Website Redesign"
                  className="bg-slate-950 border-slate-855 h-8 text-xs text-white placeholder-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="aiAmount" className="text-[10px] text-slate-450">Amount (₹)</Label>
                <Input
                  id="aiAmount"
                  type="number"
                  value={aiAmount}
                  onChange={(e) => setAiAmount(e.target.value)}
                  placeholder="75000"
                  className="bg-slate-950 border-slate-850 h-8 text-xs text-white placeholder-slate-700"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aiRevisions" className="text-[10px] text-slate-450">Max Revisions</Label>
                <Input
                  id="aiRevisions"
                  type="number"
                  value={aiRevisions}
                  onChange={(e) => setAiRevisions(e.target.value)}
                  placeholder="3"
                  className="bg-slate-950 border-slate-850 h-8 text-xs text-white placeholder-slate-700"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aiTermsDays" className="text-[10px] text-slate-455">Payment Term (Days)</Label>
                <Input
                  id="aiTermsDays"
                  type="number"
                  value={aiTermsDays}
                  onChange={(e) => setAiTermsDays(e.target.value)}
                  placeholder="15"
                  className="bg-slate-950 border-slate-855 h-8 text-xs text-white placeholder-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="aiScope" className="text-[10px] text-slate-450">Scope of Deliverables</Label>
              <Textarea
                id="aiScope"
                rows={2}
                value={aiScope}
                onChange={(e) => setAiScope(e.target.value)}
                placeholder="Describe detailed deliverables, milestones, or services..."
                className="bg-slate-950 border-slate-850 text-xs text-white placeholder-slate-700"
              />
            </div>
          </div>

          {/* AI provider info */}
          <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-3 text-xs flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
            <span className="text-slate-400">AI Refine uses <span className="text-violet-300 font-semibold">OpenRouter</span> — configured server-side. No API key needed here.</span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-850 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={generateDraftInstantly}
              className="border-slate-750 hover:bg-slate-800 hover:text-white text-xs font-bold h-10 flex items-center justify-center gap-1.5 btn-micro-anim"
            >
              <FileText className="h-4 w-4 text-slate-400" />
              Draft Instantly (Local)
            </Button>
            
            <Button
              type="button"
              onClick={handleAITemplateGenerate}
              disabled={isAiGenerating}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs h-10 flex items-center justify-center gap-1.5 btn-micro-anim border-0"
            >
              {isAiGenerating ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                  AI Refining...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                  AI Refine & Expand
                </>
              )}
            </Button>
          </div>

          {/* Output Display */}
          {aiResult && (
            <div className="space-y-3 border-t border-slate-850 pt-3.5 mt-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document Draft Preview</Label>
                <Button
                  onClick={handleApply}
                  className="h-7 text-[10px] px-3 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 font-bold border-0 btn-micro-anim"
                >
                  <Check className="h-3 w-3" />
                  {aiType === "agreement" ? "Copy to Clipboard" : "Apply Draft to Form"}
                </Button>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 max-h-[180px] overflow-y-auto text-xs font-mono text-slate-300 text-left">
                {aiType === "agreement" ? (
                  <div className="space-y-2 whitespace-pre-wrap font-sans text-xs">
                    <p className="font-bold text-sm text-white">{aiResult.title}</p>
                    <div className="text-slate-300 leading-relaxed border-t border-slate-850 pt-2">{aiResult.content}</div>
                  </div>
                ) : (
                  <pre>{JSON.stringify(aiResult, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">Close Copilot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
