import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isMissingPortalAccessFunction, isMissingPortalAccounts } from "@/lib/accountSchema";

type AccessCheck = { response: NextResponse | null; lifecycleInstalled: boolean };

/** Call only after auth.getUser(token) has verified this token's identity. */
export async function checkPortalAccountAccess(userId: string, verifiedToken: string): Promise<AccessCheck> {
  const result = (response: NextResponse | null, lifecycleInstalled = true): AccessCheck => ({ response, lifecycleInstalled });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return result(NextResponse.json({ error: "Account access check is not configured." }, { status: 503 }));
  try {
    const claims = JSON.parse(Buffer.from(verifiedToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    const sessionId = claims.session_id;
    if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(sessionId)) {
      return result(NextResponse.json({ error: "Session revoked. Please sign in again." }, { status: 403 }));
    }
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client.rpc("portal_user_has_access", { p_user_id: userId, p_session_id: sessionId });
    if (isMissingPortalAccessFunction(error)) {
      const account = await client.from("portal_accounts").select("status").eq("profile_id", userId).maybeSingle();
      if (!account.error && account.data && account.data.status !== "active") {
        return result(NextResponse.json({ error: "Account inactive. Contact an administrator." }, { status: 403 }));
      }
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (isMissingPortalAccounts(account.error) && anonKey) {
        // Only the fully uninstalled schema has a legacy path. Prove access using
        // the caller's JWT and existing RLS, never a service-role profile read.
        // Existing restrictive policies/pre-request checks still run in the DB.
        const scoped = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${verifiedToken}` } } });
        const profile = await scoped.from("profiles").select("id").eq("id", userId).maybeSingle();
        if (!profile.error && profile.data?.id === userId) return result(null, false);
      }
      return result(NextResponse.json({ error: "在籍管理のDB設定が未完了、または利用権限を確認できません。管理者にお問い合わせください。", code: "ACCOUNT_LIFECYCLE_SETUP_REQUIRED" }, { status: 503 }));
    }
    if (error) return result(NextResponse.json({ error: "Account access could not be verified." }, { status: 503 }));
    return result(data === true ? null : NextResponse.json({ error: "Account inactive or session revoked. Contact an administrator." }, { status: 403 }));
  } catch {
    return result(NextResponse.json({ error: "Account access could not be verified." }, { status: 503 }));
  }
}

export async function requireActivePortalAccount(userId: string, verifiedToken: string): Promise<NextResponse | null> {
  return (await checkPortalAccountAccess(userId, verifiedToken)).response;
}
