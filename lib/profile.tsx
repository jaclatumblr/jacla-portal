// lib/profile.tsx
import { supabase } from "./supabaseClient";

export async function ensureProfile() {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (profile) {
    return profile;
  }

  // なければ新規作成（表示名だけAuthから引っ張る例）
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata.full_name ?? user.email,
      role: "member",
    })
    .select()
    .single();

  if (insertError) {
    console.error(insertError);
    return null;
  }

  return inserted;
}
