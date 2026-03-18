import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BRAND = {
  primary: "hsl(222, 60%, 25%)",
  primaryForeground: "hsl(210, 40%, 98%)",
  foreground: "hsl(222, 25%, 10%)",
  muted: "hsl(220, 10%, 45%)",
  background: "hsl(220, 20%, 97%)",
  radius: "0.75rem",
};

function reminderLabel(type: string): string {
  switch (type) {
    case "24h": return "24 ore";
    case "1h": return "1 ora";
    case "15m": return "15 minuti";
    default: return type;
  }
}

function buildEmailHtml(
  appointmentTitle: string,
  appointmentDate: string,
  startTime: string,
  endTime: string,
  reminderType: string,
  description?: string | null,
): string {
  const label = reminderLabel(reminderType);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.background};padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 40px 24px;text-align:center;background:${BRAND.primary};">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:${BRAND.primaryForeground};letter-spacing:-0.5px;">✈️ FlyDeck</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h2 style="margin:0 0 16px;font-size:20px;color:${BRAND.foreground};">⏰ Promemoria appuntamento</h2>
          <p style="color:${BRAND.foreground};line-height:1.6;margin:0 0 8px;">
            Il tuo appuntamento <strong>${appointmentTitle}</strong> inizia tra <strong>${label}</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
            <tr><td style="padding:16px 20px;background:${BRAND.background};border-radius:${BRAND.radius};">
              <p style="margin:0 0 4px;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">📅 Data</p>
              <p style="margin:0;color:${BRAND.foreground};font-size:16px;font-weight:600;">${appointmentDate}</p>
              <p style="margin:8px 0 0;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">🕐 Orario</p>
              <p style="margin:0;color:${BRAND.foreground};font-size:16px;font-weight:600;">${startTime} – ${endTime}</p>
              ${description ? `
              <p style="margin:8px 0 0;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">📝 Note</p>
              <p style="margin:0;color:${BRAND.foreground};font-size:14px;">${description}</p>
              ` : ""}
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
            <a href="https://www.flydeck.app/calendar" target="_blank" style="display:inline-block;padding:12px 32px;background:${BRAND.primary};color:${BRAND.primaryForeground};text-decoration:none;border-radius:${BRAND.radius};font-weight:600;font-size:14px;">Apri Calendario</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 40px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:${BRAND.muted};">
            © ${new Date().getFullYear()} FlyDeck — radar.flydeck.app
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch pending reminders that are due
    const { data: pendingReminders, error: fetchError } = await supabase
      .from("appointment_reminders")
      .select("*, appointments(*)")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (fetchError) throw fetchError;
    if (!pendingReminders || pendingReminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pendingReminders.length} appointment reminders`);

    let sent = 0;
    let failed = 0;

    for (const reminder of pendingReminders) {
      try {
        const appointment = reminder.appointments;
        if (!appointment) {
          // Appointment was deleted, skip
          await supabase
            .from("appointment_reminders")
            .update({ status: "failed", error_message: "Appointment not found" })
            .eq("id", reminder.id);
          failed++;
          continue;
        }

        // Get user email
        const { data: emailData } = await supabase.rpc("get_user_email", {
          _user_id: reminder.user_id,
        });

        if (!emailData) {
          await supabase
            .from("appointment_reminders")
            .update({ status: "failed", error_message: "User email not found" })
            .eq("id", reminder.id);
          failed++;
          continue;
        }

        // Format date for display
        const dateObj = new Date(appointment.date + "T00:00:00");
        const formattedDate = dateObj.toLocaleDateString("it-IT", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const html = buildEmailHtml(
          appointment.title,
          formattedDate,
          appointment.start_time,
          appointment.end_time,
          reminder.reminder_type,
          appointment.description,
        );

        const label = reminderLabel(reminder.reminder_type);
        const subject = `⏰ ${appointment.title} — tra ${label}`;

        // Send via Resend
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "FlyDeck <noreply@radar.flydeck.app>",
            to: [emailData],
            subject,
            html,
          }),
        });

        const resendData = await resendRes.json();

        if (!resendRes.ok) {
          throw new Error(`Resend error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
        }

        // Mark as sent
        await supabase
          .from("appointment_reminders")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", reminder.id);

        sent++;
        console.log(`Sent ${reminder.reminder_type} reminder for "${appointment.title}" to ${emailData}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed reminder ${reminder.id}:`, msg);
        await supabase
          .from("appointment_reminders")
          .update({ status: "failed", error_message: msg })
          .eq("id", reminder.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ processed: pendingReminders.length, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Error processing reminders:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
