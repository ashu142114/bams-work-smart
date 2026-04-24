import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Users } from "lucide-react";

interface Row {
  id: string;
  user_id: string;
  punch_in_at: string;
  punch_out_at: string | null;
  status: string;
}

interface ProfileLite {
  id: string;
  full_name: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TeamAttendanceToday() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [people, setPeople] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile?.company_id) return;
    const companyId = profile.company_id;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: att }, { data: profiles }] = await Promise.all([
        supabase
          .from("attendance")
          .select("id,user_id,punch_in_at,punch_out_at,status")
          .eq("company_id", companyId)
          .eq("date", today)
          .order("punch_in_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name").eq("company_id", companyId),
      ]);
      setRows((att as Row[]) ?? []);
      const map: Record<string, string> = {};
      (profiles as ProfileLite[] | null)?.forEach((p) => (map[p.id] = p.full_name));
      setPeople(map);
    })();
  }, [profile?.company_id]);

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
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No punches today</p>
        <p className="text-xs text-muted-foreground mt-1">Activity will appear in real time</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between shadow-soft">
          <div>
            <p className="text-sm font-semibold">{people[r.user_id] ?? "Unknown"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              In {fmtTime(r.punch_in_at)} {r.punch_out_at ? `· Out ${fmtTime(r.punch_out_at)}` : "· working"}
            </p>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              r.status === "late"
                ? "bg-warning/15 text-warning-foreground"
                : "bg-success/15 text-success"
            }`}
          >
            {r.status === "late" ? "LATE" : "PRESENT"}
          </span>
        </li>
      ))}
    </ul>
  );
}
