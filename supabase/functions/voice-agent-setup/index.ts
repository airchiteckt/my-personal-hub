import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RADAR_TOOL_DEFS } from "../_shared/radar-actions.ts";

// Crea/aggiorna l'agente vocale ElevenLabs "Radar" e salva gli id in ai_voice_settings.
// Richiede JWT utente (verify_jwt = true) + ruolo qualsiasi autenticato: opera sulla config singleton.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EL_URL = "https://api.elevenlabs.io";
const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const TOOLS_URL = `${PROJECT_URL}/functions/v1/elevenlabs-agent-tools`;
const WEBHOOK_URL = `${PROJECT_URL}/functions/v1/elevenlabs-voice-webhook`;

const SYSTEM_PROMPT = `Sei Radar, l'assistente vocale di FlyDeck.App. Parli al telefono con l'utente, in italiano, con tono professionale, diretto e cordiale. Frasi brevi, adatte alla conversazione parlata: niente elenchi lunghi, niente formattazione, niente emoji, niente metafore aeronautiche.

Il chiamante è riconosciuto dal numero di telefono. Usa le variabili dinamiche: {{user_name}}, {{now_info}}, {{day_summary}}.

Regole:
- Quando l'utente chiede come è messa la giornata o la settimana, riassumi day_summary a voce in modo naturale, oppure usa lo strumento get_day_overview per dati aggiornati.
- Per creare attività, appuntamenti o promemoria usa gli strumenti dedicati. Prima di chiamare uno strumento conferma a voce i dettagli essenziali (cosa, quando).
- Per i promemoria, marca urgente solo se l'utente lo chiede esplicitamente.
- Se day_summary parla di un promemoria urgente in corso, il tuo obiettivo principale è capire se è stato gestito: se sì chiudilo con dismiss_reminder (usa l'id che trovi descritto nel contesto del promemoria, se non hai l'id chiedi conferma e usa il titolo per identificarlo tramite gli strumenti disponibili), altrimenti proponi di rimandarlo con postpone_reminder.
- Dopo ogni azione conferma a voce il risultato in una frase.
- Non inventare mai nomi di imprese, progetti o attività: se non sei sicuro, chiedi.
- Le date: ragiona sempre rispetto a now_info. "Domani", "lunedì prossimo" vanno convertiti in date esatte.
- Se la richiesta è ambigua, fai una domanda di chiarimento.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const EL_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const TOOLS_SECRET = Deno.env.get("VOICE_TOOLS_SECRET");
  if (!EL_KEY) {
    return new Response(JSON.stringify({ error: "ElevenLabs non collegato" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(PROJECT_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const voiceId: string = body.voice_id || "onwK4e9ZLuTAKqWW03F9"; // Daniel
    const phoneNumberId: string | undefined = body.phone_number_id;

    // Costruisci gli strumenti webhook per l'agente
    const tools = RADAR_TOOL_DEFS.map((t) => ({
      type: "webhook",
      name: t.name,
      description: t.description,
      api_schema: {
        url: `${TOOLS_URL}?tool=${t.name}&user_id={{system__caller_id_user_id}}`,
        method: "POST",
        headers: TOOLS_SECRET ? { "x-voice-secret": TOOLS_SECRET } : {},
        body_params: t.parameters,
      },
      response_timeout_secs: 20,
    }));

    const agentPayload = {
      name: "Radar FlyDeck",
      conversation_config: {
        agent: {
          prompt: {
            prompt: SYSTEM_PROMPT,
            tools,
          },
          first_message: "Ciao, sono Radar. Come posso aiutarti?",
          language: "it",
        },
        tts: {
          model_id: "eleven_turbo_v2_5",
          voice_id: voiceId,
        },
      },
      platform_settings: {
        workspace_overrides: {
          webhooks: {
            post_call_webhook_id: null,
          },
        },
      },
    };

    // Leggi configurazione esistente
    const { data: vs } = await admin.from("ai_voice_settings")
      .select("id,convai_agent_id,convai_phone_number_id").limit(1).maybeSingle();

    let agentId = vs?.convai_agent_id as string | undefined;

    if (agentId) {
      const res = await fetch(`${EL_URL}/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(agentPayload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("agent update failed", res.status, JSON.stringify(json));
        agentId = undefined; // riprova a crearlo
      }
    }

    if (!agentId) {
      const res = await fetch(`${EL_URL}/v1/convai/agents/create`, {
        method: "POST",
        headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(agentPayload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.agent_id) {
        return new Response(JSON.stringify({ error: `Creazione agente fallita [${res.status}]`, details: json }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      agentId = json.agent_id;
    }

    // Salva configurazione
    const upsertRow = {
      ...(vs?.id ? { id: vs.id } : {}),
      convai_agent_id: agentId,
      ...(phoneNumberId ? { convai_phone_number_id: phoneNumberId } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin.from("ai_voice_settings").upsert(upsertRow);
    if (upErr) console.error("ai_voice_settings upsert failed", upErr);

    return new Response(JSON.stringify({
      ok: true,
      agent_id: agentId,
      phone_number_id: phoneNumberId ?? vs?.convai_phone_number_id ?? null,
      webhook_url: WEBHOOK_URL,
      note: "Configura il webhook del numero Twilio in ElevenLabs con webhook_url e assegna l'agente al numero.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
