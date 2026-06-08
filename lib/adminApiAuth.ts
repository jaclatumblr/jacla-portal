import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type LeaderRow = { leader?: string | null };

type AdminApiAuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse };

const isAdminLeader = (leader?: string | null) =>
  leader === "Administrator" || leader === "Supervisor";

export async function requireAdminApiAuth(request: Request): Promise<AdminApiAuthResult> {
  const url = supabaseUrl ?? "";
  const anonKey = supabaseAnonKey ?? "";
  const serviceKey = supabaseServiceKey ?? "";

  if (!url || !anonKey || !serviceKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Server configuration missing (Supabase keys)." },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let leaders: string[] = [];
  const { data: leaderRows, error: leaderError } = await adminClient
    .from("profile_leaders")
    .select("leader")
    .eq("profile_id", userData.user.id);

  if (leaderError) {
    console.error("profile_leaders auth check failed", leaderError);
  } else {
    leaders = (leaderRows ?? [])
      .map((row) => (row as LeaderRow).leader)
      .filter((leader): leader is string => Boolean(leader) && leader !== "none");
  }

  if (leaders.length === 0) {
    const { data: profileRow, error: profileError } = await adminClient
      .from("profiles")
      .select("leader")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("profiles auth fallback failed", profileError);
      return {
        authorized: false,
        response: NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 }),
      };
    }

    const fallbackLeader = (profileRow as LeaderRow | null)?.leader;
    if (fallbackLeader && fallbackLeader !== "none") {
      leaders = [fallbackLeader];
    }
  }

  if (!leaders.some(isAdminLeader)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { authorized: true, userId: userData.user.id };
}
