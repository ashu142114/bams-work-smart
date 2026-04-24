import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { PunchCard } from "@/components/PunchCard";
import { TeamAttendanceToday } from "@/components/TeamAttendanceToday";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/hr/home")({
  component: () => (
    <RequireRole allow={["hr"]}>
      <HrHome />
    </RequireRole>
  ),
});

function HrHome() {
  const { profile, signOut } = useAuth();
  return (
    <MobileShell
      title={`Hi, ${profile?.full_name?.split(" ")[0] ?? "HR"}`}
      subtitle="HR · BAMS"
      right={<Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out"><LogOut className="h-5 w-5" /></Button>}
    >
      <PunchCard />
      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today across company</h2>
      <TeamAttendanceToday />
    </MobileShell>
  );
}
