import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeAction, buildDaySummary } from "../_shared/radar-actions.ts";

// Strumenti server-side dell'agente vocale ElevenLabs.
// Autenticazione: header x-voice-secret == VOICE_TOOLS_SECRET (configurato nell'agente).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-secret",
};

const ALLOWED = new Set([
  "create_appointment", "create_reminder", "dismiss_reminder", "postpone_reminder",
  "create_task", "schedule_task", "complete_task", "get_day_overview",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("VOICE_TOOLS_SECRET");
  if (secret && req.headers.get("x-voice-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id") || "";
    const toolName = url.searchParams.get("tool") || "";
    const body = await req.json().catch(() => ({}));

    if (!userId) {
      return new Response(JSON.stringify({ error: "Utente non riconosciuto: numero non collegato." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED.has(toolName)) {
      return new Response(JSON.stringify({ error: `Strumento non disponibile: ${toolName}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (toolName === "get_day_overview") {
      const summary = await buildDaySummary(admin, userId);
      return new Response(JSON.stringify({ result: summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await executeAction(admin, userId, toolName, body ?? {});
    if ("error" in res) {
      return new Response(JSON.stringify({ error: res.error }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const labels: Record<string, string> = {
      create_appointment: "Appuntamento creato",
      create_reminder: "Promemoria creato",
      dismiss_reminder: "Promemoria chiuso",
      postpone_reminder: "Promemoria rimandato",
      create_task: "Attività creata",
      schedule_task: "Attività pianificata",
      complete_task: "Attività completata",
    };
    return new Response(JSON.stringify({ result: `${labels[toolName] ?? "Fatto"}.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-tools error", e);
    return new Response(JSON.stringify({ error: "Errore interno, riprova." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
