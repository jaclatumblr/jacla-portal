// lib/AuthGuard.tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { safeSignOut, supabase } from "@/lib/supabaseClient";
import { emailPolicyMessage, getUserEmail, isAllowedEmail, isGmailAddress } from "@/lib/authEmail";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdminUser = async (userId: string) => {
    const { data: leadersData, error: leadersError } = await supabase
      .from("profile_leaders")
      .select("leader")
      .eq("profile_id", userId);
    if (!leadersError) {
      const leaders = (leadersData ?? [])
        .map((row) => (row as { leader?: string }).leader)
        .filter((role) => role && role !== "none") as string[];
      if (leaders.includes("Administrator") || leaders.includes("Supervisor")) return true;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("leader")
      .eq("id", userId)
      .maybeSingle();
    if (!profileError) {
      const leader = (profileData as { leader?: string } | null)?.leader;
      return leader === "Administrator" || leader === "Supervisor";
    }

    return false;
  };

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (loading || !session) return;
    let cancelled = false;

    (async () => {
      const email = getUserEmail(session.user ?? null);
      if (isAllowedEmail(email)) return;
      if (isGmailAddress(email) && session.user?.id) {
        const isAdmin = await isAdminUser(session.user.id);
        if (isAdmin) return;
      }
      await safeSignOut();
      if (cancelled) return;
      router.replace(`/login?error=${encodeURIComponent(emailPolicyMessage)}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session, router]);

  useEffect(() => {
    if (loading || !session) return;
    if (pathname === "/closed") return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("is_open")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("site_settings load failed", error);
        return;
      }
      if (!data?.is_open && session.user?.id) {
        const isAdmin = await isAdminUser(session.user.id);
        if (cancelled) return;
        if (!isAdmin) {
          router.replace("/closed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, pathname, router, session]);

  useEffect(() => {
    if (loading || !session) return;
    const email = getUserEmail(session.user ?? null);
    if (!isAllowedEmail(email) && !isGmailAddress(email)) return;
    if (pathname === "/onboarding") return;
    if (pathname === "/closed") return;

    let cancelled = false;
    (async () => {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, real_name, part, leader")
        .eq("id", session.user.id)
        .maybeSingle();

      const [{ data: leadersData, error: leadersError }, privateResWithPhone] = await Promise.all([
        supabase.from("profile_leaders").select("leader").eq("profile_id", session.user.id),
        supabase
          .from("profile_private")
          .select("student_id, enrollment_year, phone_number")
          .eq("profile_id", session.user.id)
          .maybeSingle(),
      ]);

      let privateData = privateResWithPhone.data as
        | { student_id?: string | null; enrollment_year?: number | null; phone_number?: string | null }
        | null;
      let privateError = privateResWithPhone.error;
      if (privateError?.code === "42703") {
        const legacyPrivateRes = await supabase
          .from("profile_private")
          .select("student_id, enrollment_year")
          .eq("profile_id", session.user.id)
          .maybeSingle();
        privateData = legacyPrivateRes.data as
          | { student_id?: string | null; enrollment_year?: number | null; phone_number?: string | null }
          | null;
        privateError = legacyPrivateRes.error;
      }

      if (cancelled) return;
      if (profileError || leadersError || privateError) {
        console.error("Onboarding check skipped due to load error", {
          profileError,
          leadersError,
          privateError,
        });
        return;
      }
      const leaders = (leadersData ?? [])
        .map((row) => (row as { leader?: string }).leader)
        .filter((role) => role && role !== "none") as string[];
      const isAdmin =
        leaders.includes("Administrator") ||
        (!leadersError && leaders.length === 0 && profileData?.leader === "Administrator") ||
        (leadersError && profileData?.leader === "Administrator");
      const privateRow = privateData as
        | { student_id?: string | null; enrollment_year?: number | null; phone_number?: string | null }
        | null;
      const studentIdValue =
        !privateError && privateRow ? privateRow.student_id ?? "" : "";
      const enrollmentYearValue =
        !privateError && privateRow ? String(privateRow.enrollment_year ?? "") : "";
      const phoneNumberValue =
        !privateError && privateRow ? privateRow.phone_number ?? "" : "";
      const needsOnboarding =
        !!profileError ||
        !profileData ||
        !profileData.display_name ||
        profileData.display_name.trim().length === 0 ||
        !profileData.real_name ||
        profileData.real_name.trim().length === 0 ||
        (!isAdmin && studentIdValue.trim().length === 0) ||
        (!isAdmin && enrollmentYearValue.trim().length === 0) ||
        (!isAdmin && (!profileData.part || profileData.part === "none"));
      const needsPhoneInput = !isAdmin && phoneNumberValue.trim().length === 0;

      if (needsOnboarding) {
        const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
        router.replace(`/onboarding${next}`);
        return;
      }

      if (needsPhoneInput && pathname !== "/me/profile/edit") {
        router.replace("/me/profile/edit?required=phone");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Checking session...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
