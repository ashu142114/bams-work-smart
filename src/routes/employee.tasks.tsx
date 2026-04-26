import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { TasksList } from "@/components/TasksList";

export const Route = createFileRoute("/employee/tasks")({
  component: () => (
    <RequireRole allow={["employee", "leader"]}>
      <MobileShell title="My Tasks" subtitle="Tasks assigned to you">
        <TasksList mode="employee" />
      </MobileShell>
    </RequireRole>
  ),
});
