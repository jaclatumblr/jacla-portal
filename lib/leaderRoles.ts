"use client";

import { supabase } from "@/lib/supabaseClient";

export async function fetchLeaderRoles(userId: string): Promise<string[]> {
  const { data: leadersData, error: leadersError } = await supabase
    .from("profile_leaders")
    .select("leader")
    .eq("profile_id", userId);

  let leaders = (leadersData ?? [])
    .map((row) => (row as { leader?: string }).leader)
    .filter((role) => role && role !== "none") as string[];

  if (leadersError) {
    console.error(leadersError);
  }

  if (leadersError || leaders.length === 0) {
    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("leader")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      throw profileError;
    }

    const leader = (data as { leader?: string } | null)?.leader;
    leaders = leader && leader !== "none" ? [leader] : [];
  }

  return leaders;
}
