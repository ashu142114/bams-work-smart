import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, ClipboardList } from "lucide-react";

interface Row {
  id: string;
  date: string;
  punch_in_at: string;
  punch_out_at: string | null;
  status: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(fromIso: string, toIso: string | null) {
  if (!toIso) return "—";
  const sec = Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function AttendanceHistory() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("attendance")
      .select("id,date,punch_in_at,punch_out_at,status")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [user?.id]);

  if (rows === null) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No attendance yet</p>
        <p className="text-xs text-muted-foreground mt-1">Your punches will appear here</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-soft"
        >
          <div>
            <p className="text-sm font-semibold">
              {new Date(r.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtTime(r.punch_in_at)} → {r.punch_out_at ? fmtTime(r.punch_out_at) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">{fmtDuration(r.punch_in_at, r.punch_out_at)}</p>
            <span
              className={`mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                r.status === "late"
                  ? "bg-warning/15 text-warning-foreground"
                  : "bg-success/15 text-success"
              }`}
            >
              {r.status === "late" ? "LATE" : "PRESENT"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
