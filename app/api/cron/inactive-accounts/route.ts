import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || Buffer.byteLength(header) !== Buffer.byteLength(`Bearer ${secret}`)
    || !timingSafeEqual(Buffer.from(header), Buffer.from(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.rpc("portal_process_inactive_accounts");
  if (error) return NextResponse.json({ error: "Inactivity processing failed" }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
