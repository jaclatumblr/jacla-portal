// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const safeSignOut = async () => {
  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      console.error("signOut global failed", error);
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (err) {
    console.error("signOut failed", err);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (localError) {
      console.error("signOut local failed", localError);
    }
  }
};
