"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  RefreshCw,
  Shield,
  SwitchCamera,
  UserCog,
} from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProfileRow = {
  id: string;
  display_name: string | null;
  real_name: string | null;
  email: string | null;
  leader: string;
  crew: string;
  part: string | null;
  muted: boolean;
  avatar_url?: string | null;
};

type ProfilePartRow = {
  part: string;
  is_primary: boolean;
};

const leaderOptions = ["Administrator", "Supervisor", "PA Leader", "Lighting Leader", "Part Leader"];
const leaderPriority = ["Administrator", "Supervisor", "PA Leader", "Lighting Leader", "Part Leader"];

const positionOptions = [
  { value: "Official", label: "Official" },
  { value: "President", label: "部長" },
  { value: "Vice President", label: "副部長" },
  { value: "Treasurer", label: "会計" },
  { value: "PA Chief", label: "PA長" },
  { value: "Lighting Chief", label: "照明長" },
  { value: "Web Secretary", label: "Web幹事" },
];
const uniquePositions = [
  "Official",
  "President",
  "Vice President",
  "Treasurer",
  "Web Secretary",
] as const;
type UniquePosition = (typeof uniquePositions)[number];

const crewOptions = ["User", "PA", "Lighting"];

const partOptions = [
  "Gt.",
  "A.Gt.",
  "C.Gt.",
  "Ba.",
  "Dr.",
  "Key.",
  "Syn.",
  "Acc.",
  "W.Syn.",
  "S.Sax.",
  "A.Sax.",
  "T.Sax.",
  "B.Sax.",
  "Tp.",
  "Tb.",
  "Tu.",
  "Hr.",
  "Eup.",
  "Cl.",
  "B.Cl.",
  "Ob.",
  "Fl.",
  "Vn.",
  "Va.",
  "Vc.",
  "Per.",
  "etc",
];

