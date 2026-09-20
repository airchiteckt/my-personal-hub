import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { romeNow } from "../_shared/radar-actions.ts";

// Cron ogni 5 minuti: per ogni promemoria scaduto e non chiuso:
// 1) messaggio Telegram di Radar  2) email  3) se urgente -> chiamata vocale ElevenLabs/Twilio

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TG_URL = "https://connector-gateway.lovable.dev/telegram";
const EL_URL = "https://api.elevenlabs.io";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMin = (t?: string | null) => {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

async function tgSend(chatId: number, text: string) {
  if (!TELEGRAM_API_KEY || !LOVABLE_API_KEY) return;
  await fetch(`${TG_URL}/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch((e) => console.error("tg send failed", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = romeNow();
    const nowMin = toMin(now.time)!;

    // Promemoria di oggi (o passati) non chiusi, con orario già raggiunto (o senza orario)
    const { data: due, error } = await admin.from("reminders")
      .select("id,user_id,title,description,reminder_date,reminder_time,is_urgent,call_status")
      .eq("is_dismissed", false)
      .lte("reminder_date", now.date)
      .is("call_status", null);
    if (error) throw error;

    const results: any[] = [];

    for (const r of due ?? []) {
      const tMin = toMin(r.reminder_time);
      const isDue = r.reminder_date < now.date || tMin === null || tMin <= nowMin;
      if (!isDue) continue;

      // dedupe: un solo ciclo di notifiche per promemoria
      const dedupe = `reminder:${r.id}`;
      const { data: inserted } = await admin.from("radar_nudges").insert({
        user_id: r.user_id, kind: "reminder", dedupe_key: dedupe,
        entity_table: "reminders", entity_id: r.id,
      }).select("id").maybeSingle();
      if (!inserted) continue; // già notificato

      // 1) Telegram
      const { data: link } = await admin.from("telegram_links")
        .select("chat_id").eq("user_id", r.user_id).maybeSingle();
      if (link?.chat_id) {
        await tgSend(link.chat_id,
          `🔔 <b>Promemoria${r.is_urgent ? " IMPORTANTE" : ""}</b>\n<b>${esc(r.title)}</b>` +
          (r.description ? `\n${esc(String(r.description).slice(0, 300))}` : ""));
      }

      // 2) Email
      const { data: emailRow } = await admin.rpc("get_user_email", { _user_id: r.user_id });
      const email = typeof emailRow === "string" ? emailRow : null;
      if (email) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: email,
            subject: `🔔 Promemoria${r.is_urgent ? " importante" : ""}: ${r.title}`,
            html: `<p><strong>${esc(r.title)}</strong></p>${r.description ? `<p>${esc(String(r.description))}</p>` : ""}<p style="color:#888;font-size:12px">FlyDeck · Radar</p>`,
          }),
        }).catch((e) => console.error("email failed", e));
      }

      // 3) Chiamata vocale se urgente
      let callStatus = r.is_urgent ? "failed" : "not_required";
      if (r.is_urgent && ELEVENLABS_API_KEY) {
        try {
          const { data: profile } = await admin.from("profiles")
            .select("phone_number,display_name").eq("user_id", r.user_id).maybeSingle();
          const { data: vs } = await admin.from("ai_voice_settings")
            .select("convai_agent_id,convai_phone_number_id").limit(1).maybeSingle();

          if (profile?.phone_number && vs?.convai_agent_id && vs?.convai_phone_number_id) {
            const res = await fetch(`${EL_URL}/v1/convai/twilio/outbound-call`, {
              method: "POST",
              headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({
                agent_id: vs.convai_agent_id,
                agent_phone_number_id: vs.convai_phone_number_id,
                to_number: profile.phone_number,
                conversation_initiation_client_data: {
                  type: "conversation_initiation_client_data",
                  dynamic_variables: {
                    user_known: "yes",
                    user_name: profile.display_name ?? "",
                    user_id: r.user_id,
                    now_info: `${now.weekday} ${now.date}, ore ${now.time}`,
                    day_summary: `Promemoria importante in corso: "${r.title}"${r.description ? ` — ${String(r.description).slice(0, 200)}` : ""}. Chiedi se è stato gestito: se sì usa lo strumento per chiuderlo, altrimenti proponi di rimandarlo.`,
                  },
                  conversation_config_override: {
                    agent: {
                      first_message: `Ciao, sono Radar di FlyDeck. Ti chiamo per un promemoria importante: ${r.title}. Sei riuscito a gestirlo?`,
                    },
                  },
                },
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && json?.conversation_id) {
              callStatus = "completed";
              await admin.from("voice_calls").insert({
                user_id: r.user_id,
                direction: "outbound",
                phone_number: profile.phone_number,
                reminder_id: r.id,
                elevenlabs_conversation_id: json.conversation_id,
                status: "started",
              });
            } else {
              console.error("outbound call failed", res.status, JSON.stringify(json));
            }
          } else {
            console.error("outbound call skipped: missing phone/agent config", r.user_id);
          }
        } catch (e) {
          console.error("outbound call error", e);
        }
      } else if (r.is_urgent && !ELEVENLABS_API_KEY) {
        console.error("ELEVENLABS_API_KEY mancante: chiamata urgente saltata");
      }

      await admin.from("reminders").update({ call_status: callStatus }).eq("id", r.id);
      results.push({ id: r.id, urgent: r.is_urgent, call: callStatus });
    }

    return new Response(JSON.stringify({ ok: true, at: now.time, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
