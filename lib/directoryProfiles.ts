import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPortalAccounts } from "@/lib/accountSchema";

/** Uses ordinary RLS reads throughout, including during a staged DB rollout. */
export async function fetchDirectoryProfiles<T extends { id: string }>(client: SupabaseClient, columns: string, ordered = false) {
  let query = client.from("profiles").select(columns);
  if (ordered) query = query.order("display_name", { ascending: true });
  const profiles = await query;
  if (profiles.error) return { data: null, error: profiles.error };
  const accounts = await client.from("portal_accounts").select("profile_id,status");
  if (accounts.error) {
    // A missing lifecycle schema must not break the pre-existing member directory.
    // Permission errors and network failures never take this compatibility path.
    if (isMissingPortalAccounts(accounts.error)) return { data: profiles.data as unknown as T[], error: null };
    return { data: null, error: accounts.error };
  }
  const activeIds = new Set((accounts.data ?? []).filter((row) => row.status === "active").map((row) => row.profile_id));
  return { data: (profiles.data as unknown as T[]).filter((profile) => activeIds.has(profile.id)), error: null };
}
