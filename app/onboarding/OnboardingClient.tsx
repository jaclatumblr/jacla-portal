// app/onboarding/OnboardingClient.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Image as ImageIcon, Loader2, PencilLine } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { safeSignOut, supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "@/lib/toast";

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

const avatarTypes = ["image/png", "image/jpeg", "image/webp"];
const maxAvatarSizeMb = 2;
const maxAvatarDimension = 512;
const avatarOutputType = "image/webp";
const avatarOutputQuality = 0.82;

const loadAvatarImage = (file: File): Promise<HTMLImageElement | ImageBitmap> => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
};

const compressAvatarImage = async (file: File): Promise<File> => {
  const image = await loadAvatarImage(file);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  const scale = Math.min(1, maxAvatarDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not supported");
  }
  ctx.drawImage(image as CanvasImageSource, 0, 0, targetWidth, targetHeight);
  if ("close" in image) {
    image.close();
  }

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, type, avatarOutputQuality);
    });

  let outputType = avatarOutputType;
  let blob = await toBlob(outputType);
  if (!blob) {
    outputType = file.type;
    blob = await toBlob(outputType);
  }
  if (!blob) {
    throw new Error("Failed to encode image");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const extension =
    outputType === "image/jpeg" ? "jpg" : outputType === "image/png" ? "png" : "webp";
  return new File([blob], `${baseName || "avatar"}.${extension}`, { type: outputType });
};

type ProfileRow = {
  display_name: string | null;
  avatar_url?: string | null;
  real_name: string | null;
  crew: string | null;
  part: string | null;
  leader: string | null;
  discord_username: string | null;
  discord_id?: string | null;
};

type ProfilePartRow = {
  part: string;
  is_primary: boolean;
};

type ProfilePrivateRow = {
  student_id: string | null;
  enrollment_year: number | null;
  birth_date: string | null;
};

type OnboardingClientMode = "onboarding" | "edit";

type OnboardingClientProps = {
  mode?: OnboardingClientMode;
  defaultNext?: string;
};

