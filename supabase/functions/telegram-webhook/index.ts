import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const AI_URL = "https://ai.gateway.lovable.dev/v1";
const ROME = "Europe/Rome";

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

function romeNow() {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: parts.weekday,
  };
}

// ---------- voice ----------

async function downloadVoice(fileId: string): Promise<Uint8Array | null> {
  const fileRes = await tg("getFile", { file_id: fileId });
  const path = fileRes?.result?.file_path;
  if (!path) return null;
  const res = await fetch(`${GATEWAY_URL}/file/${path}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY!,
    },
  });
  if (!res.ok) {
    console.error("voice download failed", res.status, await res.text());
    return null;
  }
  return new Uint8Array(await res.arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function transcribe(bytes: Uint8Array, mime: string): Promise<string | null> {
  // 1) dedicated speech-to-text endpoint
  try {
    const form = new FormData();
    form.append("model", "google/gemini-3.5-transcribe");
    form.append("file", new Blob([bytes], { type: mime || "audio/ogg" }), "voice.ogg");
    const res = await fetch(`${AI_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: form,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.text) return json.text as string;
    } else {
      console.warn("STT endpoint failed", res.status, await res.text());
    }
  } catch (e) {
    console.warn("STT endpoint error", e);
  }

  // 2) fallback: multimodal chat with inline audio
  try {
    const res = await fetch(`${AI_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Trascrivi fedelmente questo audio in italiano. Rispondi solo con la trascrizione." },
            { type: "input_audio", input_audio: { data: toBase64(bytes), format: "ogg" } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("audio fallback failed", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("audio fallback error", e);
    return null;
  }
}

// ---------- tools ----------

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Crea un appuntamento nel calendario",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          start_time: { type: "string", description: "HH:MM" },
          end_time: { type: "string", description: "HH:MM" },
          description: { type: "string" },
          enterprise_id: { type: "string" },
        },
        required: ["title", "date", "start_time", "end_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Crea un promemoria",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          reminder_date: { type: "string", description: "YYYY-MM-DD" },
          reminder_time: { type: "string", description: "HH:MM" },
          enterprise_id: { type: "string" },
        },
        required: ["title", "reminder_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Crea una task in un progetto esistente",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          project_id: { type: "string" },
          enterprise_id: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          estimated_minutes: { type: "number" },
          deadline: { type: "string", description: "YYYY-MM-DD" },
          scheduled_date: { type: "string", description: "YYYY-MM-DD" },
          scheduled_time: { type: "string", description: "HH:MM" },
        },
        required: ["title", "project_id", "enterprise_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_task",
      description: "Pianifica una task esistente in una data",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "HH:MM" },
        },
        required: ["task_id", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Segna una task come completata",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Crea un nuovo progetto in un'impresa",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          enterprise_id: { type: "string" },
          type: { type: "string", enum: ["strategic", "operational", "maintenance"] },
        },
        required: ["name", "enterprise_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_enterprise",
      description: "Crea una nuova impresa",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["active", "development", "paused"] },
        },
        required: ["name"],
      },
    },
  },
];

// actions that are executed right away (with an undo button)
const INSTANT = new Set(["create_appointment", "create_reminder", "create_task", "schedule_task", "complete_task"]);

const ACTION_LABELS: Record<string, string> = {
  create_appointment: "Appuntamento",
  create_reminder: "Promemoria",
  create_task: "Task",
  schedule_task: "Task pianificata",
  complete_task: "Task completata",
  create_project: "Progetto",
  create_enterprise: "Impresa",
};

function describeAction(name: string, a: Record<string, any>): string {
  switch (name) {
    case "create_appointment":
      return `📅 <b>${a.title}</b>\n${a.date} ${a.start_time}–${a.end_time}`;
    case "create_reminder":
      return `🔔 <b>${a.title}</b>\n${a.reminder_date}${a.reminder_time ? " " + a.reminder_time : ""}`;
    case "create_task":
      return `✅ <b>${a.title}</b>${a.scheduled_date ? `\nPianificata: ${a.scheduled_date}${a.scheduled_time ? " " + a.scheduled_time : ""}` : ""}${a.deadline ? `\nScadenza: ${a.deadline}` : ""}`;
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

async function executeAction(
  admin: any,
  userId: string,
  name: string,
  a: Record<string, any>,
): Promise<{ table: string; id: string } | { error: string }> {
  try {
    if (name === "create_appointment") {
      const { data, error } = await admin.from("appointments").insert({
        user_id: userId,
        enterprise_id: a.enterprise_id ?? null,
        title: a.title,
        description: a.description ?? null,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
      }).select("id").single();
      if (error) throw error;
      return { table: "appointments", id: data.id };
    }
    if (name === "create_reminder") {
      const { data, error } = await admin.from("reminders").insert({
        user_id: userId,
        title: a.title,
        description: a.description ?? null,
        reminder_date: a.reminder_date,
        reminder_time: a.reminder_time ?? null,
        enterprise_id: a.enterprise_id ?? null,
      }).select("id").single();
      if (error) throw error;
      return { table: "reminders", id: data.id };
    }
    if (name === "create_task") {
      // Validate/resolve project: the AI may pass a non-existent or stale id
      let projectId: string | null = null;
      let enterpriseId: string | null = a.enterprise_id ?? null;

      if (a.project_id) {
        const { data: p } = await admin.from("projects")
          .select("id,enterprise_id").eq("id", a.project_id).eq("user_id", userId).maybeSingle();
        if (p) { projectId = p.id; enterpriseId = p.enterprise_id ?? enterpriseId; }
      }

      if (!projectId) {
        // validate enterprise, else fall back to the personal one
        if (enterpriseId) {
          const { data: e } = await admin.from("enterprises")
            .select("id").eq("id", enterpriseId).eq("user_id", userId).maybeSingle();
          if (!e) enterpriseId = null;
        }
        if (!enterpriseId) {
          const { data: pe } = await admin.from("enterprises")
            .select("id").eq("user_id", userId).eq("is_personal", true).maybeSingle();
          enterpriseId = pe?.id ?? null;
        }
        if (!enterpriseId) {
          const { data: anyE } = await admin.from("enterprises")
            .select("id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
          enterpriseId = anyE?.id ?? null;
        }
        if (!enterpriseId) return { error: "Nessuna impresa disponibile: creane una prima di aggiungere attività." };

        // reuse an existing operational project of that enterprise, else create one
        const { data: existing } = await admin.from("projects")
          .select("id").eq("user_id", userId).eq("enterprise_id", enterpriseId)
          .eq("type", "operational").order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (existing) projectId = existing.id;
        else {
          const { data: created, error: pErr } = await admin.from("projects").insert({
            user_id: userId,
            enterprise_id: enterpriseId,
            name: "Attività varie",
            type: "operational",
          }).select("id").single();
          if (pErr) throw pErr;
          projectId = created.id;
        }
      }

      const { data, error } = await admin.from("tasks").insert({
        user_id: userId,
        enterprise_id: enterpriseId,
        project_id: projectId,
        title: a.title,
        description: a.description ?? null,
        priority: a.priority ?? "medium",
        estimated_minutes: a.estimated_minutes ?? 30,
        status: a.scheduled_date ? "scheduled" : "backlog",
        scheduled_date: a.scheduled_date ?? null,
        scheduled_time: a.scheduled_time ?? null,
        deadline: a.deadline ?? null,
      }).select("id").single();
      if (error) throw error;
      return { table: "tasks", id: data.id };
    }

    if (name === "schedule_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "scheduled", scheduled_date: a.date, scheduled_time: a.time ?? null })
        .eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "complete_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "create_project") {
      const { data, error } = await admin.from("projects").insert({
        user_id: userId,
        enterprise_id: a.enterprise_id,
        name: a.name,
        type: a.type ?? "operational",
      }).select("id").single();
      if (error) throw error;
      return { table: "projects", id: data.id };
    }
    if (name === "create_enterprise") {
      const { data, error } = await admin.from("enterprises").insert({
        user_id: userId,
        name: a.name,
        description: a.description ?? null,
        status: a.status ?? "development",
        color: "220 80% 55%",
      }).select("id").single();
      if (error) throw error;
      return { table: "enterprises", id: data.id };
    }
    return { error: `Azione sconosciuta: ${name}` };
  } catch (e: any) {
    console.error("executeAction error", name, e?.message ?? e);
    return { error: e?.message ?? "errore sconosciuto" };
  }
}

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

async function buildContext(admin: any, userId: string) {
  const today = romeNow().date;
  const [ent, proj, tasks, appts, rem, focus, objs, krs] = await Promise.all([
    admin.from("enterprises").select("id,name,is_personal,status").eq("user_id", userId),
    admin.from("projects").select("id,name,enterprise_id,type").eq("user_id", userId),
    admin.from("tasks").select("id,title,project_id,enterprise_id,status,priority,scheduled_date,deadline")
      .eq("user_id", userId).neq("status", "done").limit(150),
    admin.from("appointments").select("id,title,date,start_time,end_time,enterprise_id")
      .eq("user_id", userId).gte("date", today).order("date").limit(50),
    admin.from("reminders").select("id,title,reminder_date,reminder_time")
      .eq("user_id", userId).eq("is_dismissed", false).gte("reminder_date", today).limit(50),
    admin.from("focus_periods").select("id,name,enterprise_id,status").eq("user_id", userId).eq("status", "active"),
    admin.from("objectives").select("id,title,focus_period_id,enterprise_id").eq("user_id", userId).eq("status", "active"),
    admin.from("key_results").select("id,title,objective_id,enterprise_id,current_value,target_value").eq("user_id", userId),
  ]);
  return {
    enterprises: ent.data ?? [],
    projects: proj.data ?? [],
    tasks: tasks.data ?? [],
    appointments: appts.data ?? [],
    reminders: rem.data ?? [],
    focus_periods: focus.data ?? [],
    objectives: objs.data ?? [],
    key_results: krs.data ?? [],
  };
}

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
          await send(chatId, `✅ ${describeAction(name, args)}`, {
            reply_markup: { inline_keyboard: [[{ text: "↩️ Annulla", callback_data: `undo:${actionRow.id}` }]] },
          });
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
