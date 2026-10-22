import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApiAuth } from "@/lib/adminApiAuth";
import { isAccountStatus } from "@/lib/accountLifecycle";
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.authorized) return auth.response;
  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "all";
  const page = Number(params.get("page") ?? "0");
  const search = (params.get("q") ?? "").trim();
  if ((status !== "all" && status !== "warning" && !isAccountStatus(status)) || !Number.isInteger(page) || page < 0 || page > 10000 || search.length > 100) {
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  }
  let query = client().from("portal_accounts").select("profile_id,status,last_active_at,activity_recorded,warning_at,status_changed_at,reason,profiles!inner(display_name)")
    .order("status_changed_at", { ascending: false }).order("profile_id").range(page * 100, page * 100 + 100);
  if (status === "warning") query = query.eq("status", "active").not("warning_at", "is", null);
  else if (status !== "all") query = query.eq("status", status);
  if (search) query = query.ilike("profiles.display_name", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "アカウント一覧を取得できません。DBの設定を確認してください。" }, { status: 503 });
  const accounts = (data ?? []).slice(0, 100).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const { profiles: _profiles, ...account } = row;
    void _profiles;
    return { ...account, display_name: profile?.display_name || "名前未設定" };
  });
  return NextResponse.json({ accounts, hasMore: (data?.length ?? 0) > 100 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if (!auth.authorized) return auth.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.profileId !== "string"
    || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.profileId)
    || !isAccountStatus(body.status) || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 500
    || typeof body.expectedChangedAt !== "string" || body.expectedChangedAt.length > 64 || !Number.isFinite(Date.parse(body.expectedChangedAt))) {
    return NextResponse.json({ error: "状態と変更理由を確認してください。" }, { status: 400 });
  }
  if (body.profileId === auth.userId) return NextResponse.json({ error: "自分自身の利用状態は変更できません。" }, { status: 409 });
  const { error } = await client().rpc("portal_set_account_status", { p_user_id: body.profileId, p_status: body.status, p_actor_id: auth.userId, p_reason: body.reason.trim(), p_expected_changed_at: body.expectedChangedAt });
  if (error) return NextResponse.json({ error: "状態を変更できませんでした。別の管理者が変更した可能性があります。一覧を再読み込みして確認してください。" }, { status: 409 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
