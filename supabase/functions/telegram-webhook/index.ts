import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ROME, romeNow, executeAction, buildContext, RADAR_TOOL_DEFS } from "../_shared/radar-actions.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const AI_URL = "https://ai.gateway.lovable.dev/v1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

// ---------- helpers ----------

async function deriveWebhookSecret(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) console.error(`Telegram ${method} failed`, res.status, JSON.stringify(json));
  return json;
}

const send = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });



// ---------- tools ----------

const TOOLS = RADAR_TOOL_DEFS.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));

// actions that are executed right away (with an undo button)
const INSTANT = new Set(["create_appointment", "create_reminder", "create_task", "schedule_task", "complete_task", "dismiss_reminder", "postpone_reminder"]);

const ACTION_LABELS: Record<string, string> = {
  create_appointment: "Appuntamento",
  create_reminder: "Promemoria",
  create_task: "Task",
  schedule_task: "Task pianificata",
  complete_task: "Task completata",
  create_project: "Progetto",
  create_enterprise: "Impresa",
  dismiss_reminder: "Promemoria chiuso",
  postpone_reminder: "Promemoria rimandato",
};

function describeAction(name: string, a: Record<string, any>): string {
  switch (name) {
    case "create_appointment":
      return `📅 <b>${a.title}</b>
${a.date} ${a.start_time}–${a.end_time}`;
    case "create_reminder":
      return `🔔 <b>${a.title}</b>
${a.reminder_date}${a.reminder_time ? " " + a.reminder_time : ""}`;
    case "dismiss_reminder":
      return `🔕 Promemoria chiuso`;
    case "postpone_reminder":
      return `⏰ Promemoria rimandato di ${a.minutes} min`;
    case "create_task":
      return `✅ <b>${a.title}</b>${a.scheduled_date ? `
Pianificata: ${a.scheduled_date}${a.scheduled_time ? " " + a.scheduled_time : ""}` : ""}${a.deadline ? `
Scadenza: ${a.deadline}` : ""}`;
    case "schedule_task":
      return `🗓 Task pianificata per ${a.date}${a.time ? " " + a.time : ""}`;
    case "complete_task":
      return `✔️ Task completata`;
    case "create_project":
      return `📁 Progetto <b>${a.name}</b>`;
    case "create_enterprise":
      return `🏢 Impresa <b>${a.name}</b>`;
    default:
      return name;
  }
}

// ---------- action execution ----------

async function undoAction(admin: any, userId: string, row: any): Promise<boolean> {
  try {
    if (row.action_name === "schedule_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "backlog", scheduled_date: null, scheduled_time: null })
        .eq("id", row.entity_id).eq("user_id", userId);
      return !error;
    }
    if (row.action_name === "complete_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "backlog", completed_at: null })
        .eq("id", row.entity_id).eq("user_id", userId);
      return !error;
    }
    const { error } = await admin.from(row.entity_table).delete()
      .eq("id", row.entity_id).eq("user_id", userId);
    return !error;
  } catch (e) {
    console.error("undo error", e);
    return false;
  }
}

// ---------- context ----------

