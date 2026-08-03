import { useState, useRef } from "react";
import { toast } from "sonner";
import { Landmark, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { signAgreement } from "@/lib/actions/agreements";
import type { AgreementData } from "./client-dashboard-types";

export function ClientAgreementDialog({
  selectedAgreement,
  setSelectedAgreement,
}: {
  selectedAgreement: AgreementData | null;
  setSelectedAgreement: (ag: AgreementData | null) => void;
}) {
  const [signName, setSignName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  if (!selectedAgreement) return null;

  // E-Sign signature canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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

  // Sign contract action
  const handleClientSign = async () => {
    if (!selectedAgreement) return;
    if (!signName.trim()) {
      toast.error("Please type your name to sign the document.");
      return;
    }

    const r = await signAgreement(selectedAgreement.id, signName.trim());
    if (r.ok) {
      toast.success("Document signed successfully!");
      setSelectedAgreement(null);
      setSignName("");
      window.location.reload();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Dialog open={!!selectedAgreement} onOpenChange={(open) => { if (!open) setSelectedAgreement(null); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2 text-white">
            <Landmark className="h-5 w-5 text-primary" />
            Agreement Contract
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Please review terms below and draw your signature to execute the agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <h3 className="font-semibold text-slate-200 border-b border-slate-800 pb-2">{selectedAgreement.title}</h3>

          {/* Agreement Content */}
          <div className="space-y-1">
            <Textarea
              value={selectedAgreement.content}
              readOnly
              rows={8}
              className="font-mono text-sm leading-relaxed bg-slate-950 border-slate-800 text-slate-300"
            />
          </div>

          {/* Signature Board */}
          {selectedAgreement.status !== "SIGNED" ? (
            <div className="border border-slate-800 bg-slate-950 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="font-bold text-sm text-slate-200">Draw Client Signature</Label>
                  <p className="text-[10px] text-slate-500">Touchpad or cursor input</p>
                </div>
                <Button size="xs" variant="ghost" className="text-xs h-7 hover:bg-slate-900 text-slate-400" onClick={clearCanvas}>
                  Clear
                </Button>
              </div>

              <div className="border border-slate-800 bg-white rounded-lg overflow-hidden flex items-center justify-center">
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
                  <Label htmlFor="signName" className="text-slate-300">Type Authorized Representative Name *</Label>
                  <Input
                    id="signName"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder="Sarah Johnson"
                    className="bg-slate-900 border-slate-800 text-white"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleClientSign} className="w-full bg-primary hover:bg-primary/95 text-white flex items-center justify-center gap-1.5 h-10 font-medium">
                    <Check className="h-4 w-4" /> Sign Contract
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3 text-emerald-400">
              <Check className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-300">Signed Contract Lock</p>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  This contract is legally locked and signed.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setSelectedAgreement(null)} className="text-slate-400 hover:text-white">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
