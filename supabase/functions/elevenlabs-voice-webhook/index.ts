import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildDaySummary, romeNow } from "../_shared/radar-actions.ts";

// Webhook ElevenLabs ConvAI:
// - personalizzazione chiamata in entrata (riconoscimento dal numero chiamante)
// - eventi post-chiamata (registro in voice_calls)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  return p.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    // ---- post-call / transcription events ----
    if (body.type && body.type !== "conversation_initiation_client_data") {
      try {
        const data = body.data ?? body;
        const convId = data.conversation_id ?? null;
        if (convId) {
          const summary =
            data?.analysis?.transcript_summary ??
            data?.analysis?.call_summary_title ??
            null;
          const durationSec = data?.metadata?.call_duration_secs ?? null;
          await admin.from("voice_calls")
            .update({
              status: "completed",
              summary: summary ? String(summary).slice(0, 500) : null,
              ended_at: new Date().toISOString(),
              ...(durationSec ? {} : {}),
            })
            .eq("elevenlabs_conversation_id", convId);
        }
      } catch (e) {
        console.error("post-call handling error", e);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- conversation initiation (inbound call personalization) ----
    const caller =
      body?.caller_id ??
      body?.data?.caller_id ??
      body?.conversation_initiation_client_data?.caller_id ??
      null;
    const calledNumber = body?.called_number ?? body?.data?.called_number ?? null;
    const convId = body?.conversation_id ?? body?.data?.conversation_id ?? null;

    const callerNorm = normalizePhone(caller);
    let profile: any = null;
    if (callerNorm) {
      const { data } = await admin.from("profiles")
        .select("user_id,display_name,phone_number")
        .not("phone_number", "is", null);
      profile = (data ?? []).find((p: any) => {
        const pn = normalizePhone(p.phone_number);
        return pn && (pn === callerNorm || pn.endsWith(callerNorm.replace(/^\+/, "")) || callerNorm.endsWith(pn.replace(/^\+/, "")));
      }) ?? null;
    }

    if (!profile) {
      // Numero sconosciuto: l'agente lo comunica e chiude
      return new Response(JSON.stringify({
        type: "conversation_initiation_client_data",
        dynamic_variables: {
          user_known: "no",
          now_info: "",
          day_summary: "",
          user_name: "",
          user_id: "",
        },
        conversation_config_override: {
          agent: {
            first_message: "Ciao, sono Radar di FlyDeck. Questo numero non è collegato a nessun account FlyDeck, quindi non posso aiutarti. Se hai un account, aggiungi questo numero nelle impostazioni del profilo. Buona giornata!",
            prompt: {
              prompt: "Sei Radar di FlyDeck. Il chiamante NON è un utente riconosciuto. Comunica che il numero non è collegato a nessun account e chiudi la chiamata in modo cortese. Non usare nessuno strumento.",
            },
          },
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = romeNow();
    const daySummary = await buildDaySummary(admin, profile.user_id);

    if (convId) {
      await admin.from("voice_calls").insert({
        user_id: profile.user_id,
        direction: "inbound",
        phone_number: callerNorm || null,
        elevenlabs_conversation_id: String(convId),
        status: "started",
      });
    }

    const firstName = (profile.display_name ?? "").split(" ")[0] || "";
    return new Response(JSON.stringify({
      type: "conversation_initiation_client_data",
      dynamic_variables: {
        user_known: "yes",
        user_name: profile.display_name ?? "",
        user_id: profile.user_id,
        now_info: `${now.weekday} ${now.date}, ore ${now.time}`,
        day_summary: daySummary,
      },
      conversation_config_override: {
        agent: {
          first_message: `Ciao${firstName ? " " + firstName : ""}, sono Radar. Dimmi pure: posso aggiornarti sulla giornata, aggiungere attività, appuntamenti o promemoria.`,
        },
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("elevenlabs-voice-webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
