import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const categoryLabels: Record<string, string> = {
  ui: "UI/UX",
  bug: "バグ報告",
  feature: "機能追加",
  other: "その他",
};

export async function POST(request: Request) {
  const url = supabaseUrl ?? "";
  const anonKey = supabaseAnonKey ?? "";
  const serviceKey = supabaseServiceKey ?? "";
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json(
      { error: "Server configuration missing (Supabase keys)." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    category?: string;
    message?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const rawCategory = (body.category ?? "other").trim() || "other";
  const category = categoryLabels[rawCategory] ? rawCategory : "other";

  const profileId = userData.user.id;
  const { error: insertError } = await adminClient
    .from("feedbacks")
    .insert([
      {
        profile_id: profileId,
        category,
        message,
      },
    ]);

  if (insertError) {
    console.error(insertError);
    return NextResponse.json({ error: "Feedback insert failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
