import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { TasksList } from "@/components/TasksList";

export const Route = createFileRoute("/leader/tasks")({
  component: () => (
    <RequireRole allow={["leader"]}>
      <MobileShell title="Tasks" subtitle="Assign work to your team">
        <TasksList mode="leader" />
      </MobileShell>
    </RequireRole>
  ),
});
