import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName, company_name: companyName },
      },
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setSubmitting(false);
      toast.success("Check your email to confirm your account.");
      navigate({ to: "/login" });
      return;
    }
    // Auto-confirm session — provision company + profile + role
    try {
      const userId = data.user!.id;
      const { data: company, error: cErr } = await supabase
        .from("companies")
        .insert({ name: companyName })
        .select()
        .single();
      if (cErr) throw cErr;

      const { error: pErr } = await supabase.from("profiles").insert({
        id: userId,
        company_id: company.id,
        full_name: fullName,
        email,
      });
      if (pErr) throw pErr;

      const { error: rErr } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "admin",
        company_id: company.id,
      });
      if (rErr) throw rErr;

      // Default teams
      await supabase.from("teams").insert(
        ["Alpha", "Beta", "Gamma", "Delta"].map((name) => ({ name, company_id: company.id })),
      );

      toast.success("Workspace created!");
      navigate({ to: "/admin/home" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Setup failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mobile-shell bg-background flex flex-col px-6 pt-12 pb-8">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="h-14 w-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-elevated">
          <UserPlus className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground mt-1">You'll be the admin of your company</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company name</Label>
          <Input id="company" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting} className="h-11 mt-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-8">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-medium">Sign in</Link>
      </p>
    </div>
  );
}