export default function OnboardingClient({
  mode = "onboarding",
  defaultNext,
}: OnboardingClientProps) {
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || defaultNext || "/";
  const isEdit = mode === "edit";
  const showSideNav = isEdit;
  const pageTitle = isEdit ? "プロフィール編集" : "プロフィール入力";
  const pageDescription = isEdit
    ? "プロフィール情報を更新できます。"
    : "初回ログイン時に必須項目を入力してください。あとで部員設定から編集できます。";
  const baseDescription = isEdit
    ? "表示名/本名/学籍番号/入学年度/メイン楽器を編集できます。サブ楽器も選択できます。"
    : "必須: 表示名/本名/学籍番号/入学年度/メイン楽器。サブ楽器も選択できます。";
  const submitLabel = isEdit ? "保存する" : "保存して進む";
  const doneMessage = isEdit
    ? "保存しました。プロフィールに戻ります。"
    : "保存しました。次の画面に移動します。";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [enrollmentYear, setEnrollmentYear] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [discordId, setDiscordId] = useState<string | null>(null);
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false);
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
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, real_name, crew, part, leader, discord_username, discord_id, avatar_url")
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
          .select("display_name, real_name, crew, part, leader, discord_username, discord_id, avatar_url")
          .maybeSingle();

        if (insertError) {
          console.error(insertError);
          toast.error("プロフィールの取得に失敗しました。時間をおいて再度お試しください。");
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
          .select("student_id, enrollment_year, birth_date")
          .eq("profile_id", session.user.id)
          .maybeSingle(),
      ]);

      if (partsRes.error) {
        console.error(partsRes.error);
        toast.error("プロフィールの取得に失敗しました。時間をおいて再度お試しください。");
      }
      if (leadersRes.error) {
        console.error(leadersRes.error);
        toast.error("ロール情報の取得に失敗しました。");
      }
      if (privateRes.error) {
        console.error(privateRes.error);
        toast.error("学籍番号の取得に失敗しました。");
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
      const avatarCandidate =
        profile.avatar_url ??
        session.user.user_metadata?.avatar_url ??
        session.user.user_metadata?.picture ??
        null;

      setAvatarUrl(avatarCandidate);
      setAvatarPreview(avatarCandidate);
      setAvatarFile(null);
      const currentCrew = profile.crew ?? "User";
      const canEditCrewValue = true;
      const allowedCrew = crewOptions;

      setDisplayName(profile.display_name ?? "");
      setRealName(profile.real_name ?? "");
      setStudentId(
        privateRes.data ? ((privateRes.data as ProfilePrivateRow).student_id ?? "") : ""
      );
      setEnrollmentYear(
        privateRes.data
          ? String((privateRes.data as ProfilePrivateRow).enrollment_year ?? "")
          : ""
      );
      setBirthDate(
        privateRes.data ? (privateRes.data as ProfilePrivateRow).birth_date ?? "" : ""
      );
      setDiscordUsername(profile.discord_username ?? "");
      setDiscordId(profile.discord_id ?? null);
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

  const handleAvatarChange = async (file: File | null) => {
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!avatarTypes.includes(file.type)) {
      toast.error("PNG/JPG/WEBP の画像を選択してください。");
      return;
    }
    try {
      const compressed = await compressAvatarImage(file);
      if (compressed.size > maxAvatarSizeMb * 1024 * 1024) {
        toast.error(`画像サイズは ${maxAvatarSizeMb}MB 以下にしてください。`);
        setAvatarFile(null);
        return;
      }
      setAvatarFile(compressed);
    } catch (compressionError) {
      console.error(compressionError);
      toast.error("画像の処理に失敗しました。");
      setAvatarFile(null);
    }
  };

  const handleDiscordConnect = async () => {
    if (!session) return;
    setDiscordConnecting(true);
    try {
      const connectNext = isEdit ? pathname : next;
      const res = await fetch("/api/discord/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ next: connectNext }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Discord連携に失敗しました。");
        setDiscordConnecting(false);
        return;
      }
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!data?.url) {
        toast.error("Discord連携に失敗しました。");
        setDiscordConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      toast.error("Discord連携に失敗しました。");
      setDiscordConnecting(false);
    }
  };

  const handleDiscordDisconnect = async () => {
    if (!session) return;
    setDiscordDisconnecting(true);
    try {
      const res = await fetch("/api/discord/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Discord連携の解除に失敗しました。");
        setDiscordDisconnecting(false);
        return;
      }
      setDiscordId(null);
      setDiscordUsername("");
      setDiscordDisconnecting(false);
    } catch (err) {
      console.error(err);
      toast.error("Discord連携の解除に失敗しました。");
      setDiscordDisconnecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!displayName.trim()) {
      toast.error("表示名を入力してください。");
      return;
    }
    if (!realName.trim()) {
      toast.error("本名を入力してください。");
      return;
    }
    if (!studentId.trim() && !isAdminLeader) {
      toast.error("学籍番号を入力してください。");
      return;
    }
    const enrollmentYearValue = enrollmentYear.trim();
    const birthDateValue = birthDate.trim();
    if (!enrollmentYearValue && !isAdminLeader) {
      toast.error("入学年度を入力してください。");
      return;
    }
    if (enrollmentYearValue && !/^\d{4}$/.test(enrollmentYearValue)) {
      toast.error("入学年度は西暦4桁で入力してください。");
      return;
    }
    if (birthDateValue && !/^\d{4}-\d{2}-\d{2}$/.test(birthDateValue)) {
      toast.error("誕生日はYYYY-MM-DD形式で入力してください。");
      return;
    }
    if (!isAdminLeader && !part) {
      toast.error("メイン楽器を選択してください。");
      return;
    }

    setSaving(true);

    const partValue = part || "none";
    const avatarCandidate =
      session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
    let nextAvatarUrl = avatarUrl ?? avatarCandidate;

    if (avatarFile) {
      setAvatarUploading(true);
      const fileExt = avatarFile.name.split(".").pop() ?? "png";
      const safeName = avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${session.user.id}/${Date.now()}-${safeName || `avatar.${fileExt}`}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        console.error(uploadError);
        toast.error("画像のアップロードに失敗しました。");
        setSaving(false);
        setAvatarUploading(false);
        return;
      }
      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      nextAvatarUrl = publicUrl.publicUrl;
      setAvatarUrl(nextAvatarUrl);
      setAvatarPreview(nextAvatarUrl);
      setAvatarFile(null);
      setAvatarUploading(false);
    }

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
    if (nextAvatarUrl) {
      updates.avatar_url = nextAvatarUrl;
    }

    const profileRes = await supabase.from("profiles").update(updates).eq("id", session.user.id);

    if (profileRes.error) {
      console.error(profileRes.error);
      toast.error("保存に失敗しました。時間をおいて再度お試しください。");
      setSaving(false);
      return;
    }

    const privateRes = await supabase
      .from("profile_private")
      .upsert(
        {
          profile_id: session.user.id,
          student_id: studentId.trim(),
          enrollment_year: enrollmentYearValue ? Number(enrollmentYearValue) : null,
          birth_date: birthDateValue ? birthDateValue : null,
        },
        { onConflict: "profile_id" }
      );

    if (privateRes.error) {
      console.error(privateRes.error);
      toast.error("学籍番号の保存に失敗しました。");
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
        toast.error("サブ楽器の保存に失敗しました。");
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
        toast.error("サブ楽器の保存に失敗しました。");
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
        toast.error("サブ楽器の保存に失敗しました。");
        setSaving(false);
        return;
      }

      const { data: currentRows, error: currentError } = await supabase
        .from("profile_parts")
        .select("id, part")
        .eq("profile_id", session.user.id);
      if (currentError) {
        console.error(currentError);
        toast.error("サブ楽器の保存に失敗しました。");
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
          toast.error("サブ楽器の保存に失敗しました。");
          setSaving(false);
          return;
        }
      }
    }

    toast.success(doneMessage);
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

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error(sessionError);
      }
      const accessToken = sessionData.session?.access_token ?? session.access_token;
      if (!accessToken) {
        toast.error("セッションが切れました。再ログインしてください。");
        setDeleting(false);
        return;
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        const message = data?.details ? `${data.error ?? "削除エラー"}: ${data.details}` : data?.error;
        toast.error(message ?? "アカウントの削除に失敗しました。");
        setDeleting(false);
        return;
      }

      await safeSignOut();
      router.replace("/login");
    } catch (err) {
      console.error(err);
      toast.error("アカウントの削除に失敗しました。");
      setDeleting(false);
    }
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        {showSideNav && <SideNav />}

        <main className={`flex-1 ${showSideNav ? "md:ml-20" : ""}`}>
          <PageHeader
            kicker="Profile"
            title={pageTitle}
            description={pageDescription}
            size="lg"
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6">
              <Card className="bg-card/60 border-border max-w-3xl">
                <CardHeader>
                  <CardTitle className="text-xl">基本情報</CardTitle>
                  <CardDescription>{baseDescription}</CardDescription>
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

                      <div className="space-y-2">
                        <span className="text-foreground text-sm">アイコン (任意)</span>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <Avatar className="h-16 w-16 border border-border">
                            {avatarPreview && (
                              <AvatarImage src={avatarPreview} alt={displayName || "avatar"} />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                              {(displayName || "?").trim().charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-2">
                            <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-md text-xs text-muted-foreground cursor-pointer hover:border-primary/60">
                              <ImageIcon className="h-4 w-4" />
                              画像を選択
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                                disabled={avatarUploading}
                                className="hidden"
                              />
                            </label>
                            <p className="text-xs text-muted-foreground">
                              PNG/JPG/WEBP・{maxAvatarSizeMb}MBまで
                            </p>
                          </div>
                        </div>
                      </div>

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
                        <span className="text-foreground">
                          入学年度
                          {isAdminLeader && <span className="ml-2 text-xs text-muted-foreground">任意</span>}
                        </span>
                        <Input
                          required={!isAdminLeader}
                          value={enrollmentYear}
                          onChange={(e) => setEnrollmentYear(e.target.value)}
                          placeholder="例: 2024"
                          inputMode="numeric"
                          maxLength={4}
                        />
                      </label>

                      <label className="space-y-1 block text-sm">
                        <span className="text-foreground">
                          誕生日
                          <span className="ml-2 text-xs text-muted-foreground">任意</span>
                        </span>
                        <Input
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                        />
                      </label>
                      {isEdit && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm text-foreground">Discord連携</span>
                              <p className="text-xs text-muted-foreground">
                                Discordプロフィールへのリンクを有効にします。
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-3">
                            <div className="flex-1 text-sm">
                              {discordId ? (
                                <span>
                                  連携中: {discordUsername || "Discordユーザー"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">未連携</span>
                              )}
                            </div>
                            {discordId ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={discordDisconnecting}
                                onClick={handleDiscordDisconnect}
                                className="w-full sm:w-auto"
                              >
                                {discordDisconnecting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "連携解除"
                                )}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={discordConnecting}
                                onClick={handleDiscordConnect}
                                className="w-full sm:w-auto"
                              >
                                {discordConnecting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Discordと連携"
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <label className="space-y-1 block text-sm">
                          <span className="text-foreground">job</span>
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
                              jobは管理者が設定します。
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

                      <Button type="submit" disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                        {submitLabel}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              {isEdit && (
                <Card className="bg-card/60 border-destructive/40 max-w-3xl mt-8">
                  <CardHeader>
                    <CardTitle className="text-xl text-destructive">アカウント削除</CardTitle>
                    <CardDescription>
                      この操作は取り消せません。削除するとログインできなくなります。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="gap-2"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      アカウントを削除
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
