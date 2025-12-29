import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminLeaders = new Set(["Administrator", "Supervisor"]);

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

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actorId = userData.user.id;
  const body = (await request.json().catch(() => ({}))) as {
    targetUserId?: string;
  };
  const targetUserId = body.targetUserId || actorId;

  if (targetUserId !== actorId) {
    const { data: leadersData, error: leadersError } = await adminClient
      .from("profile_leaders")
      .select("leader")
      .eq("profile_id", actorId);

    let isPrivileged = false;
    if (!leadersError && leadersData && leadersData.length > 0) {
      isPrivileged = leadersData.some((row) =>
        adminLeaders.has((row as { leader?: string }).leader ?? "")
      );
    }

    if (!isPrivileged) {
      const { data, error } = await adminClient
        .from("profiles")
        .select("leader")
        .eq("id", actorId)
        .maybeSingle();
      if (error) {
        console.error(error);
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const leader = (data as { leader?: string } | null)?.leader ?? "none";
      isPrivileged = adminLeaders.has(leader);
    }

    if (!isPrivileged) {
      return NextResponse.json(
        {
          error: "Forbidden",
          details: "Only Administrator/Supervisor can delete other users.",
        },
        { status: 403 }
      );
    }
  }

  await Promise.all([
    adminClient
      .from("equipment_item_logs")
      .update({ changed_by: null })
      .eq("changed_by", targetUserId)
      .then(({ error }) => {
        if (error) console.error(error);
      }),
    adminClient
      .from("equipment_instrument_logs")
      .update({ changed_by: null })
      .eq("changed_by", targetUserId)
      .then(({ error }) => {
        if (error) console.error(error);
      }),
  ]);

  const { error: profileDeleteError } = await adminClient
    .from("profiles")
    .delete()
    .eq("id", targetUserId);

  if (profileDeleteError) {
    console.error(profileDeleteError);
    return NextResponse.json(
      { error: "Profile delete failed", details: profileDeleteError.message },
      { status: 500 }
    );
  }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (authDeleteError) {
    console.error(authDeleteError);
    return NextResponse.json(
      { error: "Auth delete failed", details: authDeleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
