import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Calendar, ChevronRight, Search, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type RawStatus = "pending_review" | "approved" | "rejected" | "on_hold";
export type UiStatus = "pending" | "approved" | "rejected";

const toUi = (s: RawStatus): UiStatus =>
  s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending";

const statusStyles: Record<UiStatus, { label: string; chip: string; dot: string; ring: string; Icon: typeof Clock3 }> = {
  pending: {
    label: "Pending",
    chip: "bg-warning/15 text-warning-foreground border border-warning/30",
    dot: "bg-warning",
    ring: "ring-warning/30",
    Icon: Clock3,
  },
  approved: {
    label: "Approved",
    chip: "bg-success/15 text-success border border-success/30",
    dot: "bg-success",
    ring: "ring-success/30",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    chip: "bg-destructive/15 text-destructive border border-destructive/30",
    dot: "bg-destructive",
    ring: "ring-destructive/30",
    Icon: XCircle,
  },
};

export function StatusBadge({ status }: { status: UiStatus }) {
  const s = statusStyles[status];
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.chip}`}
    >
      <Icon className="h-3 w-3" />
      {s.label}
    </span>
  );
}

interface Row {
  id: string;
  task_id: string;
  user_id: string;
  team_id: string;
  description: string;
  image_url: string | null;
  status: RawStatus;
  created_at: string;
  taskTitle: string;
  assigneeName: string;
}

export function ApprovalList() {
  const { user, profile, role } = useAuth();
  const cid = profile?.company_id;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<"all" | UiStatus>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!cid || !user) return;
      setLoading(true);

      let teamFilter: string[] | null = null;
      if (role === "leader") {
        const { data: t } = await supabase
          .from("teams")
          .select("id")
          .eq("company_id", cid)
          .eq("leader_id", user.id);
        teamFilter = (t ?? []).map((x) => x.id);
        if (teamFilter.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("work_updates")
        .select("id,task_id,user_id,team_id,description,image_url,status,created_at")
        .eq("company_id", cid)
        .order("created_at", { ascending: false });
      if (teamFilter) query = query.in("team_id", teamFilter);
      const { data: u } = await query;
      const list = u ?? [];

      const taskIds = [...new Set(list.map((r) => r.task_id))];
      const userIds = [...new Set(list.map((r) => r.user_id))];
      const [{ data: ts }, { data: us }] = await Promise.all([
        taskIds.length
          ? supabase.from("tasks").select("id,title").in("id", taskIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        userIds.length
          ? supabase.from("profiles").select("id,full_name").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      ]);
      const tMap = new Map((ts ?? []).map((t) => [t.id, t.title]));
      const uMap = new Map((us ?? []).map((p) => [p.id, p.full_name]));

      setRows(
        list.map((r) => ({
          ...(r as Omit<Row, "taskTitle" | "assigneeName">),
          taskTitle: tMap.get(r.task_id) ?? "Untitled task",
          assigneeName: uMap.get(r.user_id) ?? "Unknown",
        })),
      );
      setLoading(false);
    };
    void load();
  }, [cid, user, role]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, approved: 0, rejected: 0 };
    rows.forEach((r) => {
      c[toUi(r.status)] += 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab !== "all" && toUi(r.status) !== tab) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        if (
          !r.taskTitle.toLowerCase().includes(needle) &&
          !r.assigneeName.toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
  }, [rows, tab, q]);

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { id: typeof tab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "approved", label: "Approved", count: counts.approved },
    { id: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search task or assignee..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? "bg-primary-foreground/20" : "bg-muted"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">No tasks match this view.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const ui = toUi(r.status);
            const s = statusStyles[ui];
            return (
              <li key={r.id}>
                <Link
                  to="/approvals/$id"
                  params={{ id: r.id }}
                  className={`group block rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md ring-1 ring-transparent hover:${s.ring}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${s.dot} ring-4 ring-offset-0 ${s.ring}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold leading-tight truncate">
                          {r.taskTitle}
                        </h3>
                        <StatusBadge status={ui} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {r.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary font-semibold text-[10px]">
                            {r.assigneeName.charAt(0).toUpperCase()}
                          </span>
                          {r.assigneeName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(r.created_at).toLocaleDateString()}
                          <ChevronRight className="h-3 w-3 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
