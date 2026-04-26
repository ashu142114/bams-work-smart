import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Calendar, Users as UsersIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { WorkUpdateDialog } from "./WorkUpdateDialog";

type Status = "pending" | "in_progress" | "completed";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  deadline: string | null;
  team_id: string;
  created_by: string;
  created_at: string;
}
interface Member {
  id: string;
  full_name: string;
  team_id: string | null;
}
interface Team {
  id: string;
  name: string;
  leader_id: string | null;
}

interface Props {
  /** "leader" view shows tasks created by leader for their team(s); "employee" view shows tasks assigned to me */
  mode: "leader" | "employee" | "admin";
}

const statusVariant: Record<Status, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-primary/15 text-primary" },
  completed: { label: "Completed", className: "bg-success/15 text-success" },
};

function fmtDeadline(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function TasksList({ mode }: Props) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [assignees, setAssignees] = useState<Record<string, string[]>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [updateTaskId, setUpdateTaskId] = useState<string | null>(null);

  const cid = profile?.company_id;

  const load = async () => {
    if (!cid || !user) return;
    setLoading(true);
    const [{ data: t }, { data: m }, { data: tm }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,description,status,deadline,team_id,created_by,created_at")
        .eq("company_id", cid)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,full_name,team_id").eq("company_id", cid),
      supabase.from("teams").select("id,name,leader_id").eq("company_id", cid).order("name"),
    ]);
    setTasks((t as TaskRow[]) ?? []);
    setMembers((m as Member[]) ?? []);
    setTeams((tm as Team[]) ?? []);

    const taskIds = ((t as TaskRow[]) ?? []).map((x) => x.id);
    if (taskIds.length) {
      const { data: a } = await supabase
        .from("task_assignees")
        .select("task_id,user_id")
        .in("task_id", taskIds);
      const map: Record<string, string[]> = {};
      (a ?? []).forEach((row) => {
        (map[row.task_id] ??= []).push(row.user_id);
      });
      setAssignees(map);
    } else {
      setAssignees({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, user?.id, mode]);

  // Filter view per mode
  const visible = useMemo(() => {
    if (!user) return [];
    if (mode === "employee") {
      return tasks.filter((t) => (assignees[t.id] ?? []).includes(user.id));
    }
    if (mode === "leader") {
      const myTeamIds = teams.filter((t) => t.leader_id === user.id).map((t) => t.id);
      return tasks.filter((t) => myTeamIds.includes(t.team_id));
    }
    return tasks; // admin: all
  }, [tasks, assignees, teams, user, mode]);

  const handleStatusChange = async (taskId: string, newStatus: Status) => {
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Status updated");
      await load();
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Delete this task? This will also remove assignees and updates.")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) toast.error(error.message);
    else {
      toast.success("Task deleted");
      await load();
    }
  };

  const canCreate = mode === "leader" || mode === "admin";

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex justify-end">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New task
              </Button>
            </DialogTrigger>
            <CreateTaskDialog
              mode={mode}
              teams={teams}
              members={members}
              userId={user!.id}
              companyId={cid!}
              onClose={() => setCreateOpen(false)}
              onCreated={() => {
                setCreateOpen(false);
                void load();
              }}
            />
          </Dialog>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === "employee" ? "No tasks assigned yet." : "No tasks yet. Create one to get started."}
          </p>
        </div>
      ) : (
        visible.map((task) => {
          const team = teams.find((t) => t.id === task.team_id);
          const taskAssignees = (assignees[task.id] ?? [])
            .map((uid) => members.find((m) => m.id === uid)?.full_name)
            .filter(Boolean) as string[];
          const isAssignee = !!user && (assignees[task.id] ?? []).includes(user.id);
          const isLeader = !!user && team?.leader_id === user.id;
          return (
            <div key={task.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold leading-tight">{task.title}</h3>
                  {task.description && (
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.description}
                    </p>
                  )}
                </div>
                <Badge className={statusVariant[task.status].className} variant="secondary">
                  {statusVariant[task.status].label}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {team && <span>Team: {team.name}</span>}
                {task.deadline && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDeadline(task.deadline)}
                  </span>
                )}
                {taskAssignees.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon className="h-3 w-3" />
                    {taskAssignees.join(", ")}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {isAssignee && task.status !== "completed" && (
                  <>
                    <Select
                      value={task.status}
                      onValueChange={(v) => handleStatusChange(task.id, v as Status)}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="default" onClick={() => setUpdateTaskId(task.id)}>
                      Submit update
                    </Button>
                  </>
                )}
                {(isLeader || mode === "admin") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(task.id)}
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}

      {updateTaskId && (
        <WorkUpdateDialog
          taskId={updateTaskId}
          teamId={tasks.find((t) => t.id === updateTaskId)?.team_id ?? ""}
          onClose={() => setUpdateTaskId(null)}
          onSubmitted={() => {
            setUpdateTaskId(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateTaskDialog({
  mode,
  teams,
  members,
  userId,
  companyId,
  onClose,
  onCreated,
}: {
  mode: "leader" | "admin";
  teams: Team[];
  members: Member[];
  userId: string;
  companyId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const myTeams =
    mode === "leader" ? teams.filter((t) => t.leader_id === userId) : teams;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [teamId, setTeamId] = useState<string>(myTeams[0]?.id ?? "");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const teamMembers = members.filter((m) => m.team_id === teamId);

  const submit = async () => {
    if (!title.trim() || !teamId) {
      toast.error("Title and team are required");
      return;
    }
    const userIds = Object.entries(picked)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (userIds.length === 0) {
      toast.error("Pick at least one assignee");
      return;
    }
    setSaving(true);
    const { data: created, error } = await supabase
      .from("tasks")
      .insert({
        company_id: companyId,
        team_id: teamId,
        created_by: userId,
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !created) {
      setSaving(false);
      toast.error(error?.message ?? "Create failed");
      return;
    }
    const { error: aErr } = await supabase
      .from("task_assignees")
      .insert(userIds.map((uid) => ({ task_id: created.id, user_id: uid })));
    setSaving(false);
    if (aErr) {
      toast.error(aErr.message);
      return;
    }
    toast.success("Task created");
    setTitle("");
    setDescription("");
    setDeadline("");
    setPicked({});
    onCreated();
  };

  return (
    <DialogContent className="max-w-sm rounded-2xl">
      <DialogHeader>
        <DialogTitle>New task</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="t-title">Title</Label>
          <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-desc">Description</Label>
          <Textarea
            id="t-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Team</Label>
          <Select value={teamId} onValueChange={(v) => { setTeamId(v); setPicked({}); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {myTeams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-deadline">Deadline (optional)</Label>
          <Input
            id="t-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Assign to</Label>
          {teamMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No members in this team yet. Add some on the Team page.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1.5">
              {teamMembers.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={!!picked[m.id]}
                    onCheckedChange={(v) =>
                      setPicked((p) => ({ ...p, [m.id]: !!v }))
                    }
                  />
                  {m.full_name}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
