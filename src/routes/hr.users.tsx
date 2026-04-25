import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { UserManagement } from "@/components/UserManagement";

export const Route = createFileRoute("/hr/users")({
  component: () => (
    <RequireRole allow={["hr"]}>
      <MobileShell title="Users" subtitle="Manage employees">
        <UserManagement actor="hr" />
      </MobileShell>
    </RequireRole>
  ),
});
