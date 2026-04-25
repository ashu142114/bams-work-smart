// User management edge function for BAMS.
// Auth: requires caller's JWT. Permissions enforced server-side based on caller's role.
// Actions: create | update | delete
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "admin" | "hr" | "leader" | "employee";

interface CreatePayload {
  action: "create";
  name: string;
  email: string;
  password: string;
  role: Role;
  team_id?: string | null;
  salary?: number;
}
interface UpdatePayload {
  action: "update";
  id: string;
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  team_id?: string | null;
  salary?: number;
}
interface DeletePayload {
  action: "delete";
  id: string;
}
type Payload = CreatePayload | UpdatePayload | DeletePayload;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    // Identify caller
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(url, serviceKey);

    // Caller profile + roles
    const [{ data: callerProfile }, { data: callerRoles }] = await Promise.all([
      admin.from("profiles").select("company_id").eq("id", callerId).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", callerId),
    ]);
    if (!callerProfile?.company_id) return json({ error: "No company" }, 403);
    const companyId = callerProfile.company_id as string;
    const roles = (callerRoles ?? []).map((r: { role: Role }) => r.role);
    const isAdmin = roles.includes("admin");
    const isHR = roles.includes("hr");
    if (!isAdmin && !isHR) return json({ error: "Forbidden" }, 403);

    const body = (await req.json()) as Payload;

    // ===== CREATE =====
    if (body.action === "create") {
      const { name, email, password, role, team_id, salary } = body;
      if (!name?.trim() || !email?.trim() || !password || !role) {
        return json({ error: "Missing required fields" }, 400);
      }
      if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
      if (typeof salary === "number" && salary < 0) return json({ error: "Salary must be positive" }, 400);

      // HR restriction: only employee role, no salary set
      if (!isAdmin) {
        if (role !== "employee") return json({ error: "HR can only create Employees" }, 403);
      }

      // Unique email check across our profiles
      const { data: dup } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (dup) return json({ error: "Email already in use" }, 409);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (cErr || !created.user) return json({ error: cErr?.message ?? "Create failed" }, 400);

      const newId = created.user.id;
      const profileSalary = isAdmin ? salary ?? 0 : 0;

      const { error: pErr } = await admin.from("profiles").upsert({
        id: newId,
        email: email.toLowerCase(),
        full_name: name,
        company_id: companyId,
        team_id: team_id ?? null,
        monthly_salary: profileSalary,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(newId);
        return json({ error: pErr.message }, 400);
      }

      const { error: rErr } = await admin.from("user_roles").insert({
        user_id: newId,
        role,
        company_id: companyId,
      });
      if (rErr) return json({ error: rErr.message }, 400);

      return json({ ok: true, id: newId });
    }

    // ===== UPDATE =====
    if (body.action === "update") {
      const { id, name, email, password, role, team_id, salary } = body;
      if (!id) return json({ error: "Missing id" }, 400);

      // Confirm target is in same company
      const { data: target } = await admin
        .from("profiles")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();
      if (!target || target.company_id !== companyId) return json({ error: "Not found" }, 404);

      const { data: targetRoles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", id);
      const tRoles = (targetRoles ?? []).map((r: { role: Role }) => r.role);
      const targetIsAdminOrHR = tRoles.includes("admin") || tRoles.includes("hr");

      if (!isAdmin) {
        // HR: only edit employees
        if (targetIsAdminOrHR) return json({ error: "HR cannot edit Admin/HR" }, 403);
        if (role && role !== "employee") return json({ error: "HR can only assign Employee role" }, 403);
        if (typeof salary === "number") return json({ error: "HR cannot set salary" }, 403);
      }

      if (password && password.length < 6) return json({ error: "Password too short" }, 400);
      if (typeof salary === "number" && salary < 0) return json({ error: "Salary must be positive" }, 400);

      // Unique email check
      if (email) {
        const { data: dup } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email.toLowerCase())
          .neq("id", id)
          .maybeSingle();
        if (dup) return json({ error: "Email already in use" }, 409);
      }

      // Auth update
      const authPatch: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {};
      if (email) authPatch.email = email.toLowerCase();
      if (password) authPatch.password = password;
      if (name) authPatch.user_metadata = { full_name: name };
      if (Object.keys(authPatch).length) {
        const { error: aErr } = await admin.auth.admin.updateUserById(id, authPatch);
        if (aErr) return json({ error: aErr.message }, 400);
      }

      // Profile update
      const profilePatch: Record<string, unknown> = {};
      if (name) profilePatch.full_name = name;
      if (email) profilePatch.email = email.toLowerCase();
      if (team_id !== undefined) profilePatch.team_id = team_id;
      if (isAdmin && typeof salary === "number") profilePatch.monthly_salary = salary;
      if (Object.keys(profilePatch).length) {
        const { error: pErr } = await admin.from("profiles").update(profilePatch).eq("id", id);
        if (pErr) return json({ error: pErr.message }, 400);
      }

      // Role update (admin only when changing to/from admin/hr; HR locked to employee)
      if (role) {
        await admin.from("user_roles").delete().eq("user_id", id);
        const { error: rErr } = await admin.from("user_roles").insert({
          user_id: id,
          role,
          company_id: companyId,
        });
        if (rErr) return json({ error: rErr.message }, 400);
      }

      return json({ ok: true });
    }

    // ===== DELETE =====
    if (body.action === "delete") {
      if (!isAdmin) return json({ error: "Only Admin can delete" }, 403);
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      if (id === callerId) return json({ error: "Cannot delete yourself" }, 400);

      const { data: target } = await admin
        .from("profiles")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();
      if (!target || target.company_id !== companyId) return json({ error: "Not found" }, 404);

      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("profiles").delete().eq("id", id);
      const { error: dErr } = await admin.auth.admin.deleteUser(id);
      if (dErr) return json({ error: dErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
