import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useProfileData, partOptions } from "../hooks/useProfileData";
import { useAvatar } from "../hooks/useAvatar";
import { useDiscord } from "../hooks/useDiscord";
import { AvatarUploader } from "./AvatarUploader";
import { RoleSelector } from "./RoleSelector";
import { DiscordConnectSection } from "./DiscordConnectSection";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

type ProfileFormProps = {
    isEdit: boolean;
    nextUrl: string;
};

export function ProfileForm({ isEdit, nextUrl }: ProfileFormProps) {
    const { session } = useAuth();
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    // 1. Hooks
    const profileHook = useProfileData();
    // We need to initialize other hooks with data from profileHook once loaded
    const { avatarInitialUrl, discordInitialId, discordInitialUsername, loading } = profileHook;

    const avatarHook = useAvatar(avatarInitialUrl);
    const discordHook = useDiscord(discordInitialId, discordInitialUsername);

    // Sync initial data to secondary hooks when profile loads
    useEffect(() => {
        if (!loading) {
            // NOTE: useAvatar handles initialUrl internally via useEffect
            // discordHook needs manual sync if keys change, but we passed initial args.
            // However, initial args only work on first render. 
            // Let's rely on the useEffect inside useDiscord if we added it, 
            // OR explicitly set state here.
            discordHook.setDiscordState(discordInitialId, discordInitialUsername);
        }
    }, [loading, discordInitialId, discordInitialUsername]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // 2. Submit Handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session) return;

        if (!profileHook.displayName.trim()) {
            toast.error("表示名を入力してください。");
            return;
        }
        if (!profileHook.realName.trim()) {
            toast.error("本名を入力してください。");
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
            toast.error("メイン楽器を選択してください。");
            return;
        }

        setSaving(true);

        // A. Upload Avatar
        let nextAvatarUrl = profileHook.avatarInitialUrl;
        // Attempt upload if file exists
        if (avatarHook.avatarFile) {
            const url = await avatarHook.uploadAvatar(session.user.id);
            if (url) nextAvatarUrl = url;
            else {
                setSaving(false);
                return; // Upload failed
            }
        }

        // B. Update Profile Table
        const updates: any = {
            display_name: profileHook.displayName.trim(),
            real_name: profileHook.realName.trim(),
            discord_username: discordHook.discordUsername || null, // UI doesn't allow editing username manually basically
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
            toast.error("プロフィールの保存に失敗しました。");
            setSaving(false);
            return;
        }

        // C. Update Private Table
        const { error: privateError } = await supabase
            .from("profile_private")
            .upsert({
                profile_id: session.user.id,
                student_id: profileHook.studentId.trim(),
                enrollment_year: profileHook.enrollmentYear ? Number(profileHook.enrollmentYear) : null,
                birth_date: profileHook.birthDate || null,
            }, { onConflict: "profile_id" });

        if (privateError) {
            toast.error("学籍情報の保存に失敗しました。");
            setSaving(false);
            return;
        }

        // D. Update Parts (Sub Parts)
        // First, delete subparts if primary part changed or clear requested?
        // Current logic: Part is stored in profiles.part (primary implementation here is different from legacy?)
        // Original code Logic: profiles.part is primary. profile_parts table stores ALL parts including primary flag.

        // Legacy sync logic...
        const desiredParts = [profileHook.part, ...profileHook.subParts].filter(Boolean) as string[];

        // Reset all is_primary
        await supabase.from("profile_parts").update({ is_primary: false }).eq("profile_id", session.user.id);

        // Upsert desired parts
        const upsertRows = desiredParts.map(p => ({
            profile_id: session.user.id,
            part: p,
            is_primary: p === profileHook.part
        }));

        if (upsertRows.length > 0) {
            const { error: partsError } = await supabase
                .from("profile_parts")
                .upsert(upsertRows, { onConflict: "profile_id,part" });

            if (partsError) console.error(partsError);

            // Delete removed parts
            const { data: currentRows } = await supabase.from("profile_parts").select("part").eq("profile_id", session.user.id);
            if (currentRows) {
                const partsToDelete = currentRows
                    .map(r => r.part)
                    .filter(p => !desiredParts.includes(p));

                if (partsToDelete.length > 0) {
                    await supabase.from("profile_parts").delete().eq("profile_id", session.user.id).in("part", partsToDelete);
                }
            }
        }

        toast.success(isEdit ? "保存しました。" : "設定が完了しました！");
        setSaving(false);
        router.replace(nextUrl);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500">
            {/* 1. Crew Selection (Highlight) */}
            <section>
                <RoleSelector
                    value={profileHook.crew}
                    onChange={profileHook.setCrew}
                    disabled={!profileHook.canEditCrew}
                />
            </section>

            {/* 2. Avatar & Basic Info */}
            <div className="grid gap-8 md:grid-cols-2">
                <section className="space-y-6">
                    <AvatarUploader
                        displayName={profileHook.displayName}
                        avatarHook={avatarHook}
                    />

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">表示名 <span className="text-destructive">*</span></label>
                            <Input
                                value={profileHook.displayName}
                                onChange={e => profileHook.setDisplayName(e.target.value)}
                                placeholder="例: 太郎 (Taro)"
                            />
                            <p className="text-xs text-muted-foreground">サークル内で呼ばれる名前です。</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">本名 <span className="text-destructive">*</span></label>
                            <Input
                                value={profileHook.realName}
                                onChange={e => profileHook.setRealName(e.target.value)}
                                placeholder="例: 山田 太郎"
                            />
                            <p className="text-xs text-muted-foreground">緊急連絡や名簿に使用されます。</p>
                        </div>
                    </div>
                </section>

                {/* 3. Student Info & Part */}
                <section className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">学籍番号 <span className="text-destructive">*</span></label>
                            <Input
                                value={profileHook.studentId}
                                onChange={e => profileHook.setStudentId(e.target.value)}
                                placeholder="24A0000"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">入学年度 <span className="text-destructive">*</span></label>
                            <Input
                                value={profileHook.enrollmentYear}
                                onChange={e => profileHook.setEnrollmentYear(e.target.value)}
                                placeholder="2024"
                                maxLength={4}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">誕生日</label>
                        <Input
                            type="date"
                            value={profileHook.birthDate}
                            onChange={e => profileHook.setBirthDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">メイン楽器 (Part) <span className="text-destructive">*</span></label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            value={profileHook.part}
                            onChange={e => profileHook.setPart(e.target.value)}
                        >
                            <option value="">選択してください</option>
                            {partOptions.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">サブ楽器 (複数選択可)</label>
                        <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/20 max-h-32 overflow-y-auto">
                            {partOptions.map(p => (
                                <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-primary">
                                    <input
                                        type="checkbox"
                                        checked={profileHook.subParts.includes(p)}
                                        onChange={() => profileHook.toggleSubPart(p)}
                                        className="rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    {p}
                                </label>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            {/* 4. Discord Integration */}
            {isEdit && (
                <section>
                    <DiscordConnectSection
                        discordHook={discordHook}
                        nextUrl={nextUrl}
                    />
                </section>
            )}

            {/* 5. Submit Action */}
            <div className="pt-6 border-t border-border flex justify-end">
                <Button
                    type="submit"
                    size="lg"
                    disabled={saving || avatarHook.avatarUploading}
                    className="w-full sm:w-auto min-w-[12rem] font-bold"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {isEdit ? "変更を保存" : "登録してはじめる"}
                </Button>
            </div>
        </form>
    );
}
