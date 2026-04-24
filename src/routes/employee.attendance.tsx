import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { AttendanceHistory } from "@/components/AttendanceHistory";

export const Route = createFileRoute("/employee/attendance")({
  component: () => (
    <RequireRole allow={["employee"]}>
      <MobileShell title="Attendance history" subtitle="Last 30 days">
        <AttendanceHistory />
      </MobileShell>
    </RequireRole>
  ),
});
