import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Loader2,
  ArrowLeft,
  Check,
  X,
  Paperclip,
  MessageSquare,
  Send,
  Calendar,
  User as UserIcon,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { StatusBadge, type UiStatus } from "./ApprovalList";

type RawStatus = "pending_review" | "approved" | "rejected" | "on_hold";

const toUi = (s: RawStatus): UiStatus =>
  s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending";

interface Detail {
  id: string;
  task_id: string;
  user_id: string;
  team_id: string;
  description: string;
  image_url: string | null;
  status: RawStatus;
  review_note: string | null;
  created_at: string;
  taskTitle: string;
  taskDescription: string | null;
  assigneeName: string;
  assigneeEmail: string;
}

interface Comment {
  id: string;
  author: string;
  text: string;
  at: string;
}

export function ApprovalDetail({ id }: { id: string }) {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);

  const canReview = role === "admin" || role === "leader" || role === "hr";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: u, error } = await supabase
        .from("work_updates")
        .select(
          "id,task_id,user_id,team_id,description,image_url,status,review_note,created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !u) {
        setLoading(false);
        return;
      }
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase.from("tasks").select("title,description").eq("id", u.task_id).maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", u.user_id)
          .maybeSingle(),
      ]);
      setData({
        ...(u as Omit<Detail, "taskTitle" | "taskDescription" | "assigneeName" | "assigneeEmail">),
        taskTitle: t?.title ?? "Untitled task",
        taskDescription: t?.description ?? null,
        assigneeName: p?.full_name ?? "Unknown",
        assigneeEmail: p?.email ?? "",
      });
      setLoading(false);
    };
    void load();
  }, [id]);

  const review = async (decision: "approved" | "rejected") => {
    if (!user || !data) return;
    setBusy(decision === "approved" ? "approve" : "reject");
    const { error } = await supabase
      .from("work_updates")
      .update({
        status: decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) {
      toast.error(error.message);
      setBusy(null);
      return;
    }
    if (decision === "approved") {
      await supabase.from("tasks").update({ status: "completed" }).eq("id", data.task_id);
    } else {
      await supabase.from("tasks").update({ status: "in_progress" }).eq("id", data.task_id);
    }
    toast.success(`Update ${decision}`);
    setData({ ...data, status: decision });
    setBusy(null);
  };

  const addComment = () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        author: profile?.full_name ?? "You",
        text: trimmed,
        at: new Date().toISOString(),
      },
    ]);
    setComment("");
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
        <p className="text-sm text-muted-foreground">Task not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate({ to: "/approvals" })}>
          Back to approvals
        </Button>
      </div>
    );
  }

  const ui = toUi(data.status);

  return (
    <div className="space-y-4">
      <Link
        to="/approvals"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">{data.taskTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Submitted {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={ui} />
        </div>

        <div className="mt-4 rounded-xl bg-muted/40 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
            Description
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap">
            {data.taskDescription || data.description}
          </p>
        </div>

        {/* Assignee */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center font-semibold">
            {data.assigneeName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Assigned to
            </p>
            <p className="text-sm font-medium truncate">{data.assigneeName}</p>
            {data.assigneeEmail && (
              <p className="text-xs text-muted-foreground truncate">{data.assigneeEmail}</p>
            )}
          </div>
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Submission body */}
        {data.description && data.description !== data.taskDescription && (
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Work update
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{data.description}</p>
          </div>
        )}
      </div>

      {/* Attachments */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <header className="flex items-center gap-2 mb-3">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Attachments</h3>
        </header>
        {data.image_url ? (
          <a
            href={data.image_url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl overflow-hidden border border-border"
          >
            <img src={data.image_url} alt="Attachment" className="w-full max-h-72 object-cover" />
          </a>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground/60" />
            <p className="mt-2 text-xs text-muted-foreground">No attachments uploaded.</p>
          </div>
        )}
      </section>

      {/* Comments */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <header className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Comments</h3>
        </header>

        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No comments yet. Be the first to comment.</p>
        ) : (
          <ul className="space-y-3 mb-3">
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center text-xs font-semibold shrink-0">
                  {c.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 rounded-xl bg-muted/40 px-3 py-2">
                  <p className="text-xs font-medium">
                    {c.author}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {new Date(c.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </p>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment..."
            rows={2}
            className="resize-none rounded-xl"
          />
          <Button size="icon" onClick={addComment} disabled={!comment.trim()} className="rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Sticky action bar */}
      {canReview && ui === "pending" && (
        <div className="sticky bottom-24 z-20">
          <div className="rounded-2xl border border-border bg-card/95 backdrop-blur p-3 shadow-soft flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
              onClick={() => review("rejected")}
              disabled={busy !== null}
            >
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject
            </Button>
            <Button
              className="flex-1 bg-success text-success-foreground hover:bg-success/90 rounded-xl"
              onClick={() => review("approved")}
              disabled={busy !== null}
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve
            </Button>
          </div>
        </div>
      )}

      {ui !== "pending" && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          This task has been <span className="font-medium">{ui}</span>. No further action needed.
        </div>
      )}
    </div>
  );
}
