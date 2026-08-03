import { useRef, useState } from "react";
import {
  Landmark,
  Download,
  Edit,
  Mic,
  MicOff,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CardDescription } from "@/components/ui/card";
import { printAgreement } from "./finance-print-utils";

export type AgreementItem = {
  id: string;
  title: string;
  status: string;
  content: string;
  client: { companyName: string };
  signedAt: Date | null;
};

interface FinanceAgreementDialogProps {
  selectedAgreement: AgreementItem | null;
  setSelectedAgreement: (agreement: AgreementItem | null) => void;
  agreementContent: string;
  setAgreementContent: React.Dispatch<React.SetStateAction<string>>;
  signName: string;
  setSignName: (name: string) => void;
  isListening: boolean;
  startVoiceDictation: () => void;
  aiClausePrompt: string;
  setAiClausePrompt: (prompt: string) => void;
  isClauseGenerating: boolean;
  aiProvider: string;
  handleAIClauseAdd: () => void;
  handleSaveAgreementDraft: () => void;
  handleSignAgreement: () => void;
}

export function FinanceAgreementDialog({
  selectedAgreement,
  setSelectedAgreement,
  agreementContent,
  setAgreementContent,
  signName,
  setSignName,
  isListening,
  startVoiceDictation,
  aiClausePrompt,
  setAiClausePrompt,
  isClauseGenerating,
  aiProvider,
  handleAIClauseAdd,
  handleSaveAgreementDraft,
  handleSignAgreement,
}: FinanceAgreementDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  if (!selectedAgreement) return null;

  // E-Sign Canvas Handlers
  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    let x, y;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      x = e.touches[0]!.clientX - rect.left;
      y = e.touches[0]!.clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let x, y;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      if (e.cancelable) e.preventDefault();
      x = e.touches[0]!.clientX - rect.left;
      y = e.touches[0]!.clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <Dialog
      open={!!selectedAgreement}
      onOpenChange={(open) => {
        if (!open) setSelectedAgreement(null);
      }}
    >
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Agreement Contract
          </DialogTitle>
          <CardDescription>
            Client: {selectedAgreement.client.companyName} | Status:{" "}
            {selectedAgreement.status}
          </CardDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-slate-800">
              {selectedAgreement.title}
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  printAgreement(
                    selectedAgreement.title,
                    selectedAgreement.client.companyName,
                    selectedAgreement.status,
                    agreementContent
                  )
                }
              >
                <Download className="h-3.5 w-3.5 mr-1" /> PDF Print
              </Button>
              {selectedAgreement.status !== "SIGNED" && (
                <Button size="sm" onClick={handleSaveAgreementDraft}>
                  <Edit className="h-3.5 w-3.5 mr-1" /> Save Draft
                </Button>
              )}
            </div>
          </div>

          {/* Dictation Box */}
          {selectedAgreement.status !== "SIGNED" && (
            <div className="bg-slate-50 border p-3 rounded-lg flex items-center justify-between gap-3">
              <div className="flex-1 text-xs text-slate-500">
                <p className="font-semibold text-slate-700">
                  Voice-to-Agreement
                </p>
                <p>Dictate customized agreement terms directly into the draft below.</p>
              </div>
              <Button
                size="sm"
                variant={isListening ? "destructive" : "secondary"}
                onClick={startVoiceDictation}
                className="flex items-center gap-1.5 shrink-0"
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5 animate-pulse text-red-100" />
                    Listening...
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-primary" />
                    Dictate
                  </>
                )}
              </Button>
            </div>
          )}

          {/* AI Clause Generator */}
          {selectedAgreement.status !== "SIGNED" && (
            <div className="bg-violet-50/50 border border-violet-100 p-3 rounded-lg space-y-2 dark:bg-violet-950/10 dark:border-violet-900/40">
              <div className="flex justify-between items-center">
                <div className="text-xs">
                  <p className="font-semibold text-violet-800 dark:text-violet-400 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-violet-650" /> AI
                    Contract Clause Generator
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Draft complex custom legal terms based on raw prompts
                  </p>
                </div>
                <Badge className="bg-violet-100 text-violet-700 border-0 text-[8px] py-0 leading-none hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-400">
                  {aiProvider === "local" ? "Local Simulator" : aiProvider.toUpperCase()}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="e.g., SLA response within 48 hours and 10% refund if late"
                  value={aiClausePrompt}
                  onChange={(e) => setAiClausePrompt(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-slate-950"
                />
                <Button
                  size="sm"
                  onClick={handleAIClauseAdd}
                  disabled={isClauseGenerating || !aiClausePrompt.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs h-8 shrink-0 btn-micro-anim border-0"
                >
                  {isClauseGenerating ? "Drafting..." : "Add Clause"}
                </Button>
              </div>
            </div>
          )}

          {/* Content Editor */}
          <div className="space-y-1">
            <Label>Agreement Content</Label>
            <Textarea
              value={agreementContent}
              onChange={(e) => setAgreementContent(e.target.value)}
              disabled={selectedAgreement.status === "SIGNED"}
              rows={8}
              className="font-mono text-sm leading-relaxed"
            />
          </div>

          {/* E-Sign panel */}
          {selectedAgreement.status !== "SIGNED" ? (
            <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-bold text-sm">Draw Digital Signature</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Draw using your mouse, stylus, or touchpad
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-xs h-7 hover:bg-slate-200"
                  onClick={clearCanvas}
                >
                  Clear Canvas
                </Button>
              </div>

              <div className="border border-slate-200 bg-white rounded-lg overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={620}
                  height={120}
                  className="cursor-crosshair w-full block bg-white"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="signName">Type Full Name *</Label>
                  <Input
                    id="signName"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleSignAgreement}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 h-10 font-medium"
                  >
                    <Check className="h-4 w-4" /> Sign & Lock Agreement
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 text-emerald-800">
              <Check className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Signed Contract Lock</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  This contract is legally locked and signed. You can download the
                  completed document or export to PDF print.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setSelectedAgreement(null)}>
            Close Window
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
