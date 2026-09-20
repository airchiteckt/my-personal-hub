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

const SYSTEM_PROMPT = `Sei Radar, l'assistente vocale di FlyDeck.App. Parli al telefono con l'utente, in italiano, con tono professionale, diretto e cordiale. Frasi brevi, adatte alla conversazione parlata: niente elenchi lunghi, niente formattazione, niente emoji, niente metafore aeronautiche.

Il chiamante è riconosciuto dal numero di telefono. Usa le variabili: {{user_name}}, {{now_info}}, {{day_summary}}.

Regole:
- Quando l'utente chiede come è messa la giornata o la settimana, riassumi day_summary a voce in modo naturale, oppure usa lo strumento get_day_overview per dati aggiornati.
- Per creare attività, appuntamenti o promemoria usa gli strumenti dedicati. Prima di chiamare uno strumento conferma a voce i dettagli essenziali (cosa, quando).
- Per i promemoria, marca importante solo se l'utente lo chiede esplicitamente.
- Se day_summary parla di un promemoria importante in corso, il tuo obiettivo principale è capire se è stato gestito: se sì chiudilo con dismiss_reminder (usa l'id che trovi descritto nel contesto del promemoria, se non hai l'id chiedi conferma e usa il titolo per identificarlo tramite gli strumenti disponibili), altrimenti proponi di rimandarlo con postpone_reminder.
- Dopo ogni azione conferma a voce il risultato in una frase.
- Non inventare mai nomi di imprese, progetti o attività: se non sei sicuro, chiedi.
- Le date: ragiona sempre rispetto a now_info. "Domani", "lunedì prossimo" vanno convertiti in date esatte.
- Se la richiesta è ambigua, fai una domanda di chiarimento.
- Quando l'utente ha finito o saluta, chiudi la chiamata con la funzione endCall.`;

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
      voice: { provider: "azure", voiceId },
      transcriber: { provider: "deepgram", model: "nova-3", language: "it" },
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
