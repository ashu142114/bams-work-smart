import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { TasksList } from "@/components/TasksList";

export const Route = createFileRoute("/admin/tasks")({
  component: () => (
    <RequireRole allow={["admin"]}>
      <MobileShell title="Tasks" subtitle="All company tasks">
        <TasksList mode="admin" />
      </MobileShell>
    </RequireRole>
  ),
});
