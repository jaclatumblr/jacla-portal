"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  RefreshCw,
  Shield,
  ShieldCheck,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  leader: string;
  crew: string;
  part: string | null;
  muted: boolean;
};

type ProfilePartRow = {
  part: string;
  is_primary: boolean;
};

const leaderOptions = ["Administrator", "Supervisor", "PA Leader", "Lighting Leader", "Part Leader"];
const leaderPriority = ["Administrator", "Supervisor", "PA Leader", "Lighting Leader", "Part Leader"];

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

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ crew: "User", muted: false });
  const [leaderRoles, setLeaderRoles] = useState<string[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [primaryPart, setPrimaryPart] = useState("");
  const [subParts, setSubParts] = useState<string[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const emailText = viewerIsAdministrator ? p.email ?? "" : "";
      const text = `${p.display_name ?? ""} ${emailText}`.toLowerCase();
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

  useEffect(() => {
    if (!selectedProfile) {
      setForm({ crew: "User", muted: false });
      setLeaderRoles([]);
      setLeadersLoading(false);
      setPrimaryPart("");
      setSubParts([]);
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
        .select("id, display_name, email, leader, crew, part, muted")
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

  const handleSave = async () => {
    if (!selectedId || !selectedProfile) return;
    if (leadersLoading) {
      setError("ロール情報の読み込み中です。");
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
    setMessage(null);

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
    setMessage("保存しました。");
    setSaving(false);
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
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">ロール管理</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  Administrator / Supervisor がメンバーのロールと楽器情報を更新できます。
                </p>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-8 md:space-y-10">
              {(error || message) && (
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 rounded-lg border",
                    error
                      ? "text-destructive bg-destructive/10 border-destructive/30"
                      : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                  )}
                >
                  {error ? <AlertCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span className="text-sm">{error ?? message}</span>
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
                            <div className="space-y-1">
                              <p className="font-medium text-sm text-foreground">
                                {p.display_name ?? "名前未登録"}
                              </p>
                              {viewerIsAdministrator && (
                                <p className="text-xs text-muted-foreground">{p.email ?? "メール未登録"}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <BadgeCheck className="w-4 h-4 text-primary" />
                              <span>{p.leader}</span>
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
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {selectedProfile.display_name ?? "名前未登録"}
                          </p>
                          {viewerIsAdministrator && (
                            <p className="text-xs text-muted-foreground">
                              {selectedProfile.email ?? "メール未登録"}
                            </p>
                          )}
                          {selectedProfile.id === userId && (
                            <p className="text-xs text-primary">※自分自身の権限を編集中</p>
                          )}
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
                          <Button onClick={handleSave} disabled={saving || leadersLoading} className="gap-2">
                            {saving ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <SwitchCamera className="w-4 h-4" />
                            )}
                            保存する
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
