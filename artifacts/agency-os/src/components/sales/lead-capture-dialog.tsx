"use client";

import { useState, useEffect, useActionState, useRef } from "react";
import {
  Sparkles,
  Paperclip,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Phone,
  Mail,
  Globe,
  MapPin,
  Briefcase,
  DollarSign,
  Calendar,
  FileText,
  Tag,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createLead, updateLead } from "@/lib/actions/leads";
import type { ActionResult } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Lead = {
  id: string;
  title: string;
  companyName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  value: number | null;
  stage: string;
  description?: string | null;
  lostReason: string | null;
  followUpAt: Date | string | null;
  owner?: { id?: string; name: string } | null;
  ownerId?: string | null;
  createdAt?: Date | string;
};

type Owner = { id: string; name: string };

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Google",
  "Cold Call",
  "Existing Client",
  "Walk In",
  "Other",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const BUSINESS_TYPES = ["Individual", "Startup", "Small Business", "Enterprise"];

const INDUSTRIES = [
  "E-Commerce",
  "Real Estate",
  "Healthcare",
  "IT & Software",
  "Education",
  "Hospitality",
  "Retail",
  "Manufacturing",
  "Finance",
  "Media & Entertainment",
  "Food & Beverage",
  "Fashion",
  "Automotive",
  "Beauty & Wellness",
  "Other",
];

const AVAILABLE_SERVICES = [
  "Website Development",
  "SEO",
  "Google Ads",
  "Meta Ads",
  "Social Media Management",
  "Graphic Design",
  "Video Editing",
  "Content Writing",
  "Branding",
  "Photography",
  "Reels",
  "Logo Design",
  "Email Marketing",
];

const initialResult: ActionResult = { ok: false, error: "" };

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  owners: Owner[];
  onSuccess?: () => void;
}

