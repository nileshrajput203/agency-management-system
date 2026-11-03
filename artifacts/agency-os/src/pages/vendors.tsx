import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SearchBar } from "@/components/common/SearchBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users2, Plus, Instagram, Youtube, IndianRupee, MapPin, Mail, Phone,
  FileCheck2, Sparkles, Building2, ExternalLink
} from "lucide-react";
import { useLocation } from "wouter";

export default function VendorsPage() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"ALL" | "INFLUENCER" | "FREELANCER" | "VENDOR">("ALL");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    vendorType: "INFLUENCER",
    category: "CREATIVE",
    niche: "Lifestyle & Fashion",
    city: "Mumbai",
    state: "Maharashtra",
    instagramHandle: "",
    youtubeHandle: "",
    followerCount: 50000,
    engagementRate: "3.5%",
    commercialRatePerReel: 25000,
    gstin: "",
    panNumber: "",
    bankAccountNo: "",
    bankIfsc: "",
  });

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", activeTab, search],
    queryFn: async () => {
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
      const params = new URLSearchParams();
      if (activeTab !== "ALL") params.append("vendorType", activeTab);
      if (search) params.append("search", search);
      const res = await fetch(`/api/vendors?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load creators & vendors");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create vendor/creator");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Vendor / Creator added successfully!");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setAddOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = (vendors as any[]).filter((v) => {
    if (activeTab !== "ALL" && v.vendorType !== activeTab) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.niche?.toLowerCase().includes(q) ||
      v.city?.toLowerCase().includes(q) ||
      v.instagramHandle?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 animated-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            Creators, Influencers & Vendors
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your roster of creators, models, freelance talent, and production vendors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar placeholder="Search by name, niche, handle…" value={search} onChange={setSearch} />
          <Button onClick={() => setAddOpen(true)} className="gap-2 btn-micro-anim">
            <Plus className="h-4 w-4" /> Add Creator / Vendor
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {(["ALL", "INFLUENCER", "FREELANCER", "VENDOR"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab === "ALL"
              ? "All Talent & Partners"
              : tab === "INFLUENCER"
              ? "✨ Influencers & Creators"
              : tab === "FREELANCER"
              ? "🎨 Freelance Talent"
              : "🏢 Production Vendors"}
          </button>
        ))}
      </div>

      {/* Creator Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-2xl">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="font-semibold text-sm">No creators or vendors found</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first creator or vendor to start collaborating.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <Card key={v.id} className="scale-hover border border-border overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base">{v.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                        {v.vendorType || "VENDOR"}
                      </Badge>
                      {v.niche && (
                        <span className="text-xs text-muted-foreground font-medium">
                          {v.niche}
                        </span>
                      )}
                    </div>
                  </div>
                  {v.city && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                      <MapPin className="h-3 w-3" /> {v.city}
                    </span>
                  )}
                </div>

                {/* Handles and stats if influencer */}
                {v.vendorType === "INFLUENCER" && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border/50 text-xs">
                    <div className="flex items-center justify-between">
                      {v.instagramHandle ? (
                        <a
                          href={`https://instagram.com/${v.instagramHandle.replace("@", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-pink-600 hover:underline font-semibold"
                        >
                          <Instagram className="h-3.5 w-3.5" />
                          @{v.instagramHandle.replace("@", "")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic">No IG handle</span>
                      )}
                      <span className="font-bold text-primary">
                        {(v.followerCount || 0).toLocaleString("en-IN")} followers
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground">Commercial Rate:</span>
                      <span className="font-bold flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                        <IndianRupee className="h-3 w-3" />
                        {(v.commercialRatePerReel || 0).toLocaleString("en-IN")} / Reel
                      </span>
                    </div>
                  </div>
                )}

                {/* Contact details */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  {v.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {v.email}
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {v.phone}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => {
                      setLocation(`/purchase-orders?vendorId=${v.id}`);
                    }}
                  >
                    <FileCheck2 className="h-3.5 w-3.5" />
                    Issue Purchase Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Creator / Vendor Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Creator, Influencer or Vendor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Partner / Creator Full Name</Label>
              <Input
                placeholder="e.g. Sara Tendulkar or Pixel Perfect Studio"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.vendorType}
                  onChange={(e) => setFormData({ ...formData, vendorType: e.target.value })}
                >
                  <option value="INFLUENCER">✨ Influencer / Creator</option>
                  <option value="FREELANCER">🎨 Freelance Talent</option>
                  <option value="VENDOR">🏢 Production / Print Vendor</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Niche / Category</Label>
                <Input
                  placeholder="e.g. Tech, Fashion, Food, Camera Gear"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="creator@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone / WhatsApp</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {formData.vendorType === "INFLUENCER" && (
              <div className="p-3 rounded-lg bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/50 space-y-3">
                <p className="text-xs font-bold text-pink-700 dark:text-pink-300">Creator Socials & Commercials</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Instagram Handle</Label>
                    <Input
                      placeholder="@handle"
                      value={formData.instagramHandle}
                      onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Followers Count</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={formData.followerCount}
                      onChange={(e) => setFormData({ ...formData, followerCount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Commercial Rate Per Reel (₹)</Label>
                  <Input
                    type="number"
                    placeholder="25000"
                    value={formData.commercialRatePerReel}
                    onChange={(e) => setFormData({ ...formData, commercialRatePerReel: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  placeholder="Mumbai"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  placeholder="Maharashtra"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!formData.name || createMutation.isPending}
                onClick={() => createMutation.mutate(formData)}
              >
                {createMutation.isPending ? "Saving..." : "Save Creator / Vendor"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

