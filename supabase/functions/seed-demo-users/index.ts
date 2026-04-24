// Seeds 4 demo users (admin, hr, leader, employee) for BAMS Demo Co.
// Idempotent: safe to call multiple times.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO = [
  { email: "admin@demo.bams", password: "demo1234", name: "Demo Admin", role: "admin" as const },
  { email: "hr@demo.bams", password: "demo1234", name: "Demo HR", role: "hr" as const },
  { email: "leader@demo.bams", password: "demo1234", name: "Demo Leader", role: "leader" as const },
  { email: "employee@demo.bams", password: "demo1234", name: "Demo Employee", role: "employee" as const },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ensure demo company exists
    let companyId: string;
    const { data: existingCo } = await admin
      .from("companies")
      .select("id")
      .eq("name", "BAMS Demo Co")
      .maybeSingle();

    if (existingCo) {
      companyId = existingCo.id;
    } else {
      const { data: newCo, error: coErr } = await admin
        .from("companies")
        .insert({ name: "BAMS Demo Co" })
        .select("id")
        .single();
      if (coErr) throw coErr;
      companyId = newCo.id;
      await admin.from("teams").insert(
        ["Alpha", "Beta", "Gamma", "Delta"].map((name) => ({ name, company_id: companyId })),
      );
    }

    const results: Array<{ email: string; status: string }> = [];

    for (const u of DEMO) {
      // Check if user already exists
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list.users.find((x) => x.email === u.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
        // Reset password to known value
        await admin.auth.admin.updateUserById(userId, { password: u.password, email_confirm: true });
        results.push({ email: u.email, status: "updated" });
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.name },
        });
        if (cErr) throw cErr;
        userId = created.user!.id;
        results.push({ email: u.email, status: "created" });
      }

      // Upsert profile
      await admin.from("profiles").upsert({
        id: userId,
        email: u.email,
        full_name: u.name,
        company_id: companyId,
      });

      // Ensure role row exists
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", u.role)
        .maybeSingle();
      if (!roleRow) {
        await admin.from("user_roles").insert({
          user_id: userId,
          role: u.role,
          company_id: companyId,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, companyId, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
