import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, homeForRole } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: SplashPage,
});

function SplashPage() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (session && role) navigate({ to: homeForRole(role) });
      else if (session && !role) navigate({ to: "/onboarding" });
      else navigate({ to: "/login" });
    }, 900);
    return () => clearTimeout(t);
  }, [loading, session, role, navigate]);

  return (
    <div className="mobile-shell bg-gradient-hero text-primary-foreground flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-700">
        <div className="h-20 w-20 rounded-3xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-elevated animate-pulse-ring">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">BAMS</h1>
          <p className="text-sm opacity-80 mt-1">Bharat Attendance Management System</p>
        </div>
      </div>
      <p className="absolute bottom-8 text-xs opacity-70">Loading your workspace…</p>
    </div>
  );
}
