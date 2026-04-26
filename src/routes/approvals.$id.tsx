import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { ApprovalDetail } from "@/components/ApprovalDetail";

export const Route = createFileRoute("/approvals/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  return (
    <RequireRole allow={["admin", "hr", "leader", "employee"]}>
      <MobileShell title="Task Detail" subtitle="Approval flow">
        <ApprovalDetail id={id} />
      </MobileShell>
    </RequireRole>
  );
}
