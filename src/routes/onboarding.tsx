import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, homeForRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingRedirect,
});

function OnboardingRedirect() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (role) navigate({ to: homeForRole(role) });
  }, [loading, session, role, navigate]);
  return (
    <div className="mobile-shell flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
