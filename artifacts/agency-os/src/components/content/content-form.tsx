"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createContentPost } from "@/lib/actions/content";
import type { ActionResult } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/forms/submit-button";

import { getTodayDateString } from "./content-constants";

const initial: ActionResult = { ok: false, error: "" };

export function ContentForm({
  clients,
  assignees,
  onSuccess,
  defaultDate,
}: {
  clients: { id: string; companyName: string }[];
  assignees: { id: string; name: string }[];
  onSuccess: () => void;
  defaultDate?: string;
}) {
  const [state, formAction] = useActionState(createContentPost, initial);
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "linkedin", "youtube"]);

  useEffect(() => {
    if (state.ok) { onSuccess(); toast.success("Content created"); }
    else if (!state.ok && state.error) toast.error(state.error);
  }, [state, onSuccess]);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2"><Label>Client *</Label>
        <select name="clientId" required className="flex h-9 w-full rounded-md border px-3 text-sm bg-background">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </select>
      </div>
      <div className="space-y-2"><Label>Title *</Label><Input name="title" required /></div>
      <div className="space-y-2"><Label>Caption</Label><Textarea name="caption" rows={2} /></div>
      <div className="space-y-2"><Label>Script</Label><Textarea name="script" rows={3} /></div>
      <div className="space-y-2"><Label>Assignee</Label>
        <select name="assigneeId" className="flex h-9 w-full rounded-md border px-3 text-sm bg-background">
          <option value="">None</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Schedule</Label>
        <Input name="scheduledAt" type="datetime-local" min={`${getTodayDateString()}T00:00`} defaultValue={defaultDate} />
      </div>
      <div className="space-y-2">
        <Label>Publish Platforms</Label>
        <div className="flex gap-4 pt-1">
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={platforms.includes("instagram")}
              onChange={() => togglePlatform("instagram")}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            Instagram
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={platforms.includes("linkedin")}
              onChange={() => togglePlatform("linkedin")}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            LinkedIn
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={platforms.includes("youtube")}
              onChange={() => togglePlatform("youtube")}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            YouTube
          </label>
        </div>
      </div>
      <input type="hidden" name="status" value="IDEA" />
      <input type="hidden" name="platforms" value={JSON.stringify(platforms)} />
      <SubmitButton label="Add content" />
    </form>
  );
}
