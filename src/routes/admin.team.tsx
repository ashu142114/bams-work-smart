import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Users, UserPlus, UserMinus, Crown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
  leader_id: string | null;
}
interface Member {
  id: string;
  full_name: string;
  team_id: string | null;
}
interface RoleRow {
  user_id: string;
  role: "admin" | "hr" | "leader" | "employee";
}

export const Route = createFileRoute("/admin/team")({
  component: () => (
    <RequireRole allow={["admin"]}>
      <AdminTeamPage />
    </RequireRole>
  ),
});

function AdminTeamPage() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyTeam, setBusyTeam] = useState<string | null>(null);

  const cid = profile?.company_id;

  const load = async () => {
    if (!cid) return;
    const [{ data: t }, { data: m }, { data: r }] = await Promise.all([
      supabase.from("teams").select("id,name,leader_id").eq("company_id", cid).order("name"),
      supabase.from("profiles").select("id,full_name,team_id").eq("company_id", cid).order("full_name"),
      supabase.from("user_roles").select("user_id,role").eq("company_id", cid),
    ]);
    setTeams((t as Team[]) ?? []);
    setMembers((m as Member[]) ?? []);
    setRoles((r as RoleRow[]) ?? []);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  const handleCreateTeam = async () => {
    if (!cid || !newTeamName.trim()) return;
    setCreating(true);
    const { error } = await supabase
      .from("teams")
      .insert({ company_id: cid, name: newTeamName.trim() });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Team created");
    setNewTeamName("");
    setCreateOpen(false);
    await load();
  };

  const setLeader = async (teamId: string, leaderId: string | null) => {
    setBusyTeam(teamId);
    const { error } = await supabase
      .from("teams")
      .update({ leader_id: leaderId })
      .eq("id", teamId);
    if (error) {
      toast.error(error.message);
    } else {
      // If a member is being made leader, ensure they have leader role
      if (leaderId) {
        const has = roles.some((r) => r.user_id === leaderId && r.role === "leader");
        if (!has) {
          // upsert leader role (admin can manage roles within company)
          await supabase
            .from("user_roles")
            .insert({ user_id: leaderId, role: "leader", company_id: cid! });
        }
      }
      toast.success("Team leader updated");
      await load();
    }
    setBusyTeam(null);
  };

  const assignMember = async (userId: string, teamId: string | null) => {
    const { error } = await supabase.from("profiles").update({ team_id: teamId }).eq("id", userId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(teamId ? "Added to team" : "Removed from team");
      await load();
    }
  };

  if (teams === null) {
    return (
      <MobileShell title="Teams">
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </MobileShell>
    );
  }

  const unassigned = members.filter((m) => !m.team_id);

  return (
    <MobileShell
      title="Teams"
      subtitle="Manage teams, leaders & members"
      right={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Create team">
              <Plus className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>New team</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="tname">Team name</Label>
              <Input
                id="tname"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g. Epsilon"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={creating || !newTeamName.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-3">
        {teams.map((team) => {
          const teamMembers = members.filter((m) => m.team_id === team.id);
          const leader = members.find((m) => m.id === team.leader_id);
          const leaderCandidates = teamMembers; // pick from team members
          return (
            <div key={team.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">{team.name}</h3>
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    <Users className="h-3 w-3" /> {teamMembers.length} member
                    {teamMembers.length === 1 ? "" : "s"}
                  </p>
                </div>
                {busyTeam === team.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {/* Leader picker */}
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Team Leader</Label>
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-warning" />
                  <Select
                    value={team.leader_id ?? "none"}
                    onValueChange={(v) => setLeader(team.id, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="No leader" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No leader —</SelectItem>
                      {leaderCandidates.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {leader && (
                  <p className="text-xs text-muted-foreground">Leader: {leader.full_name}</p>
                )}
              </div>

              {/* Members */}
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Members</Label>
                {teamMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No members yet</p>
                ) : (
                  <ul className="space-y-1">
                    {teamMembers.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <span className="text-sm">{m.full_name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove from team"
                          onClick={() => assignMember(m.id, null)}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add member */}
                {unassigned.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    <Select onValueChange={(uid) => assignMember(uid, team.id)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Add member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {unassigned.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {unassigned.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Unassigned ({unassigned.length})
            </p>
            <ul className="space-y-1">
              {unassigned.map((m) => (
                <li key={m.id} className="text-sm text-muted-foreground">
                  {m.full_name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MobileShell>
  );
}
