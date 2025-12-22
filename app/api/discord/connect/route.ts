import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "crypto";
import { getBaseUrl } from "@/lib/baseUrl";

type ConnectPayload = {
  sub: string;
  next: string;
  iat: number;
  nonce: string;
};

const discordAuthorizeUrl = "https://discord.com/oauth2/authorize";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Server configuration missing." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { next?: string };
  const next = typeof body.next === "string" && body.next ? body.next : "/me/profile/edit";
  const redirectUri = `${getBaseUrl()}/auth/discord/callback`;

  const payload: ConnectPayload = {
    sub: userData.user.id,
    next,
    iat: Date.now(),
    nonce: randomBytes(8).toString("hex"),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded, clientSecret);
  const state = `${encoded}.${signature}`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify",
    state,
    prompt: "consent",
  });

  return NextResponse.json({ url: `${discordAuthorizeUrl}?${params.toString()}` });
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}
