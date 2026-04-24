import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { PunchCard } from "@/components/PunchCard";
import { AttendanceHistory } from "@/components/AttendanceHistory";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/employee/home")({
  component: () => (
    <RequireRole allow={["employee"]}>
      <EmployeeHome />
    </RequireRole>
  ),
});

function EmployeeHome() {
  const { profile, signOut } = useAuth();
  return (
    <MobileShell
      title={`Hi, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
      subtitle="Employee · BAMS"
      right={
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      }
    >
      <PunchCard />
      <h2 className="mt-8 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent</h2>
      <AttendanceHistory />
    </MobileShell>
  );
}
