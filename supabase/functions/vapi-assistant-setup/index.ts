import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RADAR_TOOL_DEFS } from "../_shared/radar-actions.ts";

// Crea/aggiorna l'assistente VAPI "Radar FlyDeck" e salva gli id in ai_voice_settings.
// Se viene passato phone_number_id, collega anche il numero (importato da Twilio) al webhook.
// Richiede JWT utente (verify_jwt = true): opera sulla configurazione singleton.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPI_URL = "https://api.vapi.ai";
const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_URL = `${PROJECT_URL}/functions/v1/vapi-webhook`;

const SYSTEM_PROMPT = `Sei Radar, l'assistente vocale di FlyDeck.App. Parli al telefono, in italiano, con tono professionale e sveglio.

STILE (critico): risposte brevissime, una o due frasi, massimo 25 parole. Niente elenchi puntati, niente formattazione, niente emoji, niente metafore aeronautiche. Vai dritto al punto, mai giri di parole o riepiloghi inutili. Se devi leggere una lista, massimo tre voci e chiedi se vuole il resto.

CONTESTO GIÀ DISPONIBILE (non chiamare strumenti per averlo): {{user_name}}, {{now_info}}, {{day_summary}}, {{context_brief}} (imprese, progetti e focus attivi con i loro id).

STRUMENTI
- Consultazione: get_day_overview, get_agenda, list_tasks (today/week/backlog/overdue), list_projects, list_enterprises, get_okr, find_item.
- Modifica: create_task, schedule_task, complete_task, create_appointment, move_appointment, cancel_appointment, create_reminder, dismiss_reminder, postpone_reminder.

REGOLE
- Se la risposta è già in day_summary o context_brief, rispondi subito senza strumenti. Usa gli strumenti solo per dati non presenti o dopo una modifica.
- Prima di modificare o completare qualcosa di esistente, ricava l'id con find_item o list_tasks. Non inventare mai id, nomi di imprese, progetti o attività.
- Esegui direttamente le richieste chiare: non chiedere conferma per azioni semplici, conferma a voce dopo averle fatte, in una frase.
- Chiedi solo il dato mancante indispensabile (di solito quando). Una domanda alla volta.
- Date sempre calcolate rispetto a now_info: "domani", "lunedì" vanno convertiti in YYYY-MM-DD.
- Promemoria importante solo se l'utente lo dice esplicitamente.
- Se la chiamata riguarda un promemoria importante in corso: capisci se è gestito, chiudilo con dismiss_reminder oppure rimandalo con postpone_reminder.
- Quando l'utente ha finito o saluta, chiudi con endCall.`;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const VAPI_KEY = Deno.env.get("VAPI_API_KEY");
  const TOOLS_SECRET = Deno.env.get("VOICE_TOOLS_SECRET");
  if (!VAPI_KEY) {
    return json({ error: "VAPI non configurato: manca la chiave API" }, 400);
  }

  try {
    const admin = createClient(PROJECT_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const voiceId: string = body.voice_id || "it-IT-DiegoNeural";
    const phoneNumberId: string | undefined = body.phone_number_id;

    const tools = RADAR_TOOL_DEFS.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const assistantPayload = {
      name: "Radar FlyDeck",
      firstMessage: "Ciao, sono Radar. Come posso aiutarti?",
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [{ role: "system", content: SYSTEM_PROMPT }],
        tools,
      },
      voice: { provider: "azure", voiceId, speed: 1.12 },
      transcriber: { provider: "deepgram", model: "nova-3", language: "it" },
      // Bassa latenza conversazionale
      startSpeakingPlan: {
        waitSeconds: 0.3,
        smartEndpointingPlan: { provider: "livekit", waitFunction: "200 + 4000 * x" },
      },
      stopSpeakingPlan: { numWords: 2, voiceSeconds: 0.15, backoffSeconds: 0.8 },
      firstMessageInterruptionsEnabled: true,
      silenceTimeoutSeconds: 20,
      server: {
        url: WEBHOOK_URL,
        ...(TOOLS_SECRET ? { secret: TOOLS_SECRET } : {}),
        timeoutSeconds: 20,
      },
      serverMessages: ["end-of-call-report", "tool-calls", "status-update"],
      endCallFunctionEnabled: true,
      maxDurationSeconds: 900,
      backgroundSound: "off",
    };

    const headers = { Authorization: `Bearer ${VAPI_KEY}`, "Content-Type": "application/json" };

    const { data: vs } = await admin.from("ai_voice_settings")
      .select("id,vapi_assistant_id,vapi_phone_number_id").limit(1).maybeSingle();

    let assistantId = vs?.vapi_assistant_id as string | undefined;

    if (assistantId) {
      const res = await fetch(`${VAPI_URL}/assistant/${assistantId}`, {
        method: "PATCH", headers, body: JSON.stringify(assistantPayload),
      });
      if (!res.ok) {
        console.error("assistant update failed", res.status, await res.text().catch(() => ""));
        assistantId = undefined; // ricrea
      }
    }

    if (!assistantId) {
      const res = await fetch(`${VAPI_URL}/assistant`, {
        method: "POST", headers, body: JSON.stringify(assistantPayload),
      });
      const jsonRes = await res.json().catch(() => ({}));
      if (!res.ok || !jsonRes?.id) {
        return json({ error: `Creazione assistente fallita [${res.status}]`, details: jsonRes }, res.status);
      }
      assistantId = jsonRes.id;
    }

    // Collega il numero (importato da Twilio in VAPI) al webhook
    let linkedPhoneId = phoneNumberId ?? vs?.vapi_phone_number_id ?? null;
    if (phoneNumberId) {
      const res = await fetch(`${VAPI_URL}/phone-number/${phoneNumberId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          assistantId: null, // il routing passa dal webhook (assistant-request)
          server: {
            url: WEBHOOK_URL,
            ...(TOOLS_SECRET ? { secret: TOOLS_SECRET } : {}),
            timeoutSeconds: 20,
          },
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("phone-number link failed", res.status, txt);
        return json({ error: `Assistente pronto, ma collegamento del numero fallito [${res.status}]`, details: txt, assistant_id: assistantId }, res.status);
      }
    }

    const upsertRow = {
      ...(vs?.id ? { id: vs.id } : {}),
      vapi_assistant_id: assistantId,
      ...(linkedPhoneId ? { vapi_phone_number_id: linkedPhoneId } : {}),
      updated_at: new Date().toISOString(),
    };
    const { error: upErr } = await admin.from("ai_voice_settings").upsert(upsertRow);
    if (upErr) console.error("ai_voice_settings upsert failed", upErr);

    return json({
      ok: true,
      assistant_id: assistantId,
      phone_number_id: linkedPhoneId,
      webhook_url: WEBHOOK_URL,
      already_existed: Boolean(vs?.vapi_assistant_id),
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
