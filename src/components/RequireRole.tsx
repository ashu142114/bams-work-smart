import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole, homeForRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface Props {
  allow: AppRole[];
  children: ReactNode;
}

export function RequireRole({ allow, children }: Props) {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (role && !allow.includes(role)) {
      navigate({ to: homeForRole(role) });
    }
  }, [loading, session, role, allow, navigate]);

  if (loading || !session || !role || !allow.includes(role)) {
    return (
      <div className="mobile-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <>{children}</>;
}
