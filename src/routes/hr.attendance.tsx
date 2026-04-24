import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { TeamAttendanceToday } from "@/components/TeamAttendanceToday";

export const Route = createFileRoute("/hr/attendance")({
  component: () => (
    <RequireRole allow={["hr"]}>
      <MobileShell title="Attendance" subtitle="Today's punches"><TeamAttendanceToday /></MobileShell>
    </RequireRole>
  ),
});
