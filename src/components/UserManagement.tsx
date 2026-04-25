import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Pencil, Trash2, Eye, EyeOff, Search, Users as UsersIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
}
interface UserRow {
  id: string;
  full_name: string;
  email: string;
  team_id: string | null;
  monthly_salary: number;
  role: AppRole | null;
}

const ALL_ROLES: AppRole[] = ["admin", "hr", "leader", "employee"];
const NO_TEAM = "__none__";

export function UserManagement({ actor }: { actor: "admin" | "hr" }) {
  const { profile, user } = useAuth();
  const isAdmin = actor === "admin";

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");

  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const load = async () => {
    if (!profile?.company_id) return;
    setError(null);
    try {
      const cid = profile.company_id;
      const [{ data: t, error: tErr }, { data: p, error: pErr }, { data: r, error: rErr }] = await Promise.all([
        supabase.from("teams").select("id,name").eq("company_id", cid).order("name"),
        supabase
          .from("profiles")
          .select("id,full_name,email,team_id,monthly_salary")
          .eq("company_id", cid)
          .order("full_name"),
        supabase.from("user_roles").select("user_id,role").eq("company_id", cid),
      ]);
      if (tErr || pErr || rErr) throw tErr || pErr || rErr;
      setTeams((t as Team[]) ?? []);
      const order: AppRole[] = ["admin", "hr", "leader", "employee"];
      const roleByUser = new Map<string, AppRole>();
      ((r as Array<{ user_id: string; role: AppRole }>) ?? []).forEach((row) => {
        const cur = roleByUser.get(row.user_id);
        if (!cur || order.indexOf(row.role) < order.indexOf(cur)) {
          roleByUser.set(row.user_id, row.role);
        }
      });
      const merged: UserRow[] = ((p as Omit<UserRow, "role">[]) ?? []).map((u) => ({
        ...u,
        role: roleByUser.get(u.id) ?? null,
      }));
      setUsers(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const hasFilters = search.trim() !== "" || filterRole !== "all" || filterTeam !== "all";
  const clearFilters = () => {
    setSearch("");
    setFilterRole("all");
    setFilterTeam("all");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      if (filterTeam !== "all") {
        if (filterTeam === NO_TEAM) {
          if (u.team_id) return false;
        } else if (u.team_id !== filterTeam) return false;
      }
      return true;
    });
  }, [users, search, filterRole, filterTeam]);

  if (users === null) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button size="sm" onClick={() => setEditing("new")} className="h-10 px-3">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Team" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All teams</SelectItem>
            <SelectItem value={NO_TEAM}>No team</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <UsersIcon className="h-7 w-7 text-primary" />
          </div>
          <p className="text-base font-semibold mb-1">
            {hasFilters ? "No matches found" : "No users yet"}
          </p>
          <p className="text-sm text-muted-foreground max-w-xs mb-4">
            {hasFilters
              ? "Try adjusting your search or filters to find who you're looking for."
              : "Your team is empty. Add your first user or refresh to check again."}
          </p>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((u) => {
            const canEdit = isAdmin || u.role === "employee";
            const canDelete = isAdmin && u.id !== user?.id;
            return (
              <li
                key={u.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {u.role ?? "no role"}
                      </span>
                      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {teamName(u.team_id)}
                      </span>
                      {isAdmin && (
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          ₹{Number(u.monthly_salary).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(u)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <UserFormDialog
          actor={actor}
          teams={teams}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <b>{deleteTarget?.full_name}</b> and revoke their access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                const { data, error } = await supabase.functions.invoke("manage-users", {
                  body: { action: "delete", id },
                });
                if (error || (data && data.error)) {
                  toast.error((data && data.error) || error?.message || "Delete failed");
                } else {
                  toast.success("User deleted");
                  load();
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserFormDialog({
  actor,
  existing,
  teams,
  onClose,
  onSaved,
}: {
  actor: "admin" | "hr";
  existing: UserRow | null;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isAdmin = actor === "admin";
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.full_name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<AppRole>(existing?.role ?? "employee");
  const [teamId, setTeamId] = useState<string>(existing?.team_id ?? NO_TEAM);
  const [salary, setSalary] = useState<string>(
    existing ? String(existing.monthly_salary ?? 0) : "0",
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allowedRoles: AppRole[] = isAdmin ? ALL_ROLES : ["employee"];

  const validate = () => {
    if (!name.trim()) return "Name is required";
    if (!email.trim()) return "Email is required";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Invalid email";
    if (!isEdit && password.length < 6) return "Password must be at least 6 characters";
    if (isEdit && password && password.length < 6) return "Password must be at least 6 characters";
    if (isAdmin) {
      const s = Number(salary);
      if (Number.isNaN(s) || s < 0) return "Salary must be a positive number";
    }
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        action: isEdit ? "update" : "create",
        name: name.trim(),
        email: email.trim().toLowerCase(),
        team_id: teamId === NO_TEAM ? null : teamId,
      };
      if (isEdit) payload.id = existing!.id;
      if (!isEdit || password) payload.password = password;
      if (isAdmin) {
        payload.role = role;
        payload.salary = Number(salary);
      } else if (!isEdit) {
        payload.role = "employee";
      }
      const { data, error } = await supabase.functions.invoke("manage-users", { body: payload });
      if (error || (data && data.error)) {
        setErr((data && data.error) || error?.message || "Save failed");
        return;
      }
      toast.success(isEdit ? "User updated" : "User created");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Add user"}</DialogTitle>
          <DialogDescription>
            {isAdmin ? "Manage role, team and salary." : "HR can add or edit Employees only."}
          </DialogDescription>
        </DialogHeader>

        {err && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
            {err}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="u-name">Name</Label>
            <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="u-pwd">{isEdit ? "New password (optional)" : "Password"}</Label>
            <div className="relative">
              <Input
                id="u-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Leave blank to keep" : "Min 6 chars"}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                aria-label={showPwd ? "Hide" : "Show"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)} disabled={!isAdmin}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEAM}>No team</SelectItem>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isAdmin && (
            <div>
              <Label htmlFor="u-sal">Monthly salary (₹)</Label>
              <Input
                id="u-sal"
                type="number"
                inputMode="numeric"
                min={0}
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
