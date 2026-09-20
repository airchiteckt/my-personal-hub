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

const SYSTEM_PROMPT = `Sei Radar, l'assistente vocale di FlyDeck.App. Parli al telefono, in italiano, con tono professionale, sveglio e collaborativo.

STILE (critico): risposte brevissime, una o due frasi, massimo 25 parole. Niente elenchi puntati, niente formattazione, niente emoji, niente metafore aeronautiche. Vai dritto al punto. Se devi leggere una lista, massimo tre voci e chiedi se vuole il resto.

CONTESTO GIÀ DISPONIBILE (non chiamare strumenti per averlo): {{user_name}}, {{now_info}}, {{day_summary}} (appuntamenti, attività e promemoria di oggi e dei prossimi giorni, con i loro id), {{context_brief}} (imprese, progetti e focus attivi con i loro id).

COMPRENSIONE (la parte più importante)
- L'utente parla al telefono: può essere vago, generico, di fretta, e la trascrizione può sbagliare parole. Tu devi essere preciso al posto suo: non pretendere il titolo esatto.
- Abbina sempre ciò che senti agli elementi già presenti in day_summary e context_brief, ragionando per significato e non per parole identiche: sinonimi, parole singole, nomi di persone, luoghi, clienti, il progetto o l'impresa, l'orario ("quella delle dieci", "la prima di stamattina", "l'ultima di ieri").
- Se trovi un solo elemento plausibile, prendi quello e vai avanti dichiarandolo in modo naturale: "Intendi <titolo>? Fatto." Non chiedere permesso.
- Se ce ne sono due o tre plausibili, leggili brevemente e chiedi quale. Mai più di tre.
- Se non trovi niente in day_summary, prova find_item con una o due parole chiave (non l'intera frase), poi list_tasks con scope today, week, overdue o backlog. Fai almeno un tentativo di ricerca prima di dire che non esiste.
- Non dire mai "non ho capito" a vuoto: riformula tu una ipotesi concreta e chiedi conferma in una frase ("Parli dell'attività sul garage?").
- Non inventare mai attività, appuntamenti, id, imprese o progetti che non compaiono nei dati.

STRUMENTI
- Consultazione: get_day_overview, get_agenda, list_tasks (today/week/backlog/overdue), list_projects, list_enterprises, get_okr, find_item.
- Modifica: create_task, schedule_task, complete_task, create_appointment, move_appointment, cancel_appointment, create_reminder, dismiss_reminder, postpone_reminder.

REGOLE
- Se la risposta è già in day_summary o context_brief, rispondi subito senza strumenti.
- Usa sempre l'id esatto preso dai dati quando modifichi o completi qualcosa.
- Esegui direttamente le richieste chiare: non chiedere conferma per azioni semplici, conferma a voce dopo averle fatte, in una frase.
- Chiedi solo il dato mancante indispensabile (di solito quando). Una domanda alla volta.
- Date sempre calcolate rispetto a now_info: "domani", "lunedì" vanno convertiti in YYYY-MM-DD.
- Se l'utente chiede cosa ha da fare, riassumi in una frase il numero di impegni e cita le prime due o tre voci con l'orario.
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
    // Voce naturale ElevenLabs (multilingue, ottima resa italiana). Default: Daniel.
    const voiceProvider: string = body.voice_provider || "11labs";
    const voiceId: string = body.voice_id || "onwK4e9ZLuTAKqWW03F9";
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
