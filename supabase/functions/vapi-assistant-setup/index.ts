import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RADAR_TOOL_DEFS } from "../_shared/radar-actions.ts";
import { RADAR_VOICE_SYSTEM_PROMPT } from "../_shared/radar-voice-prompt.ts";
import { mergeTuning, buildVoiceBlock, buildTranscriberBlock, DEFAULT_VAPI_TUNING } from "../_shared/vapi-tuning.ts";

// Crea/aggiorna l'assistente VAPI "Radar FlyDeck" e salva gli id in ai_voice_settings.
// Tutti i parametri di fine-tuning arrivano da ai_voice_settings.vapi_tuning (pannello Admin).
// I tool di Radar e il webhook sono sempre imposti dal codice e non sono sovrascrivibili.
// Richiede JWT utente (verify_jwt = true): opera sulla configurazione singleton.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPI_URL = "https://api.vapi.ai";
const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_URL = `${PROJECT_URL}/functions/v1/vapi-webhook`;

const SYSTEM_PROMPT = RADAR_VOICE_SYSTEM_PROMPT;

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

  const headers = { Authorization: `Bearer ${VAPI_KEY}`, "Content-Type": "application/json" };

  try {
    const admin = createClient(PROJECT_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    const { data: vs } = await admin.from("ai_voice_settings")
      .select("id,vapi_assistant_id,vapi_phone_number_id,vapi_tuning").limit(1).maybeSingle();

    // --- Importa la configurazione attuale da VAPI ---
    if (body.action === "import") {
      const assistantId = vs?.vapi_assistant_id;
      if (!assistantId) return json({ error: "Nessun assistente VAPI da importare" }, 400);
      const res = await fetch(`${VAPI_URL}/assistant/${assistantId}`, { headers });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) return json({ error: `Importazione fallita [${res.status}]`, details: a }, res.status);

      const imported = {
        llmProvider: a?.model?.provider ?? DEFAULT_VAPI_TUNING.llmProvider,
        llmModel: a?.model?.model ?? DEFAULT_VAPI_TUNING.llmModel,
        temperature: a?.model?.temperature ?? DEFAULT_VAPI_TUNING.temperature,
        maxTokens: a?.model?.maxTokens ?? DEFAULT_VAPI_TUNING.maxTokens,
        voiceProvider: a?.voice?.provider ?? DEFAULT_VAPI_TUNING.voiceProvider,
        voiceId: a?.voice?.voiceId ?? DEFAULT_VAPI_TUNING.voiceId,
        voiceModel: a?.voice?.model ?? "",
        voiceSpeed: a?.voice?.speed ?? DEFAULT_VAPI_TUNING.voiceSpeed,
        voiceStability: a?.voice?.stability ?? DEFAULT_VAPI_TUNING.voiceStability,
        voiceSimilarityBoost: a?.voice?.similarityBoost ?? DEFAULT_VAPI_TUNING.voiceSimilarityBoost,
        voiceStyle: a?.voice?.style ?? DEFAULT_VAPI_TUNING.voiceStyle,
        voiceUseSpeakerBoost: a?.voice?.useSpeakerBoost ?? DEFAULT_VAPI_TUNING.voiceUseSpeakerBoost,
        transcriberProvider: a?.transcriber?.provider ?? DEFAULT_VAPI_TUNING.transcriberProvider,
        transcriberModel: a?.transcriber?.model ?? DEFAULT_VAPI_TUNING.transcriberModel,
        transcriberLanguage: a?.transcriber?.language ?? DEFAULT_VAPI_TUNING.transcriberLanguage,
        firstMessage: a?.firstMessage ?? DEFAULT_VAPI_TUNING.firstMessage,
        systemPrompt: a?.model?.messages?.[0]?.content ?? "",
        silenceTimeoutSeconds: a?.silenceTimeoutSeconds ?? DEFAULT_VAPI_TUNING.silenceTimeoutSeconds,
        maxDurationSeconds: a?.maxDurationSeconds ?? DEFAULT_VAPI_TUNING.maxDurationSeconds,
        backgroundSound: typeof a?.backgroundSound === "string" ? a.backgroundSound : DEFAULT_VAPI_TUNING.backgroundSound,
        backchannelingEnabled: a?.backchannelingEnabled ?? DEFAULT_VAPI_TUNING.backchannelingEnabled,
        startSpeakingWaitSeconds: a?.startSpeakingPlan?.waitSeconds ?? DEFAULT_VAPI_TUNING.startSpeakingWaitSeconds,
        smartEndpointingEnabled: Boolean(a?.startSpeakingPlan?.smartEndpointingPlan),
        smartEndpointingProvider: a?.startSpeakingPlan?.smartEndpointingPlan?.provider ?? DEFAULT_VAPI_TUNING.smartEndpointingProvider,
        stopSpeakingNumWords: a?.stopSpeakingPlan?.numWords ?? DEFAULT_VAPI_TUNING.stopSpeakingNumWords,
        stopSpeakingVoiceSeconds: a?.stopSpeakingPlan?.voiceSeconds ?? DEFAULT_VAPI_TUNING.stopSpeakingVoiceSeconds,
        stopSpeakingBackoffSeconds: a?.stopSpeakingPlan?.backoffSeconds ?? DEFAULT_VAPI_TUNING.stopSpeakingBackoffSeconds,
        firstMessageInterruptionsEnabled: a?.firstMessageInterruptionsEnabled ?? DEFAULT_VAPI_TUNING.firstMessageInterruptionsEnabled,
        smartDenoisingEnabled: a?.backgroundSpeechDenoisingPlan?.smartDenoisingPlan?.enabled ?? DEFAULT_VAPI_TUNING.smartDenoisingEnabled,
        recordingEnabled: a?.artifactPlan?.recordingEnabled ?? DEFAULT_VAPI_TUNING.recordingEnabled,
      };

      if (vs?.id) {
        await admin.from("ai_voice_settings")
          .update({ vapi_tuning: imported, updated_at: new Date().toISOString() })
          .eq("id", vs.id);
      }
      return json({ ok: true, tuning: imported });
    }

    // --- Crea / aggiorna l'assistente ---
    const t = mergeTuning(body.tuning ?? vs?.vapi_tuning);
    const phoneNumberId: string | undefined = body.phone_number_id;

    const tools = RADAR_TOOL_DEFS.map((d) => ({
      type: "function",
      function: { name: d.name, description: d.description, parameters: d.parameters },
    }));

    const assistantPayload = {
      name: "Radar FlyDeck",
      firstMessage: t.firstMessage || DEFAULT_VAPI_TUNING.firstMessage,
      model: {
        provider: t.llmProvider,
        model: t.llmModel,
        temperature: t.temperature,
        maxTokens: t.maxTokens,
        messages: [{ role: "system", content: (t.systemPrompt || "").trim() || SYSTEM_PROMPT }],
        tools,
      },
      voice: buildVoiceBlock(t),
      transcriber: buildTranscriberBlock(t),
      startSpeakingPlan: {
        waitSeconds: t.startSpeakingWaitSeconds,
        ...(t.smartEndpointingEnabled
          ? { smartEndpointingPlan: { provider: t.smartEndpointingProvider, waitFunction: "200 + 4000 * x" } }
          : {}),
      },
      stopSpeakingPlan: {
        numWords: t.stopSpeakingNumWords,
        voiceSeconds: t.stopSpeakingVoiceSeconds,
        backoffSeconds: t.stopSpeakingBackoffSeconds,
      },
      backgroundSpeechDenoisingPlan: { smartDenoisingPlan: { enabled: t.smartDenoisingEnabled } },
      artifactPlan: { recordingEnabled: t.recordingEnabled },
      backchannelingEnabled: t.backchannelingEnabled,
      firstMessageInterruptionsEnabled: t.firstMessageInterruptionsEnabled,
      silenceTimeoutSeconds: t.silenceTimeoutSeconds,
      maxDurationSeconds: t.maxDurationSeconds,
      backgroundSound: t.backgroundSound,
      // Sempre imposti dal codice: canale operativo di Radar
      server: {
        url: WEBHOOK_URL,
        ...(TOOLS_SECRET ? { secret: TOOLS_SECRET } : {}),
        timeoutSeconds: 20,
      },
      serverMessages: ["end-of-call-report", "tool-calls", "status-update"],
      endCallFunctionEnabled: true,
    };

    let assistantId = vs?.vapi_assistant_id as string | undefined;

    if (assistantId) {
      const res = await fetch(`${VAPI_URL}/assistant/${assistantId}`, {
        method: "PATCH", headers, body: JSON.stringify(assistantPayload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("assistant update failed", res.status, txt);
        // 404 = assistente rimosso su VAPI: lo ricreiamo. Altri errori (config non valida) vanno mostrati.
        if (res.status !== 404) {
          return json({ error: `Aggiornamento assistente fallito [${res.status}]`, details: safeJson(txt) }, res.status);
        }
        assistantId = undefined;
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

    // Collega il numero (importato in VAPI) al webhook
    const linkedPhoneId = phoneNumberId ?? vs?.vapi_phone_number_id ?? null;
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
      ...(body.tuning ? { vapi_tuning: t } : {}),
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

function safeJson(txt: string) {
  try { return JSON.parse(txt); } catch { return txt; }
}
