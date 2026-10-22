import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireActivePortalAccount } from "@/lib/accountAccess";

async function handle(request: Request, recordActivity: boolean) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const accessError = await requireActivePortalAccount(data.user.id, token);
    if (accessError) return accessError;
    if (recordActivity) {
      const { error: activityError } = await client.rpc("portal_touch_activity");
      if (activityError) return NextResponse.json({ error: "Activity update failed" }, { status: activityError.code === "PT403" ? 403 : 503 });
    }
    return NextResponse.json({ status: "active" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Account check unavailable" }, { status: 503 });
  }
}
export const GET = (request: Request) => handle(request, false);
export const POST = (request: Request) => handle(request, true);