// ---------- main ----------

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    if (!TELEGRAM_API_KEY || !LOVABLE_API_KEY) {
      console.error("Missing TELEGRAM_API_KEY or LOVABLE_API_KEY");
      return new Response("not configured", { status: 500 });
    }

    const expected = await deriveWebhookSecret(TELEGRAM_API_KEY);
    if (!safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), expected)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const update = await req.json();

    // ----- callback buttons -----
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id;
      const [kind, actionId] = String(cq.data ?? "").split(":");
      await tg("answerCallbackQuery", { callback_query_id: cq.id });

      const { data: link } = await admin.from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle();
      if (!link) return new Response(JSON.stringify({ ok: true }));

      // ----- Radar proattivo -----
      if (kind === "rd") {
        const [, act, target] = String(cq.data ?? "").split(":");
        const uid = link.user_id;
        const todayRome = new Intl.DateTimeFormat("sv-SE", { timeZone: ROME }).format(new Date());
        const tomorrow = new Intl.DateTimeFormat("sv-SE", { timeZone: ROME })
          .format(new Date(Date.now() + 86400_000));
        const nowMin = (() => {
          const p = new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
          const [h, m] = p.split(":").map(Number);
          return h * 60 + m;
        })();
        const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

        const getTask = async () => (await admin.from("tasks").select("*").eq("id", target).eq("user_id", uid).maybeSingle()).data;
        let reply = "Ok.";

        if (act === "done") {
          await admin.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", target).eq("user_id", uid);
          reply = "✅ Segnata come completata. Ottimo.";
        } else if (act === "m15" || act === "m30") {
          const t = await getTask();
          const add = act === "m15" ? 15 : 30;
          if (t) await admin.from("tasks").update({ estimated_minutes: (t.estimated_minutes ?? 30) + add }).eq("id", target);
          reply = `⏳ Aggiunti ${add} minuti. Continua pure.`;
        } else if (act === "snz") {
          const t = await getTask();
          if (t?.scheduled_time) {
            const [h, m] = String(t.scheduled_time).split(":").map(Number);
            await admin.from("tasks").update({ scheduled_time: hhmm(h * 60 + m + 30) }).eq("id", target);
          }
          reply = "⏭ Spostata di 30 minuti.";
        } else if (act === "tmr") {
          const t = await getTask();
          await admin.from("tasks").update({
            scheduled_date: tomorrow,
            postpone_count: (t?.postpone_count ?? 0) + 1,
          }).eq("id", target).eq("user_id", uid);
          reply = "📅 Spostata a domani.";
        } else if (act === "skip") {
          const t = await getTask();
          await admin.from("tasks").update({
            scheduled_date: null, scheduled_time: null, status: "backlog",
            postpone_count: (t?.postpone_count ?? 0) + 1,
          }).eq("id", target).eq("user_id", uid);
          reply = "🚫 Tolta dall'agenda di oggi.";
        } else if (act === "plan") {
          const slot = Math.ceil((nowMin + 5) / 15) * 15;
          await admin.from("tasks").update({
            scheduled_date: todayRome, scheduled_time: hhmm(slot), status: "scheduled",
          }).eq("id", target).eq("user_id", uid);
          reply = `📌 Pianificata oggi alle ${hhmm(slot)}.`;
        } else if (act === "del") {
          await admin.from("tasks").delete().eq("id", target).eq("user_id", uid);
          reply = "🗑 Eliminata.";
        } else if (act === "close") {
          const { data: open } = await admin.from("tasks").select("id,postpone_count")
            .eq("user_id", uid).eq("scheduled_date", todayRome).neq("status", "done");
          for (const t of open ?? []) {
            await admin.from("tasks").update({ scheduled_date: tomorrow, postpone_count: (t.postpone_count ?? 0) + 1 }).eq("id", t.id);
          }
          reply = `🌇 Giornata chiusa. ${open?.length ?? 0} attività spostate a domani.`;
        } else if (act === "ack") {
          reply = "👍 Buon lavoro.";
        } else if (act === "no") {
          reply = "Ok, lascio stare.";
        }

        if (target && target !== "none" && target !== "day") {
          await admin.from("radar_nudges").update({ response: act, responded_at: new Date().toISOString() })
            .eq("user_id", uid).eq("entity_id", target).is("response", null);
        } else {
          await admin.from("radar_nudges").update({ response: act, responded_at: new Date().toISOString() })
            .eq("user_id", uid).is("response", null).gte("sent_at", new Date(Date.now() - 6 * 3600_000).toISOString());
        }

        if (cq.message?.message_id) {
          await tg("editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
        }
        await send(chatId, reply);
        return new Response(JSON.stringify({ ok: true }));
      }

      const { data: row } = await admin.from("telegram_pending_actions")
        .select("*").eq("id", actionId).eq("user_id", link.user_id).maybeSingle();
      if (!row) {
        await send(chatId, "Azione non più disponibile.");
        return new Response(JSON.stringify({ ok: true }));
      }

      if (kind === "ok" && row.status === "pending") {
        const res: any = await executeAction(admin, link.user_id, row.action_name, row.args);
        if (res.error) {
          await admin.from("telegram_pending_actions").update({ status: "failed" }).eq("id", row.id);
          await send(chatId, `⚠️ Non sono riuscito a salvare: ${res.error}`);
        } else {
          await admin.from("telegram_pending_actions")
            .update({ status: "executed", entity_table: res.table, entity_id: res.id }).eq("id", row.id);
          await send(chatId, `✅ Salvato.\n${describeAction(row.action_name, row.args)}`);
        }
      } else if (kind === "no" && row.status === "pending") {
        await admin.from("telegram_pending_actions").update({ status: "rejected" }).eq("id", row.id);
        await send(chatId, "❌ Annullato.");
      } else if (kind === "undo" && row.status === "executed") {
        const ok = await undoAction(admin, link.user_id, row);
        await admin.from("telegram_pending_actions").update({ status: ok ? "undone" : "executed" }).eq("id", row.id);
        await send(chatId, ok ? "↩️ Annullato." : "⚠️ Non sono riuscito ad annullare.");
      }
      return new Response(JSON.stringify({ ok: true }));
    }

    const message = update.message ?? update.edited_message;
    const chatId = message?.chat?.id;
    if (!chatId) return new Response(JSON.stringify({ ok: true }));

    const { data: link } = await admin.from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle();

    // ----- linking flow -----
    if (!link) {
      const raw = (message.text ?? "").trim();
      const code = raw.replace(/^\/start\s*/i, "").trim().toUpperCase();
      if (!code) {
        await send(chatId, "👋 Ciao! Per collegare il tuo account FlyDeck apri <b>Impostazioni → Telegram</b>, genera il codice e inviamelo qui.");
        return new Response(JSON.stringify({ ok: true }));
      }
      const { data: codeRow } = await admin.from("telegram_link_codes")
        .select("*").eq("code", code).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!codeRow) {
        await send(chatId, "❌ Codice non valido o scaduto. Generane uno nuovo da Impostazioni → Telegram.");
        return new Response(JSON.stringify({ ok: true }));
      }
      await admin.from("telegram_links").insert({
        user_id: codeRow.user_id,
        chat_id: chatId,
        telegram_username: message.from?.username ?? null,
        telegram_first_name: message.from?.first_name ?? null,
      });
      await admin.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", code);
      await send(chatId, "✅ Account collegato! Scrivimi (o mandami un vocale) cosa vuoi inserire: appuntamenti, promemoria, attività.");
      return new Response(JSON.stringify({ ok: true }));
    }

    const userId = link.user_id;

    // ----- input: text or voice -----
    let text: string | null = message.text ?? message.caption ?? null;
    const audio = message.voice ?? message.audio;
    if (!text && audio) {
      await tg("sendChatAction", { chat_id: chatId, action: "typing" });
      const bytes = await downloadVoice(audio.file_id);
      if (!bytes) {
        await send(chatId, "⚠️ Non sono riuscito a scaricare il vocale.");
        return new Response(JSON.stringify({ ok: true }));
      }
      text = await transcribe(bytes, audio.mime_type ?? "audio/ogg");
      if (!text) {
        await send(chatId, "⚠️ Non sono riuscito a trascrivere il vocale, riprova.");
        return new Response(JSON.stringify({ ok: true }));
      }
      await send(chatId, `🎙 <i>${text}</i>`);
    }

    if (!text) return new Response(JSON.stringify({ ok: true }));

    if (/^\/start/i.test(text)) {
      await send(chatId, "Sono Radar. Dimmi cosa inserire: appuntamenti, promemoria, task. Puoi anche mandarmi note vocali.\n\n/reset per svuotare la conversazione.");
      return new Response(JSON.stringify({ ok: true }));
    }
    if (/^\/reset/i.test(text)) {
      await admin.from("telegram_conversations").upsert({ chat_id: chatId, user_id: userId, messages: [], updated_at: new Date().toISOString() });
      await send(chatId, "🧹 Conversazione azzerata.");
      return new Response(JSON.stringify({ ok: true }));
    }
    if (/^\/pausa/i.test(text)) {
      const hours = Number((/\d+/.exec(text) ?? [])[0] ?? 3);
      await admin.from("radar_preferences").upsert({
        user_id: userId,
        snoozed_until: new Date(Date.now() + hours * 3600_000).toISOString(),
      }, { onConflict: "user_id" });
      await send(chatId, `🔕 Ok, non ti disturbo per ${hours} ore. Scrivi /riprendi per riattivarmi.`);
      return new Response(JSON.stringify({ ok: true }));
    }
    if (/^\/riprendi/i.test(text)) {
      await admin.from("radar_preferences").upsert({ user_id: userId, snoozed_until: null, enabled: true }, { onConflict: "user_id" });
      await send(chatId, "🔔 Torno a monitorare la tua giornata.");
      return new Response(JSON.stringify({ ok: true }));
    }

    await tg("sendChatAction", { chat_id: chatId, action: "typing" });

    // ----- AI -----
    const ctx = await buildContext(admin, userId);
    const now = romeNow();
    const { data: convo } = await admin.from("telegram_conversations").select("messages").eq("chat_id", chatId).maybeSingle();
    const history: any[] = Array.isArray(convo?.messages) ? convo!.messages.slice(-12) : [];

    const systemPrompt = `Sei Radar, l'assistente di FlyDeck su Telegram. Rispondi SEMPRE in italiano, brevissimo (max 2 frasi), niente fronzoli.

Oggi è ${now.weekday} ${now.date}, ora locale ${now.time} (Europe/Rome).

Puoi leggere i dati dell'utente e creare appuntamenti, promemoria, task, progetti e imprese tramite i tool.
REGOLE:
- Usa SEMPRE gli id UUID presi dal contesto per enterprise_id, project_id, task_id. Non inventare id.
- Se serve un progetto e l'utente non lo specifica, scegli il più coerente dal contesto; se non esiste nulla di sensato, usa un promemoria invece della task.
- Date sempre in formato YYYY-MM-DD, orari HH:MM. "domani", "venerdì" ecc. vanno risolti rispetto alla data di oggi.
- Per gli appuntamenti, se manca la durata usa 60 minuti.
- Non ripetere azioni già eseguite nella conversazione.
- Quando l'utente chiede informazioni, rispondi con i dati del contesto.
- DOMINIO: il sito è SOLO https://www.flydeck.app. Non usare MAI altri domini (flydeck.io, flydeck.com, ecc.) e non inventare URL.

CONTESTO UTENTE (JSON):
${JSON.stringify(ctx)}`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: text },
    ];

    const aiRes = await fetch(`${AI_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: aiMessages, tools: TOOLS }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text();
      console.error("AI error", aiRes.status, body);
      await send(chatId, aiRes.status === 429
        ? "⏳ Troppe richieste, riprova tra poco."
        : aiRes.status === 402
          ? "⚠️ Crediti AI esauriti."
          : "⚠️ Errore AI, riprova.");
      return new Response(JSON.stringify({ ok: true }));
    }

    const aiJson = await aiRes.json();
    const choice = aiJson?.choices?.[0]?.message ?? {};
    const reply: string = (choice.content ?? "").trim();
    const toolCalls: any[] = choice.tool_calls ?? [];

    if (reply) await send(chatId, reply);

    for (const tc of toolCalls) {
      const name = tc.function?.name;
      let args: Record<string, any> = {};
      try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* ignore */ }
      if (!name) continue;

      const { data: actionRow } = await admin.from("telegram_pending_actions").insert({
        user_id: userId, chat_id: chatId, action_name: name, args,
        status: INSTANT.has(name) ? "executing" : "pending",
      }).select("id").single();

      if (INSTANT.has(name)) {
        const res: any = await executeAction(admin, userId, name, args);
        if (res.error) {
          await admin.from("telegram_pending_actions").update({ status: "failed" }).eq("id", actionRow.id);
          await send(chatId, `⚠️ ${ACTION_LABELS[name] ?? name}: non salvato (${res.error}).`);
        } else {
          await admin.from("telegram_pending_actions")
            .update({ status: "executed", entity_table: res.table, entity_id: res.id }).eq("id", actionRow.id);
          
          const undoAllowed = ["create_appointment", "create_reminder", "create_task", "schedule_task", "complete_task"].includes(name);
          const extra = undoAllowed ? {
            reply_markup: { inline_keyboard: [[{ text: "↩️ Annulla", callback_data: `undo:${actionRow.id}` }]] },
          } : {};
          
          await send(chatId, `✅ ${describeAction(name, args)}`, extra);
        }
      } else {
        await send(chatId, `Confermi?\n${describeAction(name, args)}`, {
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Conferma", callback_data: `ok:${actionRow.id}` },
              { text: "❌ Annulla", callback_data: `no:${actionRow.id}` },
            ]],
          },
        });
      }
    }

    const newHistory = [
      ...history,
      { role: "user", content: text },
      { role: "assistant", content: reply || (toolCalls.length ? `[azioni: ${toolCalls.map((t) => t.function?.name).join(", ")}]` : "ok") },
    ].slice(-12);
    await admin.from("telegram_conversations").upsert({
      chat_id: chatId, user_id: userId, messages: newHistory, updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    console.error("telegram-webhook error", e?.message ?? e);
    return new Response(JSON.stringify({ ok: true }));
  }
});
