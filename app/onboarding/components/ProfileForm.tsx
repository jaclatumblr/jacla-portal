import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { AvatarUploader } from "./AvatarUploader";
import { DiscordConnectSection } from "./DiscordConnectSection";
import { RoleSelector } from "./RoleSelector";
import { useAvatar } from "../hooks/useAvatar";
import { useDiscord } from "../hooks/useDiscord";
import { partOptions, useProfileData } from "../hooks/useProfileData";

type ProfileFormProps = {
  isEdit: boolean;
  nextUrl: string;
};

export function ProfileForm({ isEdit, nextUrl }: ProfileFormProps) {
  const { session } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const profileHook = useProfileData();
  const { avatarInitialUrl, discordInitialId, discordInitialUsername, loading } = profileHook;
  const avatarHook = useAvatar(avatarInitialUrl);
  const discordHook = useDiscord(discordInitialId, discordInitialUsername);

  useEffect(() => {
    if (!loading) {
      discordHook.setDiscordState(discordInitialId, discordInitialUsername);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, discordInitialId, discordInitialUsername]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    const familyName = profileHook.realNameFamily.trim();
    const givenName = profileHook.realNameGiven.trim();
    const realNameCombined = profileHook.realNameCombined.trim();

    if (!profileHook.displayName.trim()) {
      toast.error("表示名を入力してください。");
      return;
    }
    if (!familyName || !givenName) {
      toast.error("本名は苗字と名前の両方を入力してください。");
      return;
    }
    if (!profileHook.studentId.trim() && !profileHook.isAdminLeader) {
      toast.error("学籍番号を入力してください。");
      return;
    }
    if (!profileHook.enrollmentYear.trim() && !profileHook.isAdminLeader) {
      toast.error("入学年度を入力してください。");
      return;
    }
    if (!profileHook.isAdminLeader && !profileHook.part) {
      toast.error("メインパートを選択してください。");
      return;
    }

    setSaving(true);

    let nextAvatarUrl = profileHook.avatarInitialUrl;
    if (avatarHook.avatarFile) {
      const uploaded = await avatarHook.uploadAvatar(session.user.id);
      if (!uploaded) {
        setSaving(false);
        return;
      }
      nextAvatarUrl = uploaded;
    }

    const updates: Record<string, string | null> = {
      display_name: profileHook.displayName.trim(),
      real_name: realNameCombined,
      discord_username: discordHook.discordUsername || null,
      part: profileHook.part || "none",
      avatar_url: nextAvatarUrl,
    };
    if (profileHook.canEditCrew) {
      updates.crew = profileHook.crew;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", session.user.id);

    if (profileError) {
      console.error(profileError);
      toast.error("プロフィールの更新に失敗しました。");
      setSaving(false);
      return;
    }

    const { error: privateError } = await supabase
      .from("profile_private")
      .upsert(
        {
          profile_id: session.user.id,
          student_id: profileHook.studentId.trim(),
          enrollment_year: profileHook.enrollmentYear
            ? Number(profileHook.enrollmentYear)
            : null,
          birth_date: profileHook.birthDate || null,
        },
        { onConflict: "profile_id" }
      );

    if (privateError) {
      console.error(privateError);
      toast.error("学籍情報の更新に失敗しました。");
      setSaving(false);
      return;
    }

    const desiredParts = [profileHook.part, ...profileHook.subParts].filter(Boolean) as string[];

    await supabase
      .from("profile_parts")
      .update({ is_primary: false })
      .eq("profile_id", session.user.id);

    const upsertRows = desiredParts.map((part) => ({
      profile_id: session.user.id,
      part,
      is_primary: part === profileHook.part,
    }));

    if (upsertRows.length > 0) {
      const { error: partsError } = await supabase
        .from("profile_parts")
        .upsert(upsertRows, { onConflict: "profile_id,part" });

      if (partsError) {
        console.error(partsError);
      }

      const { data: currentRows } = await supabase
        .from("profile_parts")
        .select("part")
        .eq("profile_id", session.user.id);

      if (currentRows) {
        const partsToDelete = currentRows
          .map((row) => row.part)
          .filter((part) => !desiredParts.includes(part));

        if (partsToDelete.length > 0) {
          await supabase
            .from("profile_parts")
            .delete()
            .eq("profile_id", session.user.id)
            .in("part", partsToDelete);
        }
      }
    }

    toast.success(isEdit ? "保存しました。" : "設定が完了しました。");

    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        full_name: profileHook.displayName.trim(),
        avatar_url: nextAvatarUrl ?? null,
        picture: nextAvatarUrl ?? null,
      },
    });
    if (authUpdateError) {
      console.error(authUpdateError);
    } else {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error(refreshError);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profile:updated"));
    }

    setSaving(false);
    if (isEdit) {
      router.refresh();
      return;
    }
    router.replace(nextUrl);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500">
      <section>
        <RoleSelector
          value={profileHook.crew}
          onChange={profileHook.setCrew}
          disabled={!profileHook.canEditCrew}
        />
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-6">
          <AvatarUploader displayName={profileHook.displayName} avatarHook={avatarHook} />

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                表示名<span className="text-destructive">*</span>
              </label>
              <Input
                value={profileHook.displayName}
                onChange={(e) => profileHook.setDisplayName(e.target.value)}
                placeholder="例: タロウ (Taro)"
              />
              <p className="text-xs text-muted-foreground">サークル内で表示される名前です。</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                本名（苗字・名前）<span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  value={profileHook.realNameFamily}
                  onChange={(e) => profileHook.setRealNameFamily(e.target.value)}
                  placeholder="例: 山田"
                />
                <Input
                  value={profileHook.realNameGiven}
                  onChange={(e) => profileHook.setRealNameGiven(e.target.value)}
                  placeholder="例: 太郎"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                既存データで本名が1つの欄に登録されている場合は、苗字欄に入っています。必要に応じて修正してください。
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                学籍番号 <span className="text-destructive">*</span>
              </label>
              <Input
                value={profileHook.studentId}
                onChange={(e) => profileHook.setStudentId(e.target.value)}
                placeholder="24A0000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                入学年度 <span className="text-destructive">*</span>
              </label>
              <Input
                value={profileHook.enrollmentYear}
                onChange={(e) => profileHook.setEnrollmentYear(e.target.value)}
                placeholder="2024"
                maxLength={4}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">生年月日</label>
            <Input
              type="date"
              value={profileHook.birthDate}
              onChange={(e) => profileHook.setBirthDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              メインパート <span className="text-destructive">*</span>
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={profileHook.part}
              onChange={(e) => profileHook.setPart(e.target.value)}
            >
              <option value="">選択してください</option>
              {partOptions.map((part) => (
                <option key={part} value={part}>
                  {part}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">サブパート（複数選択）</label>
            <div className="max-h-32 overflow-y-auto rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap gap-2">
                {partOptions.map((part) => (
                  <label
                    key={part}
                    className="flex cursor-pointer items-center gap-1.5 text-sm hover:text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={profileHook.subParts.includes(part)}
                      onChange={() => profileHook.toggleSubPart(part)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    {part}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {isEdit && (
        <section>
          <DiscordConnectSection discordHook={discordHook} nextUrl={nextUrl} />
        </section>
      )}

      <div className="flex justify-end border-t border-border pt-6">
        <Button
          type="submit"
          size="lg"
          disabled={saving || avatarHook.avatarUploading}
          className="w-full min-w-[12rem] font-bold sm:w-auto"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEdit ? "変更を保存" : "プロフィールを作成"}
        </Button>
      </div>
    </form>
  );
}
