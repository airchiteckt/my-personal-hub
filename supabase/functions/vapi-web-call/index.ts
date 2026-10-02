import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startWebCall } from "../_shared/radar-actions.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Non autenticato" }, 401);
    const r = await startWebCall(admin, user.id);
    return json(r, r.ok ? 200 : 500);
  } catch (e) {
    console.error(e);
    return json({ error: "Errore interno" }, 500);
  }
});
