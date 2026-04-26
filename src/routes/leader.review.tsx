import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/MobileShell";
import { RequireRole } from "@/components/RequireRole";
import { WorkUpdateReview } from "@/components/WorkUpdateReview";

export const Route = createFileRoute("/leader/review")({
  component: () => (
    <RequireRole allow={["leader", "admin"]}>
      <MobileShell title="Reviews" subtitle="Approve, reject or hold work updates">
        <WorkUpdateReview />
      </MobileShell>
    </RequireRole>
  ),
});
