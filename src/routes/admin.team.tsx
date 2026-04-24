import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Users } from "lucide-react";

interface Team {
  id: string;
  name: string;
}
interface Member {
  id: string;
  full_name: string;
  team_id: string | null;
}

export const Route = createFileRoute("/admin/team")({
  component: () => (
    <RequireRole allow={["admin", "hr", "leader"]}>
      <TeamPage />
    </RequireRole>
  ),
});

function TeamPage() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!profile?.company_id) return;
    const cid = profile.company_id;
    (async () => {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from("teams").select("id,name").eq("company_id", cid).order("name"),
        supabase.from("profiles").select("id,full_name,team_id").eq("company_id", cid),
      ]);
      setTeams((t as Team[]) ?? []);
      setMembers((m as Member[]) ?? []);
    })();
  }, [profile?.company_id]);

  if (teams === null) {
    return (
      <MobileShell title="Teams">
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title="Teams" subtitle="Your company structure">
      <div className="space-y-3">
        {teams.map((team) => {
          const list = members.filter((m) => m.team_id === team.id);
          return (
            <div key={team.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{team.name}</h3>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Users className="h-3 w-3" /> {list.length}
                </span>
              </div>
              {list.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No members yet</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {list.map((m) => (
                    <li key={m.id} className="text-sm">{m.full_name}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </MobileShell>
  );
}
