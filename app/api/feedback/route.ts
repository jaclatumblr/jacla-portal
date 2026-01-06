import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const feedbackGasUrl =
  process.env.FEEDBACK_GAS_URL ??
  "https://script.google.com/macros/s/AKfycbyMR7b2sczmDJjGc3sAg9mXk8vG-xThDaSC2nqwJH-cGyCwbl7bu-pwbCQ0u27hHvONBQ/exec";

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
  const email = userData.user.email ?? null;
  const [profileRes, privateRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("display_name, real_name")
      .eq("id", profileId)
      .maybeSingle(),
    adminClient
      .from("profile_private")
      .select("student_id")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);
  const displayName = profileRes.data?.display_name ?? null;
  const realName = profileRes.data?.real_name ?? null;
  const studentId = privateRes.data?.student_id ?? null;

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

  let mailOk = true;
  let mailError: string | null = null;
  if (feedbackGasUrl) {
    const categoryLabel = categoryLabels[category] ?? category;
    const mailName = realName || displayName || "未登録";
    const mailEmail = email ?? "未登録";
    const mailMessage = [
      `カテゴリ: ${categoryLabel}`,
      `表示名: ${displayName ?? "未登録"}`,
      `本名: ${realName ?? "未登録"}`,
      `学籍番号: ${studentId ?? "未登録"}`,
      `メール: ${mailEmail}`,
      "",
      message,
    ].join("\n");

    try {
      const gasRes = await fetch(feedbackGasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: mailName,
          email: mailEmail,
          message: mailMessage,
          category,
          category_label: categoryLabel,
          display_name: displayName,
          real_name: realName,
          student_id: studentId,
        }),
      });

      if (!gasRes.ok) {
        mailOk = false;
        mailError = await gasRes.text().catch(() => "GAS request failed.");
        console.error("GAS mail send failed:", mailError);
      }
    } catch (err) {
      mailOk = false;
      mailError = err instanceof Error ? err.message : "GAS request failed.";
      console.error("GAS mail send failed:", mailError);
    }
  }

  return NextResponse.json({ ok: true, mailOk, mailError });
}
