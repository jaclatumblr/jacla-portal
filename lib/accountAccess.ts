import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Call only after auth.getUser(token) has verified this token's identity. */
export async function requireActivePortalAccount(userId: string, verifiedToken: string): Promise<NextResponse | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Account access check is not configured." }, { status: 503 });
  try {
    const claims = JSON.parse(Buffer.from(verifiedToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    const sessionId = claims.session_id;
    if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json({ error: "Session revoked. Please sign in again." }, { status: 403 });
    }
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("portal_user_has_access", { p_user_id: userId, p_session_id: sessionId });
    if (error) return NextResponse.json({ error: "Account access could not be verified." }, { status: 503 });
    return data === true ? null : NextResponse.json({ error: "Account inactive or session revoked. Contact an administrator." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Account access could not be verified." }, { status: 503 });
  }
}
