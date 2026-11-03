import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, IndianRupee, Sparkles, Building2, ShieldCheck, PenTool } from "lucide-react";

export default function ProposalSharePage() {
  const [, params] = useRoute("/share/proposal/:token");
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedTierId, setSelectedTierId] = useState<string>("standard");
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [signerName, setSignerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/proposals/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Proposal not found or expired");
        }
        return res.json();
      })
      .then((data) => {
        setProposal(data);
        if (data.selectedTierId) setSelectedTierId(data.selectedTierId);
        if (data.selectedAddOnIds) setSelectedAddOnIds(data.selectedAddOnIds);
        if (data.status === "ACCEPTED" || data.signedAt) setSignedSuccess(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-muted-foreground">Loading interactive proposal…</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-card border border-border p-8 rounded-2xl text-center space-y-4 shadow-lg">
          <div className="h-14 w-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl font-bold">
            ✕
          </div>
          <h1 className="text-xl font-bold">Proposal Link Unavailable</h1>
          <p className="text-sm text-muted-foreground">{error || "This proposal link may have expired or is invalid."}</p>
        </div>
      </div>
    );
  }

  const tiers = proposal.pricingTiers && proposal.pricingTiers.length > 0
    ? proposal.pricingTiers
    : [
        {
          id: "standard",
          name: "Growth Retainer",
          price: proposal.totalAmount || 75000,
          description: "Full-service social media, monthly shoots & performance ads management.",
          features: ["12 High-Impact Reels", "8 Carousels & Infographics", "Monthly On-Site Shoot", "Paid Ads Campaign Optimization"],
        },
      ];

  const addOns = proposal.optionalAddOns || [
    { id: "influencer", name: "Influencer Whitelisting Rights", price: 15000, description: "Run ads directly through creator handles for 2x CTR" },
    { id: "landing-page", name: "Conversion Landing Page Redesign", price: 25000, description: "High-speed mobile funnel design & copy" },
  ];

  const activeTier = tiers.find((t: any) => t.id === selectedTierId) || tiers[0];
  const tierPrice = activeTier ? Number(activeTier.price) || 0 : 0;
  const addOnsTotal = addOns
    .filter((a: any) => selectedAddOnIds.includes(a.id))
    .reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);
  const totalInvestment = tierPrice + addOnsTotal;

  const handleAccept = async () => {
    if (!signerName.trim()) {
      toast.error("Please enter your legal full name to sign this agreement");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/public/proposals/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedTierId,
          selectedAddOnIds,
          signatureName: signerName.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to sign proposal");
      }

      setSignedSuccess(true);
      toast.success("Proposal successfully signed and verified!");
    } catch (err: any) {
      toast.error(err.message || "Failed to accept proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-border pb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-primary text-primary-foreground font-black flex items-center justify-center text-sm">
                BB
              </span>
              <span className="font-bold text-lg tracking-tight font-heading">BLINK BEYOND</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Creative Production & Performance Growth Agency</p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1">
            Official Client Proposal
          </Badge>
        </div>

        {/* Title & Scope */}
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight font-heading">{proposal.title}</h1>
          <p className="text-muted-foreground text-sm">
            Prepared exclusively for <strong className="text-foreground">{proposal.clientName}</strong>
          </p>
          {proposal.scopeSummary && (
            <div className="p-4 rounded-xl bg-card border border-border text-sm leading-relaxed whitespace-pre-wrap">
              {proposal.scopeSummary}
            </div>
          )}
        </div>

        {/* Pricing Tiers */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Select Retainer Tier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiers.map((tier: any) => {
              const isSelected = selectedTierId === tier.id;
              return (
                <div
                  key={tier.id}
                  onClick={() => !signedSuccess && setSelectedTierId(tier.id)}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/[0.03] shadow-md ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-border/80"
                  } ${signedSuccess ? "cursor-default" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base">{tier.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-border flex items-baseline gap-1">
                    <span className="text-2xl font-black font-heading flex items-center">
                      <IndianRupee className="h-5 w-5" />
                      {(Number(tier.price) || 0).toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-muted-foreground">/ month</span>
                  </div>
                  {tier.features && (
                    <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      {tier.features.map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-primary font-bold">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional Add-Ons */}
        {addOns.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Optional Accelerators & Add-Ons</h2>
            <div className="space-y-3">
              {addOns.map((addon: any) => {
                const isChecked = selectedAddOnIds.includes(addon.id);
                return (
                  <div
                    key={addon.id}
                    onClick={() => {
                      if (signedSuccess) return;
                      if (isChecked) {
                        setSelectedAddOnIds(selectedAddOnIds.filter((id) => id !== addon.id));
                      } else {
                        setSelectedAddOnIds([...selectedAddOnIds, addon.id]);
                      }
                    }}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all cursor-pointer ${
                      isChecked ? "border-primary/50 bg-primary/[0.02]" : "border-border bg-card"
                    } ${signedSuccess ? "cursor-default" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="h-4 w-4 rounded text-primary focus:ring-primary"
                      />
                      <div>
                        <p className="font-semibold text-sm">{addon.name}</p>
                        <p className="text-xs text-muted-foreground">{addon.description}</p>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-foreground shrink-0 flex items-center">
                      +<IndianRupee className="h-3.5 w-3.5" />
                      {(Number(addon.price) || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Investment Summary */}
        <div className="p-6 rounded-2xl bg-card border-2 border-primary/20 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Total Monthly Investment</p>
              <p className="text-3xl font-extrabold font-heading text-primary flex items-center mt-1">
                <IndianRupee className="h-7 w-7" />
                {totalInvestment.toLocaleString("en-IN")}
                <span className="text-xs font-normal text-muted-foreground ml-2">+ 18% GST</span>
              </p>
            </div>
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
          </div>

          {signedSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-100">
                Proposal Signed & Confirmed!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Signed by: <strong>{proposal.signatureName || signerName}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                  <PenTool className="h-3.5 w-3.5" /> Sign Proposal Digitally
                </label>
                <Input
                  placeholder="Type your legal full name (e.g. John Doe, CEO)"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="font-serif italic text-base border-primary/40 focus-visible:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  By clicking Accept, you agree to Blink Beyond terms of engagement and authorize generation of onboarding quotation/invoice.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full gap-2 font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                disabled={submitting || !signerName.trim()}
                onClick={handleAccept}
              >
                <CheckCircle2 className="h-5 w-5" />
                {submitting ? "Signing & Launching…" : "Accept & Digitally Sign Proposal"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