export function LeadCaptureDialog({
  open,
  onOpenChange,
  lead,
  owners,
  onSuccess,
}: LeadCaptureDialogProps) {
  // Form State
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [altMobile, setAltMobile] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");

  const [leadTitle, setLeadTitle] = useState("");
  const [source, setSource] = useState("Website");
  const [priority, setPriority] = useState("Medium");
  const [industry, setIndustry] = useState("IT & Software");
  const [businessType, setBusinessType] = useState("Small Business");
  const [budget, setBudget] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [probability, setProbability] = useState("50");
  const [assignedOwnerId, setAssignedOwnerId] = useState("");
  const [stage, setStage] = useState("LEAD");

  const [requirements, setRequirements] = useState("");
  const [description, setDescription] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [internalNotes, setInternalNotes] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([]);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form on open / lead change
  useEffect(() => {
    if (open) {
      if (lead) {
        setLeadTitle(lead.title || "");
        setCompanyName(lead.companyName || "");
        setEmail(lead.contactEmail || "");
        setMobileNumber(lead.contactPhone || "");
        setBudget(lead.value ? String(lead.value) : "");
        setStage(lead.stage || "LEAD");
        setAssignedOwnerId(lead.ownerId || (lead.owner ? owners.find(o => o.name === lead.owner?.name)?.id : "") || "");
        setCloseDate(
          lead.followUpAt
            ? new Date(lead.followUpAt).toISOString().slice(0, 10)
            : ""
        );
        // Default selected service if none
        setSelectedServices(["Social Media Management"]);
        setDescription(lead.description || "");
      } else {
        // Reset for new lead
        setCompanyName("");
        setContactName("");
        setDesignation("");
        setMobileNumber("");
        setAltMobile("");
        setEmail("");
        setWebsite("");
        setAddress("");
        setCity("");
        setState("");
        setCountry("India");

        setLeadTitle("");
        setSource("Website");
        setPriority("Medium");
        setIndustry("IT & Software");
        setBusinessType("Small Business");
        setBudget("");
        setCloseDate("");
        setProbability("50");
        setAssignedOwnerId(owners[0]?.id || "");
        setStage("LEAD");

        setRequirements("");
        setDescription("");
        setSelectedServices([]);
        setInternalNotes("");
        setAttachments([]);
        setAiPrompt("");
        setErrors({});
      }
    }
  }, [open, lead, owners]);

  // Save Draft to Local Storage
  const handleSaveDraft = () => {
    const draftData = {
      companyName,
      contactName,
      mobileNumber,
      leadTitle,
      selectedServices,
      budget,
      requirements,
      description,
      internalNotes,
    };
    localStorage.setItem("agency_os_lead_draft", JSON.stringify(draftData));
    toast.success("Lead draft saved to browser storage!");
  };

  // Toggle Service
  const toggleService = (service: string) => {
    setSelectedServices((prev) => {
      const next = prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service];
      if (next.length > 0) {
        setErrors((e) => ({ ...e, services: "" }));
      }
      return next;
    });
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + " MB",
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) attached`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // AI Auto-Fill Handler
  const handleAiAutoFill = () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a description or prompt for AI analysis");
      return;
    }

    setIsAiProcessing(true);

    setTimeout(() => {
      const promptLower = aiPrompt.toLowerCase();

      // Extract services
      const matchedServices: string[] = [];
      if (promptLower.includes("website") || promptLower.includes("site") || promptLower.includes("web")) {
        matchedServices.push("Website Development");
      }
      if (promptLower.includes("seo") || promptLower.includes("ranking")) {
        matchedServices.push("SEO");
      }
      if (promptLower.includes("reel") || promptLower.includes("short")) {
        matchedServices.push("Reels", "Video Editing");
      }
      if (promptLower.includes("post") || promptLower.includes("social") || promptLower.includes("instagram") || promptLower.includes("facebook")) {
        matchedServices.push("Social Media Management", "Graphic Design");
      }
      if (promptLower.includes("google ad") || promptLower.includes("ppc")) {
        matchedServices.push("Google Ads");
      }
      if (promptLower.includes("meta ad") || promptLower.includes("fb ad")) {
        matchedServices.push("Meta Ads");
      }
      if (promptLower.includes("branding") || promptLower.includes("logo")) {
        matchedServices.push("Branding", "Logo Design");
      }
      if (promptLower.includes("content") || promptLower.includes("blog")) {
        matchedServices.push("Content Writing");
      }

      const servicesToSet = matchedServices.length > 0 ? Array.from(new Set(matchedServices)) : ["Website Development", "Social Media Management"];
      setSelectedServices(servicesToSet);

      // Extract budget numbers
      const budgetMatch = aiPrompt.match(/(\d+[\d,]*\d*)\s*(k|lakh|lakhs|inr|rs|₹)?/i);
      if (budgetMatch) {
        let numStr = budgetMatch[1].replace(/,/g, "");
        let num = parseInt(numStr, 10);
        if (budgetMatch[2]?.toLowerCase() === "k") num *= 1000;
        if (budgetMatch[2]?.toLowerCase().startsWith("lakh")) num *= 100000;
        if (!isNaN(num) && num > 0) {
          setBudget(String(num));
        }
      } else {
        setBudget("75000");
      }

      // Generate title
      if (!leadTitle) {
        const words = aiPrompt.split(" ").slice(0, 5).join(" ");
        setLeadTitle(words.charAt(0).toUpperCase() + words.slice(1) + " Project");
      }

      // Priority & Stage
      if (promptLower.includes("urgent") || promptLower.includes("asap") || promptLower.includes("immediately")) {
        setPriority("Urgent");
      } else if (promptLower.includes("high") || promptLower.includes("important")) {
        setPriority("High");
      } else {
        setPriority("Medium");
      }

      setRequirements(aiPrompt);
      setErrors((e) => ({ ...e, services: "", leadTitle: "", requirements: "" }));
      setIsAiProcessing(false);
      toast.success("AI successfully parsed and auto-filled the lead parameters!");
    }, 600);
  };

  // Form Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.companyName = "Company Name is required";
    }
    if (!contactName.trim()) {
      newErrors.contactName = "Contact Person Name is required";
    }
    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = "Mobile Number is required";
    }
    if (!leadTitle.trim()) {
      newErrors.leadTitle = "Lead Title is required";
    }
    if (selectedServices.length === 0) {
      newErrors.services = "Please select at least one service required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    // Format rich notes containing additional CRM details
    const formattedNotes = JSON.stringify({
      designation,
      altMobile,
      website,
      address,
      city,
      state,
      country,
      source,
      priority,
      industry,
      businessType,
      probability,
      requirements,
      services: selectedServices,
      internalNotes,
      attachmentsCount: attachments.length,
    });

    const formData = new FormData();
    if (lead?.id) formData.append("id", lead.id);
    formData.append("title", leadTitle);
    formData.append("companyName", companyName);
    formData.append("contactEmail", email);
    formData.append("contactPhone", mobileNumber);
    formData.append("value", budget);
    formData.append("stage", stage);
    formData.append("ownerId", assignedOwnerId);
    formData.append("description", description);
    if (closeDate) formData.append("followUpAt", closeDate);
    formData.append("lostReason", formattedNotes); // Pass structured data in notes/lostReason

    try {
      const res = lead?.id ? await updateLead(initialResult, formData) : await createLead(initialResult, formData);
      if (res.ok) {
        toast.success(lead?.id ? "Lead updated successfully" : "New Lead captured successfully!");
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Failed to save lead");
      }
    } catch (err) {
      toast.error("An unexpected error occurred while saving");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[880px] w-full p-0 overflow-hidden bg-card border-border rounded-xl shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/40 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Briefcase className="h-5 w-5 text-primary" />
              {lead ? "Edit CRM Lead" : "New CRM Lead Capture"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fill in client details, requirements, and services to create a complete lead card.
            </p>
          </div>
        </DialogHeader>

        {/* Scrollable Container - Single Vertical Scrollbar */}
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* AI Smart Fill Section */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" /> Write with AI (Smart Auto-Fill)
              </span>
              <span className="text-[10px] text-muted-foreground">Paste lead inquiry or raw text</span>
            </div>
            <div className="flex gap-2">
              <Textarea
                placeholder='e.g. "I need a company website, SEO and 30 Instagram reels. Estimated budget is ₹1,50,000."'
                rows={2}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="text-xs bg-background resize-none"
              />
              <Button
                type="button"
                onClick={handleAiAutoFill}
                disabled={isAiProcessing}
                className="shrink-0 h-auto self-stretch px-4 text-xs font-medium gap-1.5"
              >
                {isAiProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Auto-fill
              </Button>
            </div>
          </div>

          <form id="lead-capture-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Contact Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" /> Contact Information
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Contact Person Name * */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Contact Person Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="e.g. Rahul Sharma"
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value);
                        if (e.target.value.trim()) setErrors((prev) => ({ ...prev, contactName: "" }));
                      }}
                      className={`pl-8 h-9 text-xs ${errors.contactName ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.contactName && <p className="text-[10px] text-destructive">{errors.contactName}</p>}
                </div>

                {/* Designation */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Designation</Label>
                  <Input
                    placeholder="e.g. Marketing Director / CEO"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Company Name * */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="e.g. Acme Innovations Pvt Ltd"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        if (e.target.value.trim()) setErrors((prev) => ({ ...prev, companyName: "" }));
                      }}
                      className={`pl-8 h-9 text-xs ${errors.companyName ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.companyName && <p className="text-[10px] text-destructive">{errors.companyName}</p>}
                </div>

                {/* Mobile Number * */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Mobile Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="+91 9876543210"
                      value={mobileNumber}
                      onChange={(e) => {
                        setMobileNumber(e.target.value);
                        if (e.target.value.trim()) setErrors((prev) => ({ ...prev, mobileNumber: "" }));
                      }}
                      className={`pl-8 h-9 text-xs ${errors.mobileNumber ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.mobileNumber && <p className="text-[10px] text-destructive">{errors.mobileNumber}</p>}
                </div>

                {/* Alternate Mobile */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Alternate Mobile Number</Label>
                  <Input
                    placeholder="+91 9123456789"
                    value={altMobile}
                    onChange={(e) => setAltMobile(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="rahul@acme.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Website */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="https://www.acme.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Company Address</Label>
                  <Input
                    placeholder="Suite 402, Business Bay"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* City */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City</Label>
                  <Input
                    placeholder="e.g. Mumbai / Bangalore"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* State & Country */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">State</Label>
                    <Input
                      placeholder="Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Country</Label>
                    <Input
                      placeholder="India"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Lead Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold text-foreground">
                <Tag className="h-4 w-4 text-primary" /> Lead Details & Qualification
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Lead Title * */}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium">
                    Lead Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. E-Commerce Redesign & Performance Marketing"
                    value={leadTitle}
                    onChange={(e) => {
                      setLeadTitle(e.target.value);
                      if (e.target.value.trim()) setErrors((prev) => ({ ...prev, leadTitle: "" }));
                    }}
                    className={`h-9 text-xs ${errors.leadTitle ? "border-destructive" : ""}`}
                  />
                  {errors.leadTitle && <p className="text-[10px] text-destructive">{errors.leadTitle}</p>}
                </div>

                {/* Lead Source */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Lead Source</Label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Priority</Label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Industry */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Industry</Label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {INDUSTRIES.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                {/* Business Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Business Type</Label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {BUSINESS_TYPES.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>

                {/* Expected Budget */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Expected Budget (₹)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="150000"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Closing Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Expected Closing Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={closeDate}
                      onChange={(e) => setCloseDate(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Probability */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Closing Probability ({probability}%)</Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={probability}
                    onChange={(e) => setProbability(e.target.value)}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Assigned Sales Exec / Owner */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assigned Executive / Manager</Label>
                  <select
                    value={assignedOwnerId}
                    onChange={(e) => setAssignedOwnerId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Services Required */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Services Required
                  <span className="text-destructive">*</span>
                </span>
                <span className="text-[10px] text-muted-foreground">Select all that apply</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {AVAILABLE_SERVICES.map((service) => {
                  const isSelected = selectedServices.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3 w-3" />}
                      {service}
                    </button>
                  );
                })}
              </div>
              {errors.services && (
                <p className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.services}
                </p>
              )}
            </div>

            {/* Section 4: Project Requirements */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-primary" /> Project Requirements / Brief
              </Label>
              <Textarea
                placeholder="Detailed client requirements, scope of work, key deliverables (e.g. Need social media management, website redesign, SEO campaign, reels editing...)"
                rows={4}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="text-xs resize-y bg-background"
              />
            </div>

            {/* Section 5: Lead Description / Research Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-primary" /> Lead Description / Research Notes
              </Label>
              <Textarea
                placeholder={`• Company Location: Mumbai, Maharashtra
• Industry: Digital Marketing
• Website: www.company.com
• Contacted through LinkedIn
• Looking for Website + Social Media Management
• Existing Marketing Agency contract ends next month
• Budget approximately ₹80,000/month
• Decision maker: Marketing Manager
• Best time to call: 3 PM – 5 PM
• Follow-up after proposal submission
• Competitors: XYZ Agency
• Additional observations...`}
                rows={7}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs resize-y w-full bg-background whitespace-pre-wrap"
              />
            </div>

            {/* Section 5: Internal Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Internal Notes (Staff Only)
              </Label>
              <Textarea
                placeholder="Internal team notes, background context, pricing negotiation strategy, confidential client details..."
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="text-xs resize-y bg-background/80"
              />
            </div>

            {/* Section 6: Attachments */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold flex items-center gap-2 text-foreground">
                <Paperclip className="h-4 w-4 text-primary" /> Attachments (PDFs, Images, Briefs, Reference Files)
              </Label>

              <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-muted/20">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="lead-file-upload"
                />
                <label htmlFor="lead-file-upload" className="cursor-pointer flex flex-col items-center gap-1">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Click to upload or drag files here</span>
                  <span className="text-[10px] text-muted-foreground">Supports PDF, DOCX, PNG, JPG, ZIP (max 25MB)</span>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/60 text-xs border border-border"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium truncate">{file.name}</span>
                        <span className="text-[10px] text-muted-foreground">({file.size})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Action Buttons at Bottom Right */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            Save Draft
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="lead-capture-form"
              size="sm"
              disabled={isSubmitting}
              className="text-xs px-5 font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : lead ? (
                "Save Changes"
              ) : (
                "Add Lead"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
