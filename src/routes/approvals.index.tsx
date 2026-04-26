import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { ApprovalList } from "@/components/ApprovalList";

export const Route = createFileRoute("/approvals/")({
  component: () => (
    <RequireRole allow={["admin", "hr", "leader"]}>
      <MobileShell title="Approvals" subtitle="Review and approve task updates">
        <ApprovalList />
      </MobileShell>
    </RequireRole>
  ),
});
