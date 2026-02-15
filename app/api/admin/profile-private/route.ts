import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatPhoneNumber } from "@/lib/phone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isAdminLeader = (leader?: string | null) =>
  leader === "Administrator" || leader === "Supervisor";

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
    profileId?: string;
    studentId?: string | null;
    enrollmentYear?: number | null;
    birthDate?: string | null;
    phoneNumber?: string | null;
  };

  const profileId = (body.profileId ?? "").trim();
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required." }, { status: 400 });
  }

  let leaders: string[] = [];
  const { data: leaderRows, error: leaderError } = await adminClient
    .from("profile_leaders")
    .select("leader")
    .eq("profile_id", userData.user.id);

  if (leaderError) {
    console.error(leaderError);
  } else {
    leaders = (leaderRows ?? [])
      .map((row) => (row as { leader?: string | null }).leader)
      .filter((leader): leader is string => Boolean(leader) && leader !== "none");
  }

  if (leaders.length === 0) {
    const { data: profileRow, error: profileError } = await adminClient
      .from("profiles")
      .select("leader")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) {
      console.error(profileError);
    }
    const leader = (profileRow as { leader?: string | null } | null)?.leader;
    if (leader && leader !== "none") {
      leaders = [leader];
    }
  }

  if (!leaders.some(isAdminLeader)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const studentIdValue = (body.studentId ?? "").toString().trim();
  const enrollmentYearRaw = body.enrollmentYear;
  const enrollmentYear =
    typeof enrollmentYearRaw === "number" && Number.isFinite(enrollmentYearRaw)
      ? enrollmentYearRaw
      : null;
  const birthDateValue = (body.birthDate ?? "").toString().trim();
  const phoneNumberValue = formatPhoneNumber((body.phoneNumber ?? "").toString());

  const { error: upsertError } = await adminClient
    .from("profile_private")
    .upsert(
      {
        profile_id: profileId,
        student_id: studentIdValue,
        enrollment_year: enrollmentYear,
        birth_date: birthDateValue || null,
        phone_number: phoneNumberValue || null,
      },
      { onConflict: "profile_id" }
    );

  if (upsertError) {
    console.error(upsertError);
    return NextResponse.json(
      { error: "profile_private upsert failed.", details: upsertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
