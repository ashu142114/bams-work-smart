import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { UserManagement } from "@/components/UserManagement";

export const Route = createFileRoute("/admin/users")({
  component: () => (
    <RequireRole allow={["admin"]}>
      <MobileShell title="Users" subtitle="Manage your workforce">
        <UserManagement actor="admin" />
      </MobileShell>
    </RequireRole>
  ),
});
