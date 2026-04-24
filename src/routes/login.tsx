import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const DEMO_USERS = [
  { role: "Admin", email: "admin@demo.bams", password: "demo1234" },
  { role: "HR", email: "hr@demo.bams", password: "demo1234" },
  { role: "Team Leader", email: "leader@demo.bams", password: "demo1234" },
  { role: "Employee", email: "employee@demo.bams", password: "demo1234" },
];

function LoginPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: role ? homeForRole(role) : "/onboarding" });
    }
  }, [loading, session, role, navigate]);

  const doLogin = async (em: string, pw: string) => {
    setErrorMsg(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    setSubmitting(false);
    if (error) {
      const msg = "Invalid email or password";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    toast.success("Welcome back!");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(email, password);
  };

  const fillDemo = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
    doLogin(em, pw);
  };

  return (
    <div className="mobile-shell bg-background flex flex-col px-6 pt-12 pb-8">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
          <ShieldCheck className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your BAMS workspace</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
            {errorMsg}
          </div>
        )}

        <Button type="submit" disabled={submitting} className="h-11 mt-1">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>

      <div className="mt-8">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Demo accounts (tap to sign in)
        </div>
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {DEMO_USERS.map((u) => (
            <button
              key={u.email}
              type="button"
              disabled={submitting}
              onClick={() => fillDemo(u.email, u.password)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent transition-colors disabled:opacity-50"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{u.role}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="text-xs font-mono text-muted-foreground">{u.password}</div>
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-8">
        New to BAMS?{" "}
        <Link to="/signup" className="text-primary font-medium">Create account</Link>
      </p>
    </div>
  );
}
