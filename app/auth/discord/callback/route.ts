import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { getBaseUrl } from "@/lib/baseUrl";

type ConnectPayload = {
  sub: string;
  next?: string;
  iat: number;
  nonce: string;
};

const tokenUrl = "https://discord.com/api/oauth2/token";
const userUrl = "https://discord.com/api/users/@me";
const stateTtlMs = 10 * 60 * 1000;

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

  const payload = verifyState(state, clientSecret);
  if (!payload) {
    return NextResponse.redirect(errorRedirect);
  }

  if (Date.now() - payload.iat > stateTtlMs) {
    return NextResponse.redirect(errorRedirect);
  }

  const redirectUri = `${baseUrl}/auth/discord/callback`;
  const tokenRes = await fetch(tokenUrl, {
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
    return NextResponse.redirect(errorRedirect);
  }

  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
  };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return NextResponse.redirect(errorRedirect);
  }

  const userRes = await fetch(userUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    return NextResponse.redirect(errorRedirect);
  }

  const discordUser = (await userRes.json().catch(() => ({}))) as {
    id?: string;
    username?: string;
    global_name?: string | null;
  };
  if (!discordUser.id) {
    return NextResponse.redirect(errorRedirect);
  }

  const username = discordUser.global_name || discordUser.username || null;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { error } = await adminClient
    .from("profiles")
    .update({
      discord_id: discordUser.id,
      discord_username: username,
      discord: username,
    })
    .eq("id", payload.sub);
  if (error) {
    return NextResponse.redirect(errorRedirect);
  }

  const nextPath = payload.next && payload.next.startsWith("/") ? payload.next : "/me/profile/edit";
  return NextResponse.redirect(buildRedirect(baseUrl, nextPath, "connected"));
}

function verifyState(state: string, secret: string): ConnectPayload | null {
  const [payloadEncoded, signature] = state.split(".");
  if (!payloadEncoded || !signature) return null;
  const expected = sign(payloadEncoded, secret);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const json = Buffer.from(payloadEncoded, "base64url").toString("utf8");
    return JSON.parse(json) as ConnectPayload;
  } catch {
    return null;
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function buildRedirect(baseUrl: string, path: string, status: string) {
  const url = new URL(path, baseUrl);
  url.searchParams.set("discord", status);
  return url;
}
