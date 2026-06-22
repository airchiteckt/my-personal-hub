import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { code, redirect_uri, state } = await req.json();
    if (!code || !redirect_uri || !state) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let uid: string;
    try {
      const decoded = JSON.parse(atob(state));
      uid = decoded.uid;
      if (!uid) throw new Error("no uid");
      if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error("state expired");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid state" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret, redirect_uri, grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed", tokens);
      return new Response(JSON.stringify({ error: "Token exchange failed", details: tokens }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    if (!userInfo.email) {
      return new Response(JSON.stringify({ error: "Could not read Google email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    // Check if this account is already connected for this user
    const { data: existing } = await admin
      .from("google_calendar_connections")
      .select("id, refresh_token")
      .eq("user_id", uid)
      .eq("google_email", userInfo.email)
      .maybeSingle();

    let connectionId: string;
    if (existing) {
      const { error } = await admin.from("google_calendar_connections").update({
        access_token: tokens.access_token,
        // Google may omit refresh_token on re-consent; keep old one in that case
        refresh_token: tokens.refresh_token ?? existing.refresh_token,
        token_expires_at: expiresAt,
        scope: tokens.scope ?? null,
      }).eq("id", existing.id);
      if (error) throw error;
      connectionId = existing.id;
    } else {
      if (!tokens.refresh_token) {
        return new Response(JSON.stringify({ error: "Google did not return a refresh token. Revoke FlyDeck access in your Google account and try again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: inserted, error } = await admin.from("google_calendar_connections").insert({
        user_id: uid,
        google_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        scope: tokens.scope ?? null,
      }).select("id").single();
      if (error) throw error;
      connectionId = inserted.id;
    }

    return new Response(JSON.stringify({ ok: true, email: userInfo.email, connection_id: connectionId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
