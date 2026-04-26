import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Check, X, Pause, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Status = "pending_review" | "approved" | "rejected" | "on_hold";

interface UpdateRow {
  id: string;
  task_id: string;
  user_id: string;
  team_id: string;
  description: string;
  image_url: string | null;
  status: Status;
  review_note: string | null;
  created_at: string;
}
interface TaskMini { id: string; title: string }
interface UserMini { id: string; full_name: string }

const statusBadge: Record<Status, { label: string; className: string }> = {
  pending_review: { label: "Pending Review", className: "bg-warning/15 text-warning-foreground" },
  approved: { label: "Approved", className: "bg-success/15 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
  on_hold: { label: "On Hold", className: "bg-muted text-muted-foreground" },
};

export function WorkUpdateReview() {
  const { user, profile, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [tasks, setTasks] = useState<Record<string, TaskMini>>({});
  const [users, setUsers] = useState<Record<string, UserMini>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const cid = profile?.company_id;

  const load = async () => {
    if (!cid || !user) return;
    setLoading(true);

    // Determine which teams I lead (or all if admin)
    let teamFilter: string[] | null = null;
    if (role === "leader") {
      const { data: t } = await supabase
        .from("teams")
        .select("id")
        .eq("company_id", cid)
        .eq("leader_id", user.id);
      teamFilter = (t ?? []).map((x) => x.id);
      if (teamFilter.length === 0) {
        setUpdates([]);
        setLoading(false);
        return;
      }
    }

    let q = supabase
      .from("work_updates")
      .select("id,task_id,user_id,team_id,description,image_url,status,review_note,created_at")
      .eq("company_id", cid)
      .order("created_at", { ascending: false });
    if (teamFilter) q = q.in("team_id", teamFilter);

    const { data: u, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (u as UpdateRow[]) ?? [];
    setUpdates(rows);

    const taskIds = [...new Set(rows.map((r) => r.task_id))];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const [{ data: ts }, { data: us }] = await Promise.all([
      taskIds.length
        ? supabase.from("tasks").select("id,title").in("id", taskIds)
        : Promise.resolve({ data: [] as TaskMini[] }),
      userIds.length
        ? supabase.from("profiles").select("id,full_name").in("id", userIds)
        : Promise.resolve({ data: [] as UserMini[] }),
    ]);
    const tMap: Record<string, TaskMini> = {};
    (ts ?? []).forEach((t) => (tMap[t.id] = t as TaskMini));
    const uMap: Record<string, UserMini> = {};
    (us ?? []).forEach((p) => (uMap[p.id] = p as UserMini));
    setTasks(tMap);
    setUsers(uMap);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, user?.id, role]);

  const review = async (row: UpdateRow, decision: Status, note?: string) => {
    if (!user) return;
    setBusy(row.id);
    const { error } = await supabase
      .from("work_updates")
      .update({
        status: decision,
        review_note: note ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      setBusy(null);
      return;
    }

    // Cascade: approved → task completed; rejected → in_progress; on_hold → no change
    if (decision === "approved") {
      await supabase.from("tasks").update({ status: "completed" }).eq("id", row.task_id);
    } else if (decision === "rejected") {
      await supabase.from("tasks").update({ status: "in_progress" }).eq("id", row.task_id);
    }

    toast.success(`Update ${decision.replace("_", " ")}`);
    setBusy(null);
    await load();
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">No work updates to review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {updates.map((u) => {
        const task = tasks[u.task_id];
        const author = users[u.user_id];
        return (
          <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold leading-tight truncate">
                  {task?.title ?? "Task"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {author?.full_name ?? "Unknown"} ·{" "}
                  <Calendar className="inline h-3 w-3 -mt-0.5" />{" "}
                  {new Date(u.created_at).toLocaleString()}
                </p>
              </div>
              <Badge variant="secondary" className={statusBadge[u.status].className}>
                {statusBadge[u.status].label}
              </Badge>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{u.description}</p>
            {u.image_url && (
              <a href={u.image_url} target="_blank" rel="noreferrer">
                <img
                  src={u.image_url}
                  alt="Work update"
                  className="mt-2 max-h-48 w-full object-cover rounded-lg border border-border"
                />
              </a>
            )}
            {u.review_note && (
              <p className="mt-2 text-xs text-muted-foreground italic">
                Note: {u.review_note}
              </p>
            )}

            {u.status === "pending_review" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => review(u, "approved")}
                  disabled={busy === u.id}
                >
                  <Check className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const note = prompt("Reason for rejection (optional)") ?? undefined;
                    void review(u, "rejected", note);
                  }}
                  disabled={busy === u.id}
                >
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const note = prompt("Hold reason (optional)") ?? undefined;
                    void review(u, "on_hold", note);
                  }}
                  disabled={busy === u.id}
                >
                  <Pause className="h-4 w-4 mr-1" /> Hold
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
