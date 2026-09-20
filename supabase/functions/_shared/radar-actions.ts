// Logica Radar condivisa tra telegram-webhook, agente vocale ElevenLabs e promemoria.
// Nessun cambio di comportamento rispetto al codice originale di telegram-webhook.

export const ROME = "Europe/Rome";

export function romeNow() {
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

export function romeDayBounds(dateStr: string) {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: any = Object.fromEntries(dtf.formatToParts(guess).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  const offset = asUtc - guess.getTime();
  const start = new Date(guess.getTime() - offset);
  return { start, end: new Date(start.getTime() + 24 * 3600_000) };
}

// ---------- action execution ----------

export async function executeAction(
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
        is_urgent: a.is_urgent === true,
      }).select("id").single();
      if (error) throw error;
      return { table: "reminders", id: data.id };
    }
    if (name === "dismiss_reminder") {
      const { error } = await admin.from("reminders")
        .update({ is_dismissed: true })
        .eq("id", a.reminder_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "reminders", id: a.reminder_id };
    }
    if (name === "postpone_reminder") {
      const minutes = Math.min(Math.max(Number(a.minutes ?? 60), 5), 24 * 60);
      const now = romeNow();
      const [h, m] = now.time.split(":").map(Number);
      const total = h * 60 + m + minutes;
      const dayOffset = Math.floor(total / 1440);
      const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      const d = new Date(`${now.date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      const { error } = await admin.from("reminders")
        .update({ reminder_date: d.toISOString().slice(0, 10), reminder_time: `${hh}:${mm}`, call_status: null })
        .eq("id", a.reminder_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "reminders", id: a.reminder_id };
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
    if (name === "move_appointment") {
      const patch: Record<string, any> = {};
      if (a.date) patch.date = a.date;
      if (a.start_time) patch.start_time = a.start_time;
      if (a.end_time) patch.end_time = a.end_time;
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("appointments").update(patch)
        .eq("id", a.appointment_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "appointments", id: a.appointment_id };
    }
    if (name === "cancel_appointment") {
      const { error } = await admin.from("appointments").delete()
        .eq("id", a.appointment_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "appointments", id: a.appointment_id };
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

// ---------- context ----------

export async function buildContext(admin: any, userId: string) {
  const today = romeNow().date;
  const [ent, proj, tasks, appts, rem, focus, objs, krs] = await Promise.all([
    admin.from("enterprises").select("id,name,is_personal,status").eq("user_id", userId),
    admin.from("projects").select("id,name,enterprise_id,type").eq("user_id", userId),
    admin.from("tasks").select("id,title,project_id,enterprise_id,status,priority,scheduled_date,scheduled_time,estimated_minutes,deadline")
      .eq("user_id", userId).neq("status", "done").limit(150),
    admin.from("appointments").select("id,title,date,start_time,end_time,enterprise_id")
      .eq("user_id", userId).gte("date", today).order("date").limit(50),
    admin.from("reminders").select("id,title,reminder_date,reminder_time,is_urgent")
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

// ---------- day summary (testo parlato/leggibile) ----------

export async function buildDaySummary(admin: any, userId: string): Promise<string> {
  const now = romeNow();
  const ctx = await buildContext(admin, userId);
  const todayAppts = ctx.appointments.filter((a: any) => a.date === now.date)
    .map((a: any) => `${a.start_time}-${a.end_time} ${a.title}`);
  const todayTasks = ctx.tasks.filter((t: any) => t.scheduled_date === now.date)
    .map((t: any) => `${t.scheduled_time ? t.scheduled_time + " " : ""}${t.title}`);
  const todayRem = ctx.reminders.filter((r: any) => r.reminder_date === now.date)
    .map((r: any) => `${r.reminder_time ? r.reminder_time + " " : ""}${r.title}${r.is_urgent ? " (IMPORTANTE)" : ""}`);
  const backlog = ctx.tasks.filter((t: any) => t.status === "backlog").length;
  const parts = [`Oggi è ${now.weekday} ${now.date}, sono le ${now.time}.`];
  parts.push(todayAppts.length ? `Appuntamenti: ${todayAppts.join("; ")}.` : "Nessun appuntamento oggi.");
  parts.push(todayTasks.length ? `Attività pianificate: ${todayTasks.join("; ")}.` : "Nessuna attività pianificata oggi.");
  if (todayRem.length) parts.push(`Promemoria: ${todayRem.join("; ")}.`);
  parts.push(`In backlog ci sono ${backlog} attività.`);
  return parts.join("\n");
}

// ---------- definizione strumenti (condivisa voce/telegram) ----------

export const RADAR_TOOL_DEFS = [
  {
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
  {
    name: "create_reminder",
    description: "Crea un promemoria. Marca is_urgent=true solo se l'utente chiede esplicitamente una chiamata o dice che è importante o urgente.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        reminder_date: { type: "string", description: "YYYY-MM-DD" },
        reminder_time: { type: "string", description: "HH:MM" },
        enterprise_id: { type: "string" },
        is_urgent: { type: "boolean" },
      },
      required: ["title", "reminder_date"],
    },
  },
  {
    name: "dismiss_reminder",
    description: "Segna un promemoria come fatto/chiuso",
    parameters: {
      type: "object",
      properties: { reminder_id: { type: "string" } },
      required: ["reminder_id"],
    },
  },
  {
    name: "postpone_reminder",
    description: "Rimanda un promemoria di N minuti da adesso",
    parameters: {
      type: "object",
      properties: { reminder_id: { type: "string" }, minutes: { type: "number" } },
      required: ["reminder_id", "minutes"],
    },
  },
  {
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
  {
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
  {
    name: "complete_task",
    description: "Segna una task come completata",
    parameters: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "get_day_overview",
    description: "Restituisce il riepilogo aggiornato della giornata dell'utente (appuntamenti, attività, promemoria, backlog)",
    parameters: { type: "object", properties: {}, required: [] },
  },
];
