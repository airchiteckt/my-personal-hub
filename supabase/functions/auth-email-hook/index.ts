import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Brand colors from FlyDeck design system
const BRAND = {
  primary: "hsl(222, 60%, 25%)",
  primaryForeground: "hsl(210, 40%, 98%)",
  foreground: "hsl(222, 25%, 10%)",
  muted: "hsl(220, 10%, 45%)",
  background: "hsl(220, 20%, 97%)",
  radius: "0.75rem",
};

function baseTemplate(title: string, body: string): string {
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
          <h2 style="margin:0 0 16px;font-size:20px;color:${BRAND.foreground};">${title}</h2>
          ${body}
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

function buttonHtml(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
    <a href="${url}" target="_blank" style="display:inline-block;padding:12px 32px;background:${BRAND.primary};color:${BRAND.primaryForeground};text-decoration:none;border-radius:${BRAND.radius};font-weight:600;font-size:14px;">${text}</a>
  </td></tr></table>`;
}

function renderEmail(type: string, email: string, confirmationUrl: string, token?: string): string {
  switch (type) {
    case "signup":
      return baseTemplate("Conferma la tua registrazione", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Ciao! Benvenuto su FlyDeck. Clicca il pulsante per verificare il tuo indirizzo email.</p>
        ${buttonHtml("Verifica Email", confirmationUrl)}
        <p style="color:${BRAND.muted};font-size:13px;">Se non hai creato un account, ignora questa email.</p>
      `);
    case "recovery":
      return baseTemplate("Reimposta la tua password", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Hai richiesto il ripristino della password per il tuo account FlyDeck.</p>
        ${buttonHtml("Reimposta Password", confirmationUrl)}
        <p style="color:${BRAND.muted};font-size:13px;">Se non hai richiesto il ripristino, ignora questa email. Il link scade tra 1 ora.</p>
      `);
    case "magiclink":
      return baseTemplate("Il tuo link di accesso", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Clicca il pulsante per accedere a FlyDeck.</p>
        ${buttonHtml("Accedi a FlyDeck", confirmationUrl)}
        <p style="color:${BRAND.muted};font-size:13px;">Il link scade tra 10 minuti.</p>
      `);
    case "invite":
      return baseTemplate("Sei stato invitato", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Sei stato invitato a unirti a FlyDeck! Clicca per accettare l'invito.</p>
        ${buttonHtml("Accetta Invito", confirmationUrl)}
      `);
    case "email_change":
      return baseTemplate("Conferma cambio email", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Hai richiesto di cambiare il tuo indirizzo email su FlyDeck. Conferma cliccando il pulsante.</p>
        ${buttonHtml("Conferma Cambio Email", confirmationUrl)}
        <p style="color:${BRAND.muted};font-size:13px;">Se non hai richiesto questo cambio, ignora questa email.</p>
      `);
    case "reauthentication":
      return baseTemplate("Codice di verifica", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Il tuo codice di verifica per FlyDeck è:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="display:inline-block;padding:16px 32px;background:${BRAND.background};border-radius:${BRAND.radius};font-size:28px;font-weight:700;letter-spacing:4px;color:${BRAND.foreground};">${token || "------"}</span>
        </div>
        <p style="color:${BRAND.muted};font-size:13px;">Il codice scade tra 10 minuti.</p>
      `);
    default:
      return baseTemplate("Notifica da FlyDeck", `
        <p style="color:${BRAND.foreground};line-height:1.6;">Hai una nuova notifica da FlyDeck.</p>
        ${confirmationUrl ? buttonHtml("Apri FlyDeck", confirmationUrl) : ""}
      `);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const payload = await req.json();
    
    // Supabase Send Email Hook payload structure
    const user = payload.user || {};
    const emailData = payload.email_data || {};
    
    const email = user.email || payload.email;
    const type = emailData.email_action_type || payload.type || "unknown";
    const token_hash = emailData.token_hash || payload.token_hash;
    const token = emailData.token || payload.token;
    const redirectTo = emailData.redirect_to || "";
    const siteUrl = emailData.site_url || "https://www.flydeck.app";
    
    console.log("Auth email hook received:", JSON.stringify({ type, email }));

    // Build confirmation URL for recovery to redirect to our reset password page
    let finalUrl = confirmation_url || "";
    if (type === "recovery" && token_hash) {
      const siteUrl = "https://www.flydeck.app";
      finalUrl = `${siteUrl}/reset-password#access_token=${token_hash}&type=recovery`;
    }

    const html = renderEmail(type, email, finalUrl, token);

    const subjectMap: Record<string, string> = {
      signup: "Conferma la tua registrazione su FlyDeck",
      recovery: "Reimposta la tua password — FlyDeck",
      magiclink: "Il tuo link di accesso a FlyDeck",
      invite: "Sei stato invitato su FlyDeck",
      email_change: "Conferma cambio email — FlyDeck",
      reauthentication: "Codice di verifica — FlyDeck",
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FlyDeck <noreply@radar.flydeck.app>",
        to: [email],
        subject: subjectMap[type] || "Notifica da FlyDeck",
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      throw new Error(`Resend API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    console.log("Email sent successfully:", data.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in auth-email-hook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
