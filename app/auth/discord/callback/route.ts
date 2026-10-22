import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyDiscordState, discordStateCookie, discordCookieOptions } from "@/lib/discordOAuth";
import { safeInternalPath } from "@/lib/safeRedirect";
import { getBaseUrl } from "@/lib/baseUrl";

const tokenUrl = "https://discord.com/api/oauth2/token";
const userUrl = "https://discord.com/api/users/@me";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const baseUrl = getBaseUrl();
  const errorRedirect = buildRedirect(baseUrl, "/me/profile/edit", "error");

  if (!code || !state) {
    return NextResponse.redirect(errorRedirect);
  }

  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
    return NextResponse.redirect(errorRedirect);
  }

  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${discordStateCookie}=`))?.slice(discordStateCookie.length + 1);
  if (cookie !== state) return NextResponse.redirect(errorRedirect);
  const finish = (destination: URL) => {
    const response = NextResponse.redirect(destination);
    response.cookies.set(discordStateCookie, "", { ...discordCookieOptions, maxAge: 0, secure: baseUrl.startsWith("https:") });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  const payload = verifyDiscordState(state, clientSecret);
  if (!payload) {
    return finish(errorRedirect);
  }

  try {
    const redirectUri = `${baseUrl}/auth/discord/callback`;
    const tokenRes = await fetch(tokenUrl, {
      signal: AbortSignal.timeout(8000), cache: "no-store",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return finish(errorRedirect);
    }

    const tokenData = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
    };
    const accessToken = tokenData?.access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      return finish(errorRedirect);
    }

    const userRes = await fetch(userUrl, {
      signal: AbortSignal.timeout(8000), cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return finish(errorRedirect);
    }

    const discordUser = (await userRes.json().catch(() => ({}))) as {
      id?: string;
      username?: string;
      global_name?: string | null;
    };
    if (!discordUser || typeof discordUser.id !== "string" || !/^\d{1,30}$/.test(discordUser.id)) {
      return finish(errorRedirect);
    }

    const username = typeof discordUser.global_name === "string" ? discordUser.global_name : typeof discordUser.username === "string" ? discordUser.username : null;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data: hasAccess, error: accountError } = await adminClient.rpc("portal_user_has_access", { p_user_id: payload.sub, p_session_id: payload.sid });
    if (accountError || hasAccess !== true) return finish(errorRedirect);
    const { error } = await adminClient
      .from("profiles")
      .update({
        discord_id: discordUser.id,
        discord_username: username,
        discord: username,
      })
      .eq("id", payload.sub);
    if (error) {
      return finish(errorRedirect);
    }

    return finish(buildRedirect(baseUrl, safeInternalPath(payload.next, "/me/profile/edit"), "connected"));
  } catch {
    return finish(errorRedirect);
  }
}

function buildRedirect(baseUrl: string, path: string, status: string) {
  const url = new URL(path, baseUrl);
  url.searchParams.set("discord", status);
  return url;
}
