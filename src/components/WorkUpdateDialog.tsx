import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

export function WorkUpdateDialog({
  taskId,
  teamId,
  onClose,
  onSubmitted,
}: {
  taskId: string;
  teamId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { user, profile } = useAuth();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!description.trim()) {
      toast.error("Please describe what you did");
      return;
    }
    if (!user || !profile?.company_id || !teamId) return;
    setSubmitting(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const path = `${user.id}/${taskId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("work-updates")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("work-updates")
          .createSignedUrl(path, 60 * 60 * 24 * 365); // 1y
        image_url = signed?.signedUrl ?? null;
      }
      const { error } = await supabase.from("work_updates").insert({
        task_id: taskId,
        user_id: user.id,
        company_id: profile.company_id,
        team_id: teamId,
        description: description.trim(),
        image_url,
      });
      if (error) throw error;
      toast.success("Update submitted for review");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Submit work update</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wu-desc">What did you accomplish?</Label>
            <Textarea
              id="wu-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your progress…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wu-img">Photo (optional)</Label>
            <div className="flex items-center gap-2">
              <input
                id="wu-img"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("wu-img")?.click()}
              >
                <ImageIcon className="h-4 w-4 mr-1" /> Choose photo
              </Button>
              {file && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
                  {file.name}
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-1 inline-flex"
                    aria-label="Clear photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
