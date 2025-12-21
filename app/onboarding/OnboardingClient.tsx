// app/onboarding/OnboardingClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, PencilLine } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

type ProfileRow = {
  display_name: string | null;
  real_name: string | null;
  crew: string | null;
  part: string | null;
  leader: string | null;
  discord_username: string | null;
};

type ProfilePartRow = {
  part: string;
  is_primary: boolean;
};

type ProfilePrivateRow = {
  student_id: string | null;
};

export default function OnboardingClient() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [crew, setCrew] = useState("User");
  const [part, setPart] = useState("");
  const [subParts, setSubParts] = useState<string[]>([]);
  const [isAdminLeader, setIsAdminLeader] = useState(false);
  const [canEditCrew, setCanEditCrew] = useState(false);
  const [crewOptionsForUser, setCrewOptionsForUser] = useState<string[]>(crewOptions);

  useEffect(() => {
    if (!part) {
      setSubParts([]);
      return;
    }
    setSubParts((prev) => prev.filter((value) => value !== part));
  }, [part]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, real_name, crew, part, leader, discord_username")
        .eq("id", session.user.id)
        .maybeSingle();

      if (cancelled) return;

      let profile = data as ProfileRow | null;
      if (error || !profile) {
        const avatarCandidate =
          session.user.user_metadata?.avatar_url ||
          session.user.user_metadata?.picture ||
          null;
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: session.user.id,
            email: session.user.email,
            display_name: session.user.user_metadata.full_name ?? session.user.email ?? "",
            avatar_url: avatarCandidate,
          })
          .select("display_name, real_name, crew, part, leader, discord_username")
          .maybeSingle();

        if (insertError) {
          console.error(insertError);
          setError("プロフィールの取得に失敗しました。時間をおいて再度お試しください。");
          setLoading(false);
          return;
        }
        profile = inserted as ProfileRow;
      }

      const [partsRes, leadersRes, privateRes] = await Promise.all([
        supabase
          .from("profile_parts")
          .select("part, is_primary")
          .eq("profile_id", session.user.id),
        supabase
          .from("profile_leaders")
          .select("leader")
          .eq("profile_id", session.user.id),
        supabase
          .from("profile_private")
          .select("student_id")
          .eq("profile_id", session.user.id)
          .maybeSingle(),
      ]);

      if (partsRes.error) {
        console.error(partsRes.error);
      }
      if (leadersRes.error) {
        console.error(leadersRes.error);
      }
      if (privateRes.error) {
        console.error(privateRes.error);
      }

      const parts = (partsRes.data ?? []) as ProfilePartRow[];
      const primaryPart =
        parts.find((row) => row.is_primary)?.part ??
        (profile.part && profile.part !== "none" ? profile.part : "");
      const subs = parts
        .filter((row) => !row.is_primary)
        .map((row) => row.part)
        .filter((value) => value && value !== primaryPart);

      const leaderValues = (leadersRes.data ?? [])
        .map((row) => (row as { leader?: string }).leader)
        .filter((role) => role && role !== "none") as string[];

      const fallbackLeaders =
        profile.leader && profile.leader !== "none" ? [profile.leader] : [];
      const effectiveLeaders = leaderValues.length > 0 ? leaderValues : fallbackLeaders;

      const isAdmin = effectiveLeaders.includes("Administrator");
      const currentCrew = profile.crew ?? "User";
      const canEditCrewValue = true;
      const allowedCrew = crewOptions;

      setDisplayName(profile.display_name ?? "");
      setRealName(profile.real_name ?? "");
      setStudentId(
        privateRes.data ? ((privateRes.data as ProfilePrivateRow).student_id ?? "") : ""
      );
      setDiscordUsername(profile.discord_username ?? "");
      setCrew(currentCrew);
      setPart(primaryPart ?? "");
      setSubParts(subs);
      setIsAdminLeader(isAdmin);
      setCanEditCrew(canEditCrewValue);
      setCrewOptionsForUser(allowedCrew);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const toggleSubPart = (value: string) => {
    setSubParts((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!displayName.trim()) {
      setError("表示名を入力してください。");
      return;
    }
    if (!realName.trim()) {
      setError("本名を入力してください。");
      return;
    }
    if (!studentId.trim() && !isAdminLeader) {
      setError("学籍番号を入力してください。");
      return;
    }
    if (!isAdminLeader && !part) {
      setError("メイン楽器を選択してください。");
      return;
    }

    setSaving(true);
    setError(null);

    const partValue = part || "none";
    const avatarCandidate =
      session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
    const updates: {
      display_name: string;
      real_name: string;
      discord_username: string | null;
      part: string;
      crew?: string;
      avatar_url?: string | null;
    } = {
      display_name: displayName.trim(),
      real_name: realName.trim(),
      discord_username: discordUsername.trim() || null,
      part: partValue,
    };
    if (canEditCrew) {
      updates.crew = crew;
    }
    if (avatarCandidate) {
      updates.avatar_url = avatarCandidate;
    }

    const profileRes = await supabase.from("profiles").update(updates).eq("id", session.user.id);

    if (profileRes.error) {
      console.error(profileRes.error);
      setError("保存に失敗しました。時間をおいて再度お試しください。");
      setSaving(false);
      return;
    }

    const privateRes = await supabase
      .from("profile_private")
      .upsert(
        {
          profile_id: session.user.id,
          student_id: studentId.trim(),
        },
        { onConflict: "profile_id" }
      );

    if (privateRes.error) {
      console.error(privateRes.error);
      setError("学籍番号の保存に失敗しました。");
      setSaving(false);
      return;
    }

    if (!part) {
      const { error: deleteError } = await supabase
        .from("profile_parts")
        .delete()
        .eq("profile_id", session.user.id);
      if (deleteError) {
        console.error(deleteError);
        setError("サブ楽器の保存に失敗しました。");
        setSaving(false);
        return;
      }
    } else {
      const desiredParts = [part, ...subParts.filter((value) => value !== part)];
      const desiredSet = new Set(desiredParts);

      const resetRes = await supabase
        .from("profile_parts")
        .update({ is_primary: false })
        .eq("profile_id", session.user.id);
      if (resetRes.error) {
        console.error(resetRes.error);
        setError("サブ楽器の保存に失敗しました。");
        setSaving(false);
        return;
      }

      const upsertRows = desiredParts.map((value) => ({
        profile_id: session.user.id,
        part: value,
        is_primary: value === part,
      }));
      const upsertRes = await supabase
        .from("profile_parts")
        .upsert(upsertRows, { onConflict: "profile_id,part" });
      if (upsertRes.error) {
        console.error(upsertRes.error);
        setError("サブ楽器の保存に失敗しました。");
        setSaving(false);
        return;
      }

      const { data: currentRows, error: currentError } = await supabase
        .from("profile_parts")
        .select("id, part")
        .eq("profile_id", session.user.id);
      if (currentError) {
        console.error(currentError);
        setError("サブ楽器の保存に失敗しました。");
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
          setError("サブ楽器の保存に失敗しました。");
          setSaving(false);
          return;
        }
      }
    }

    setDone(true);
    setSaving(false);
    router.replace(next);
  };

  const handleDeleteAccount = async () => {
    if (!session) return;
    const confirmed = window.confirm("アカウントを削除します。よろしいですか？");
    if (!confirmed) return;
    const confirmedTwice = window.confirm("この操作は取り消せません。本当に削除しますか？");
    if (!confirmedTwice) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        const message = data?.details ? `${data.error ?? "削除エラー"}: ${data.details}` : data?.error;
        setDeleteError(message ?? "アカウントの削除に失敗しました。");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      router.replace("/login");
    } catch (err) {
      console.error(err);
      setDeleteError("アカウントの削除に失敗しました。");
      setDeleting(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">PROFILE</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">プロフィール入力</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  初回ログイン時に必須項目を入力してください。あとで部員設定から編集できます。
                </p>
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border max-w-3xl">
                <CardHeader>
                  <CardTitle className="text-xl">基本情報</CardTitle>
                  <CardDescription>
                    必須: 表示名/本名/学籍番号/メイン楽器。サブ楽器も選択できます。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      読み込み中...
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">表示名</span>
                        <Input
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="例: 山田 太郎"
                        />
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">本名</span>
                        <Input
                          required
                          value={realName}
                          onChange={(e) => setRealName(e.target.value)}
                          placeholder="例: 山田 太郎"
                        />
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">
                          学籍番号
                          {isAdminLeader && <span className="ml-2 text-xs text-muted-foreground">任意</span>}
                        </span>
                        <Input
                          required={!isAdminLeader}
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="例: 24A1234"
                        />
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">Discordユーザー名</span>
                        <Input
                          value={discordUsername}
                          onChange={(e) => setDiscordUsername(e.target.value)}
                          placeholder="例: nia_8800"
                        />
                      </label>

                      <div className="grid md:grid-cols-2 gap-4">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">クルー</span>
                          <select
                            value={crew}
                            onChange={(e) => setCrew(e.target.value)}
                            disabled={!canEditCrew}
                            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                          >
                            {crewOptionsForUser.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                          {!canEditCrew && (
                            <p className="text-xs text-muted-foreground mt-1">
                              クルーは管理者が設定します。
                            </p>
                          )}
                        </label>

                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">
                            メイン楽器
                            {isAdminLeader && <span className="ml-2 text-xs text-muted-foreground">任意</span>}
                          </span>
                          <select
                            value={part}
                            onChange={(e) => setPart(e.target.value)}
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
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-foreground">サブ楽器 (複数選択可)</span>
                          {!part && (
                            <span className="text-xs text-muted-foreground">メイン楽器を選択すると有効</span>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {partOptions
                            .filter((value) => value !== part)
                            .map((value) => (
                              <label key={value} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-primary"
                                  checked={subParts.includes(value)}
                                  onChange={() => toggleSubPart(value)}
                                  disabled={!part}
                                />
                                <span>{value}</span>
                              </label>
                            ))}
                        </div>
                      </div>

                      {error && <p className="text-sm text-destructive">{error}</p>}
                      {done && !error && (
                        <p className="text-sm text-emerald-500 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          保存しました。ホームに移動します。
                        </p>
                      )}

                      <Button type="submit" disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                        保存して進む
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/60 border-destructive/40 max-w-3xl mt-8">
                <CardHeader>
                  <CardTitle className="text-xl text-destructive">アカウント削除</CardTitle>
                  <CardDescription>
                    この操作は取り消せません。削除するとログインできなくなります。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deleteError && (
                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      {deleteError}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="gap-2"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    アカウントを削除
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