export default function AdminRolesPage() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAdministrator: viewerIsAdministrator } = useIsAdministrator();
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ crew: "User", muted: false });
  const [leaderRoles, setLeaderRoles] = useState<string[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [positions, setPositions] = useState<string[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionHolders, setPositionHolders] = useState<Record<UniquePosition, string | null>>({
    Official: null,
    President: null,
    "Vice President": null,
    Treasurer: null,
    "Web Secretary": null,
  });
  const [primaryPart, setPrimaryPart] = useState("");
  const [subParts, setSubParts] = useState<string[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentIdLoading, setStudentIdLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setToastVisible(true);
    const hideTimer = window.setTimeout(() => setToastVisible(false), 2200);
    const clearTimer = window.setTimeout(() => setToast(null), 2600);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [toast?.id]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const emailText = viewerIsAdministrator ? p.email ?? "" : "";
      const text = `${p.display_name ?? ""} ${p.real_name ?? ""} ${emailText}`.toLowerCase();
      return text.includes(q);
    });
  }, [profiles, search, viewerIsAdministrator]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? null,
    [profiles, selectedId]
  );
  const targetIsAdministrator = selectedProfile
    ? leaderRoles.includes("Administrator") || selectedProfile.leader === "Administrator"
    : false;
  const roleFlags = useMemo(() => {
    const roleSet = new Set(leaderRoles);
    const primaryLeader = selectedProfile?.leader ?? null;
    const hasRole = (role: string) => roleSet.has(role) || primaryLeader === role;
    return {
      isAdministrator: hasRole("Administrator"),
      isSupervisor: hasRole("Supervisor"),
      isPaLeader: hasRole("PA Leader"),
      isLightingLeader: hasRole("Lighting Leader"),
    };
  }, [leaderRoles, selectedProfile?.leader]);
  const allowedPositions = useMemo(() => {
    const allowed = new Set<string>();
    if (roleFlags.isAdministrator || roleFlags.isSupervisor) {
      uniquePositions.forEach((position) => {
        const holder = positionHolders[position];
        if (!holder || holder === selectedId) {
          allowed.add(position);
        }
      });
    }
    if (roleFlags.isPaLeader) {
      allowed.add("PA Chief");
    }
    if (roleFlags.isLightingLeader) {
      allowed.add("Lighting Chief");
    }
    return allowed;
  }, [roleFlags, positionHolders, selectedId]);
  const autoPositions = useMemo(() => {
    const required = new Set<string>();
    if (roleFlags.isPaLeader) {
      required.add("PA Chief");
    }
    if (roleFlags.isLightingLeader) {
      required.add("Lighting Chief");
    }
    return required;
  }, [roleFlags]);

  useEffect(() => {
    if (!selectedProfile) {
      setForm({ crew: "User", muted: false });
      setLeaderRoles([]);
      setLeadersLoading(false);
      setPositions([]);
      setPositionsLoading(false);
      setPrimaryPart("");
      setSubParts([]);
      setStudentId(null);
      setStudentIdLoading(false);
      return;
    }
    setForm({
      crew: selectedProfile.crew,
      muted: Boolean(selectedProfile.muted),
    });
    setPrimaryPart(selectedProfile.part && selectedProfile.part !== "none" ? selectedProfile.part : "");
  }, [selectedProfile]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setStudentIdLoading(true);
      const { data, error } = await supabase
        .from("profile_private")
        .select("student_id")
        .eq("profile_id", selectedId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error(error);
        setStudentId(null);
      } else {
        setStudentId((data as { student_id?: string } | null)?.student_id ?? null);
      }
      setStudentIdLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setPartsLoading(true);
      const { data, error } = await supabase
        .from("profile_parts")
        .select("part, is_primary")
        .eq("profile_id", selectedId);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setSubParts([]);
      } else {
        const parts = (data ?? []) as ProfilePartRow[];
        const primary = parts.find((row) => row.is_primary)?.part;
        const subs = parts.filter((row) => !row.is_primary).map((row) => row.part);
        if (primary) {
          setPrimaryPart(primary);
          setSubParts(subs.filter((value) => value !== primary));
        } else {
          setSubParts(subs);
        }
      }
      setPartsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setLeadersLoading(true);
      const { data, error } = await supabase
        .from("profile_leaders")
        .select("leader")
        .eq("profile_id", selectedId);
      if (cancelled) return;
      if (error) {
        console.error(error);
        const fallback =
          selectedProfile?.leader && selectedProfile.leader !== "none"
            ? [selectedProfile.leader]
            : [];
        setLeaderRoles(fallback);
      } else {
        const roles = (data ?? [])
          .map((row) => (row as { leader?: string }).leader)
          .filter((role) => role && role !== "none") as string[];
        if (roles.length === 0 && selectedProfile?.leader && selectedProfile.leader !== "none") {
          setLeaderRoles([selectedProfile.leader]);
        } else {
          setLeaderRoles(roles);
        }
      }
      setLeadersLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedProfile?.leader]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setPositionsLoading(true);
      const { data, error } = await supabase
        .from("profile_positions")
        .select("position")
        .eq("profile_id", selectedId);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setPositions([]);
      } else {
        const values = (data ?? [])
          .map((row) => (row as { position?: string }).position)
          .filter((value) => value) as string[];
        setPositions(values);
      }
      setPositionsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profile_positions")
        .select("profile_id, position, created_at")
        .in("position", [...uniquePositions])
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setPositionHolders({
          Official: null,
          President: null,
          "Vice President": null,
          Treasurer: null,
          "Web Secretary": null,
        });
      } else {
        const next: Record<UniquePosition, string | null> = {
          Official: null,
          President: null,
          "Vice President": null,
          Treasurer: null,
          "Web Secretary": null,
        };
        (data ?? []).forEach((row) => {
          const entry = row as { profile_id?: string; position?: string };
          const position = entry.position as UniquePosition | undefined;
          if (!position || !uniquePositions.includes(position)) return;
          if (!next[position]) {
            next[position] = entry.profile_id ?? null;
          }
        });
        setPositionHolders(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  useEffect(() => {
    if (!selectedId || leadersLoading || positionsLoading) return;
    setPositions((prev) => {
      const next = new Set(prev);
      ["PA Chief", "Lighting Chief"].forEach((value) => {
        if (!autoPositions.has(value)) {
          next.delete(value);
        }
      });
      autoPositions.forEach((value) => next.add(value));
      return Array.from(next).filter((value) => allowedPositions.has(value));
    });
  }, [allowedPositions, autoPositions, leadersLoading, positionsLoading, selectedId]);

  useEffect(() => {
    if (!primaryPart) {
      setSubParts([]);
      return;
    }
    setSubParts((prev) => prev.filter((value) => value !== primaryPart));
  }, [primaryPart]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, real_name, email, leader, crew, part, muted, avatar_url")
        .order("display_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setError("プロフィールの取得に失敗しました。");
        setProfiles([]);
      } else {
        setProfiles((data ?? []) as ProfileRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  const toggleSubPart = (value: string) => {
    setSubParts((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleLeaderRole = (value: string) => {
    if (value === "Administrator") return;
    setLeaderRoles((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const togglePosition = (value: string) => {
    setPositions((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!selectedId || !selectedProfile) return;
    if (leadersLoading) {
      setError("ロール情報の読み込み中です。");
      return;
    }
    if (positionsLoading) {
      setError("役職情報の読み込み中です。");
      return;
    }
    if (!targetIsAdministrator && !primaryPart) {
      setError("メイン楽器を選択してください。");
      return;
    }
    if (targetIsAdministrator && form.muted) {
      setError("Administrator には muted を設定できません。");
      return;
    }
    if (!selectedProfile.muted && form.muted) {
      const confirmedOnce = window.confirm("本当によろしいですか？");
      if (!confirmedOnce) return;
      const confirmedTwice = window.confirm("このユーザーを muted にします。よろしいですか？");
      if (!confirmedTwice) return;
    }

    setSaving(true);
    setError(null);
    setToast(null);

    const partValue = primaryPart || "none";
    const profileRes = await supabase
      .from("profiles")
      .update({
        crew: form.crew,
        part: partValue,
        muted: form.muted,
      })
      .eq("id", selectedId)
      .select()
      .maybeSingle();

    if (profileRes.error) {
      console.error(profileRes.error);
      setError("保存に失敗しました。");
      setSaving(false);
      return;
    }

    const desiredRoles = Array.from(
      new Set(leaderRoles.filter((role) => role && role !== "none"))
    );
    const desiredSet = new Set(desiredRoles);
    const editableRoles = desiredRoles.filter((role) => role !== "Administrator");
    const primaryLeader =
      leaderPriority.find((role) => desiredSet.has(role)) ?? "none";

    const { data: currentRoles, error: rolesError } = await supabase
      .from("profile_leaders")
      .select("id, leader")
      .eq("profile_id", selectedId);
    if (rolesError) {
      console.error(rolesError);
      setError("ロールの保存に失敗しました。");
      setSaving(false);
      return;
    }

    if (editableRoles.length > 0) {
      const upsertRes = await supabase
        .from("profile_leaders")
        .upsert(
          editableRoles.map((role) => ({
            profile_id: selectedId,
            leader: role,
          })),
          { onConflict: "profile_id,leader" }
        );
      if (upsertRes.error) {
        console.error(upsertRes.error);
        setError("ロールの保存に失敗しました。");
        setSaving(false);
        return;
      }
    }

    const deleteIds =
      (currentRoles ?? [])
        .filter((row) => row.leader !== "Administrator" && !desiredSet.has(row.leader))
        .map((row) => row.id) ?? [];
    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("profile_leaders")
        .delete()
        .in("id", deleteIds);
      if (deleteError) {
        console.error(deleteError);
        setError("ロールの保存に失敗しました。");
        setSaving(false);
        return;
      }
    }

    const desiredPositions = Array.from(
      new Set(
        [...positions, ...Array.from(autoPositions)].filter(
          (position) => position && position !== "none" && allowedPositions.has(position)
        )
      )
    );
    const positionsSet = new Set(desiredPositions);
    const { data: currentPositions, error: positionsError } = await supabase
      .from("profile_positions")
      .select("id, position")
      .eq("profile_id", selectedId);
    if (positionsError) {
      console.error(positionsError);
      setError("役職の保存に失敗しました。");
      setSaving(false);
      return;
    }

    if (desiredPositions.length > 0) {
      const upsertRes = await supabase
        .from("profile_positions")
        .upsert(
          desiredPositions.map((position) => ({
            profile_id: selectedId,
            position,
          })),
          { onConflict: "profile_id,position" }
        );
      if (upsertRes.error) {
        console.error(upsertRes.error);
        setError("役職の保存に失敗しました。");
        setSaving(false);
        return;
      }
    }

    const positionDeleteIds =
      (currentPositions ?? [])
        .filter((row) => !positionsSet.has(row.position))
        .map((row) => row.id) ?? [];
    if (positionDeleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("profile_positions")
        .delete()
        .in("id", positionDeleteIds);
      if (deleteError) {
        console.error(deleteError);
        setError("役職の保存に失敗しました。");
        setSaving(false);
        return;
      }
    }
    setPositionHolders((prev) => {
      const next = { ...prev };
      uniquePositions.forEach((position) => {
        if (desiredPositions.includes(position)) {
          next[position] = selectedId;
        } else if (next[position] === selectedId) {
          next[position] = null;
        }
      });
      return next;
    });

    if (!primaryPart) {
      const { error: deleteError } = await supabase
        .from("profile_parts")
        .delete()
        .eq("profile_id", selectedId);
      if (deleteError) {
        console.error(deleteError);
        setError("楽器設定の保存に失敗しました。");
        setSaving(false);
        return;
      }
    } else {
      const desiredParts = [primaryPart, ...subParts.filter((value) => value !== primaryPart)];
      const desiredSet = new Set(desiredParts);

      const resetRes = await supabase
        .from("profile_parts")
        .update({ is_primary: false })
        .eq("profile_id", selectedId);
      if (resetRes.error) {
        console.error(resetRes.error);
        setError("楽器設定の保存に失敗しました。");
        setSaving(false);
        return;
      }

      const upsertRows = desiredParts.map((value) => ({
        profile_id: selectedId,
        part: value,
        is_primary: value === primaryPart,
      }));
      const upsertRes = await supabase
        .from("profile_parts")
        .upsert(upsertRows, { onConflict: "profile_id,part" });
      if (upsertRes.error) {
        console.error(upsertRes.error);
        setError("楽器設定の保存に失敗しました。");
        setSaving(false);
        return;
      }

      const { data: currentRows, error: currentError } = await supabase
        .from("profile_parts")
        .select("id, part")
        .eq("profile_id", selectedId);
      if (currentError) {
        console.error(currentError);
        setError("楽器設定の保存に失敗しました。");
        setSaving(false);
        return;
      }

      const deleteIds =
        (currentRows ?? [])
          .filter((row) => !desiredSet.has(row.part))
          .map((row) => row.id) ?? [];
      if (deleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("profile_parts")
          .delete()
          .in("id", deleteIds);
        if (deleteError) {
          console.error(deleteError);
          setError("楽器設定の保存に失敗しました。");
          setSaving(false);
          return;
        }
      }
    }

    if (profileRes.data) {
      const updated = profileRes.data as ProfileRow;
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === selectedId ? { ...updated, leader: primaryLeader } : p
        )
      );
    }
    setToast({ id: Date.now(), message: "保存しました。" });
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!selectedId || !selectedProfile || !session?.access_token) return;
    const isSelf = selectedId === userId;
    const displayName = selectedProfile.display_name ?? "このユーザー";
    const confirmed = window.confirm(
      isSelf
        ? "アカウントを削除します。よろしいですか？"
        : `${displayName} のアカウントを削除します。よろしいですか？`
    );
    if (!confirmed) return;
    if (!isSelf) {
      const confirmedTwice = window.confirm("この操作は取り消せません。本当に削除しますか？");
      if (!confirmedTwice) return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId: selectedId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        const message = data?.details ? `${data.error ?? "削除エラー"}: ${data.details}` : data?.error;
        setError(message ?? "アカウントの削除に失敗しました。");
        setDeleting(false);
        return;
      }

      if (isSelf) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setProfiles((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(null);
      setToast({ id: Date.now(), message: "アカウントを削除しました。" });
      setDeleting(false);
    } catch (err) {
      console.error(err);
      setError("アカウントの削除に失敗しました。");
      setDeleting(false);
    }
  };

  if (adminLoading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      </AuthGuard>
    );
  }

  if (!isAdmin) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-3">
            <p className="text-xl font-semibold text-foreground">管理者のみアクセスできます</p>
            <p className="text-sm text-muted-foreground">管理者に問い合わせてください。</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/60 hover:text-primary transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        {toast && (
          <div
            className={cn(
              "fixed right-6 top-6 z-[90] flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-500 shadow-lg backdrop-blur transition-all",
              toastVisible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">{toast.message}</span>
          </div>
        )}

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href="/admin" className="hover:text-primary transition-colors">
                  管理トップに戻る
                </Link>
              </div>
              <div className="max-w-5xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">ADMIN</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">ユーザー管理</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  Administrator / Supervisor がユーザーのロールと楽器情報を更新できます。
                </p>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-8 md:space-y-10">
              {error && (
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg border",
                    "text-destructive bg-destructive/10 border-destructive/30"
                  )}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="grid lg:grid-cols-[1.2fr,1fr] gap-6">
                <Card className="bg-card/60 border-border">
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-lg">メンバー一覧</CardTitle>
                      <CardDescription>検索して編集対象を選択します。</CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <UserCog className="w-4 h-4" />
                      {profiles.length} users
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="名前やメールで検索"
                    />
                    <div className="rounded-lg border border-border divide-y divide-border bg-card/50 max-h-[520px] overflow-y-auto no-scrollbar">
                      {loading ? (
                        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          読み込み中...
                        </div>
                      ) : filteredProfiles.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">該当するメンバーがいません。</div>
                      ) : (
                        filteredProfiles.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedId(p.id)}
                            className={cn(
                              "w-full text-left px-4 py-3 flex items-center justify-between transition-colors",
        selectedId === p.id
                                ? "bg-primary/10 border-l-2 border-primary"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-9 w-9 border border-border">
                                {p.avatar_url && (
                                  <AvatarImage src={p.avatar_url} alt={p.display_name ?? "member"} />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {(p.display_name ?? "?").trim().charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {p.display_name ?? "名前未登録"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  本名: {p.real_name ?? "未設定"}
                                </p>
                                {viewerIsAdministrator && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {p.email ?? "メール未登録"}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <BadgeCheck className="w-4 h-4 text-primary" />
                              <span
                                className={
                                  p.leader === "Administrator" ? "text-[#aee6ff]" : undefined
                                }
                              >
                                {p.leader}
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">権限と楽器を編集</CardTitle>
                        <CardDescription>Administrator / Supervisor だけが更新できます。</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedProfile ? (
                      <p className="text-sm text-muted-foreground">メンバーを選択してください。</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border">
                            {selectedProfile.avatar_url && (
                              <AvatarImage
                                src={selectedProfile.avatar_url}
                                alt={selectedProfile.display_name ?? "member"}
                              />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                              {(selectedProfile.display_name ?? "?").trim().charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {selectedProfile.display_name ?? "名前未登録"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              本名: {selectedProfile.real_name ?? "未設定"}
                            </p>
                            {viewerIsAdministrator && (
                              <p className="text-xs text-muted-foreground truncate">
                                {selectedProfile.email ?? "メール未登録"}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground truncate">
                              学籍番号:{" "}
                              {studentIdLoading ? "読み込み中..." : studentId ?? "未登録"}
                            </p>
                            {selectedProfile.id === userId && (
                              <p className="text-xs text-primary">※自分自身の権限を編集中</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">leader ロール</span>
                            {leadersLoading && (
                              <span className="text-xs text-muted-foreground">読み込み中...</span>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {leaderOptions.map((value) => {
                              const isAdminRole = value === "Administrator";
                              const checked = leaderRoles.includes(value);
                              return (
                                <label key={value} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary"
                                    checked={checked}
                                    onChange={() => toggleLeaderRole(value)}
                                    disabled={leadersLoading || isAdminRole}
                                  />
                                  <span className={isAdminRole ? "text-muted-foreground" : undefined}>
                                    {value}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Administrator ロールはここから変更できません。
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">役職</span>
                            {positionsLoading && (
                              <span className="text-xs text-muted-foreground">読み込み中...</span>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {positionOptions.map((option) => {
                              const isAuto = autoPositions.has(option.value);
                              const isAllowed = allowedPositions.has(option.value);
                              const checked = isAuto || positions.includes(option.value);
                              const disabled = positionsLoading || isAuto || !isAllowed;
                              return (
                                <label key={option.value} className="flex items-center gap-2 text-sm">
                                  <input
                                    type={isAuto ? "radio" : "checkbox"}
                                    className="h-4 w-4 accent-primary"
                                    checked={checked}
                                    onChange={() => togglePosition(option.value)}
                                    disabled={disabled}
                                  />
                                  <span
                                    className={
                                      disabled ? "text-muted-foreground" : undefined
                                    }
                                  >
                                    {option.label}
                                    {isAuto ? "（自動）" : ""}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            権限が無い役職や、他ユーザーが設定済みの役職は選択できません。
                          </p>
                        </div>

                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">crew ロール</span>
                          <select
                            value={form.crew}
                            onChange={(e) => setForm((prev) => ({ ...prev, crew: e.target.value }))}
                            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                          >
                            {crewOptions.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">メイン楽器</span>
                          <select
                            value={primaryPart}
                            onChange={(e) => setPrimaryPart(e.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                          >
                            <option value="">選択してください</option>
                            {partOptions.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground">サブ楽器</span>
                            {!primaryPart && (
                              <span className="text-xs text-muted-foreground">メイン選択後に有効</span>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {partOptions
                              .filter((value) => value !== primaryPart)
                              .map((value) => (
                                <label key={value} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-primary"
                                    checked={subParts.includes(value)}
                                    onChange={() => toggleSubPart(value)}
                                    disabled={!primaryPart || partsLoading}
                                  />
                                  <span>{value}</span>
                                </label>
                              ))}
                          </div>
                        </div>

                        <label className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={form.muted}
                            onChange={(e) => setForm((prev) => ({ ...prev, muted: e.target.checked }))}
                            disabled={targetIsAdministrator}
                          />
                          <span className={targetIsAdministrator ? "text-muted-foreground" : "text-foreground"}>
                            muted（本人から更新不可）
                          </span>
                        </label>
                        {targetIsAdministrator && (
                          <p className="text-xs text-muted-foreground">
                            Administrator には muted を設定できません。
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            onClick={handleSave}
                            disabled={saving || leadersLoading || positionsLoading}
                            className="gap-2"
                          >
                            {saving ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <SwitchCamera className="w-4 h-4" />
                            )}
                            保存する
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={deleting || saving || leadersLoading || positionsLoading}
                            className="gap-2"
                          >
                            {deleting ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                            アカウント削除
                          </Button>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            更新は即時反映されます。
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
