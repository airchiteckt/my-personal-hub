import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeAction, buildVoiceDaySummary, romeNow, queryRadar, RADAR_QUERY_TOOLS, RADAR_TOOL_DEFS } from "../_shared/radar-actions.ts";

// Server URL dell'assistente VAPI "Radar FlyDeck".
// Gestisce: assistant-request (instradamento chiamate in entrata con riconoscimento
// dal numero), tool-calls (strumenti Radar), end-of-call-report (registro chiamate).
// Autenticazione: header x-vapi-secret == VOICE_TOOLS_SECRET (configurato sull'assistente).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vapi-secret",
};

const ALLOWED = new Set(RADAR_TOOL_DEFS.map((t) => t.name));

const LABELS: Record<string, string> = {
  create_appointment: "Appuntamento creato",
  create_reminder: "Promemoria creato",
  dismiss_reminder: "Promemoria chiuso",
  postpone_reminder: "Promemoria rimandato",
  create_task: "Attività creata",
  schedule_task: "Attività pianificata",
  complete_task: "Attività completata",
  move_appointment: "Appuntamento spostato",
  cancel_appointment: "Appuntamento eliminato",
};

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  return p.replace(/[^\d+]/g, "").replace(/^00/, "+");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Assistente temporaneo per numeri non registrati: saluta e chiude.
function refusalAssistant() {
  return {
    assistant: {
      name: "Radar FlyDeck — numero sconosciuto",
      firstMessage: "Ciao, sono Radar di FlyDeck. Questo numero non è collegato a nessun account FlyDeck, quindi non posso aiutarti. Se hai un account, aggiungi questo numero nelle impostazioni del profilo. Buona giornata!",
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{
          role: "system",
          content: "Sei Radar di FlyDeck. Il chiamante NON è un utente riconosciuto. Comunica con cortesia che il numero non è collegato a nessun account e chiudi subito la chiamata usando la funzione endCall dopo il saluto iniziale. Non usare nessun altro strumento e non fare domande.",
        }],
      },
      voice: { provider: "azure", voiceId: "it-IT-DiegoNeural" },
      transcriber: { provider: "deepgram", model: "nova-3", language: "it" },
      endCallFunctionEnabled: true,
      maxDurationSeconds: 60,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("VOICE_TOOLS_SECRET");
  if (secret && req.headers.get("x-vapi-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const message = body.message ?? body;
    const type: string = message.type ?? "";

    // ================= tool-calls =================
    if (type === "tool-calls") {
      const call = message.call ?? {};
      const vars = call?.assistantOverrides?.variableValues ?? call?.variableValues ?? {};
      const userId: string = vars.user_id || "";
      const list = message.toolWithToolCallList ?? message.toolCallList ?? [];
      const results: any[] = [];

      for (const item of list) {
        const tc = item.toolCall ?? item;
        const toolCallId = tc.id;
        const name: string = tc.function?.name ?? "";
        let args = tc.function?.arguments ?? {};
        if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }

        if (!userId) {
          results.push({ toolCallId, result: "Errore: utente non riconosciuto, numero non collegato." });
          continue;
        }
        if (!ALLOWED.has(name)) {
          results.push({ toolCallId, result: `Strumento non disponibile: ${name}` });
          continue;
        }
        try {
          if (RADAR_QUERY_TOOLS.has(name)) {
            results.push({ toolCallId, result: await queryRadar(admin, userId, name, args) });
            continue;
          }
          const res = await executeAction(admin, userId, name, args);
          results.push({
            toolCallId,
            result: "error" in res ? `Errore: ${res.error}` : `${LABELS[name] ?? "Fatto"}.`,
          });
        } catch (e) {
          console.error("tool exec error", name, e);
          results.push({ toolCallId, result: "Errore interno, riprova." });
        }
      }
      return json({ results });
    }

    // ================= assistant-request (chiamata in entrata) =================
    if (type === "assistant-request") {
      const call = message.call ?? {};
      const caller = normalizePhone(call?.customer?.number ?? message?.customer?.number ?? "");

      let profile: any = null;
      if (caller) {
        const { data } = await admin.from("profiles")
          .select("user_id,display_name,phone_number")
          .not("phone_number", "is", null);
        profile = (data ?? []).find((p: any) => {
          const pn = normalizePhone(p.phone_number);
          return pn && (pn === caller || pn.endsWith(caller.replace(/^\+/, "")) || caller.endsWith(pn.replace(/^\+/, "")));
        }) ?? null;
      }

      const { data: vs } = await admin.from("ai_voice_settings")
        .select("vapi_assistant_id").limit(1).maybeSingle();
      const assistantId = vs?.vapi_assistant_id as string | undefined;

      if (!profile || !assistantId) {
        return json(refusalAssistant());
      }

      const now = romeNow();
      const [daySummary, ents, projs, okr] = await Promise.all([
        buildDaySummary(admin, profile.user_id),
        queryRadar(admin, profile.user_id, "list_enterprises"),
        queryRadar(admin, profile.user_id, "list_projects"),
        queryRadar(admin, profile.user_id, "get_okr"),
      ]);
      const contextBrief = [`IMPRESE:\n${ents}`, `PROGETTI:\n${projs}`, `FOCUS ATTIVI:\n${okr}`].join("\n\n").slice(0, 4000);
      const firstName = (profile.display_name ?? "").split(" ")[0] || "";

      if (call.id) {
        await admin.from("voice_calls").insert({
          user_id: profile.user_id,
          direction: "inbound",
          phone_number: caller || null,
          vapi_call_id: String(call.id),
          status: "started",
        }).then(({ error }) => error && console.error("voice_calls insert", error));
      }

      return json({
        assistantId,
        assistantOverrides: {
          variableValues: {
            user_known: "yes",
            user_name: profile.display_name ?? "",
            user_id: profile.user_id,
            now_info: `${now.weekday} ${now.date}, ore ${now.time}`,
            day_summary: daySummary,
            context_brief: contextBrief,
          },
          firstMessage: `Ciao${firstName ? " " + firstName : ""}, sono Radar. Dimmi pure.`,
        },
      });
    }

    // ================= end-of-call-report =================
    if (type === "end-of-call-report") {
      try {
        const call = message.call ?? {};
        const callId = call.id ?? null;
        const summary = message.analysis?.summary ?? message.summary ?? null;
        const endedAt = call.endedAt ?? message.endedAt ?? new Date().toISOString();
        if (callId) {
          // outbound: inserito da process-reminders; inbound: inserito ad assistant-request
          const { data: updated } = await admin.from("voice_calls")
            .update({
              status: "completed",
              summary: summary ? String(summary).slice(0, 500) : null,
              ended_at: endedAt,
            })
            .eq("vapi_call_id", String(callId))
            .select("id");
          if (!updated || updated.length === 0) {
            const userId = call?.assistantOverrides?.variableValues?.user_id;
            if (userId) {
              await admin.from("voice_calls").insert({
                user_id: userId,
                direction: call.type === "inboundPhoneCall" ? "inbound" : "outbound",
                phone_number: call?.customer?.number ?? null,
                vapi_call_id: String(callId),
                status: "completed",
                summary: summary ? String(summary).slice(0, 500) : null,
                ended_at: endedAt,
              });
            }
          }
        }
      } catch (e) {
        console.error("end-of-call-report error", e);
      }
      return json({ ok: true });
    }

    // Altri eventi (status-update, transcript, ecc.): solo ack
    return json({ ok: true });
  } catch (e) {
    console.error("vapi-webhook error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
