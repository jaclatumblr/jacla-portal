// app/me/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Calendar,
  Edit,
  IdCard,
  MessageCircle,
  Music,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type ProfileData = {
  display_name?: string | null;
  real_name?: string | null;
  email?: string | null;
  part?: string | null;
  crew?: string | null;
  leader?: string | null;
  created_at?: string | null;
  discord?: string | null;
  discord_username?: string | null;
  discord_id?: string | null;
  avatar_url?: string | null;
};

type BandMemberRow = {
  instrument: string | null;
  bands: { id: string; name: string } | { id: string; name: string }[] | null;
};

type BandItem = {
  id: string;
  name: string;
  role: string;
};

const positionLabels: Record<string, string> = {
  Official: "Official",
  President: "部長",
  "Vice President": "副部長",
  Treasurer: "会計",
  "PA Chief": "PA長",
  "Lighting Chief": "照明長",
  "Web Secretary": "Web幹事",
};

const positionPriority: Record<string, number> = {
  Official: 0,
  President: 1,
  "Vice President": 2,
  Treasurer: 3,
  "PA Chief": 4,
  "Lighting Chief": 4,
  "Web Secretary": 5,
};

export default function ProfilePage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [leaderRoles, setLeaderRoles] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [bands, setBands] = useState<BandItem[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [enrollmentYear, setEnrollmentYear] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [profileRes, bandRes, leadersRes, privateRes, positionsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase
          .from("band_members")
          .select("instrument, bands(id, name)")
          .eq("user_id", session.user.id),
        supabase
          .from("profile_leaders")
          .select("leader")
          .eq("profile_id", session.user.id),
        supabase
          .from("profile_private")
          .select("student_id, enrollment_year, birth_date")
          .eq("profile_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("profile_positions")
          .select("position")
          .eq("profile_id", session.user.id),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        console.error(profileRes.error);
        setError("プロフィールの取得に失敗しました。");
      } else {
        setProfile((profileRes.data ?? null) as ProfileData | null);
      }

      if (leadersRes.error) {
        console.error(leadersRes.error);
        const rawLeader = profileRes.data
          ? (profileRes.data as ProfileData).leader
          : null;
        const fallback = rawLeader && rawLeader !== "none" ? [rawLeader] : [];
        setLeaderRoles(fallback);
      } else {
        const roles = (leadersRes.data ?? [])
          .map((row) => (row as { leader?: string }).leader)
          .filter((role) => role && role !== "none") as string[];
        if (roles.length === 0) {
          const rawLeader = profileRes.data
            ? (profileRes.data as ProfileData).leader
            : null;
          setLeaderRoles(rawLeader && rawLeader !== "none" ? [rawLeader] : []);
        } else {
          setLeaderRoles(roles);
        }
      }

      if (positionsRes.error) {
        console.error(positionsRes.error);
        setPositions([]);
      } else {
        const values = (positionsRes.data ?? [])
          .map((row) => (row as { position?: string }).position)
          .filter((value) => value) as string[];
        setPositions(values);
      }

      if (privateRes.error) {
        console.error(privateRes.error);
      } else {
        const privateRow = privateRes.data as
          | { student_id?: string | null; enrollment_year?: number | null; birth_date?: string | null }
          | null;
        setStudentId(privateRow?.student_id ?? null);
        setEnrollmentYear(
          privateRow?.enrollment_year != null ? String(privateRow.enrollment_year) : null
        );
        setBirthDate(privateRow?.birth_date ?? null);
      }

      if (bandRes.error) {
        console.error(bandRes.error);
        setError((prev) => prev ?? "所属バンドの取得に失敗しました。");
        setBands([]);
      } else {
        const map = new Map<string, { name: string; roles: Set<string> }>();
        (bandRes.data ?? []).forEach((row) => {
          const bandRow = row as BandMemberRow;
          const bandEntries = Array.isArray(bandRow.bands)
            ? bandRow.bands
            : bandRow.bands
            ? [bandRow.bands]
            : [];
          const role = bandRow.instrument?.trim();
          bandEntries.forEach((band) => {
            const entry = map.get(band.id) ?? { name: band.name, roles: new Set<string>() };
            if (role) entry.roles.add(role);
            map.set(band.id, entry);
          });
        });
        const list = Array.from(map.entries()).map(([id, entry]) => ({
          id,
          name: entry.name,
          role: entry.roles.size > 0 ? Array.from(entry.roles).join(" / ") : "担当未設定",
        }));
        setBands(list);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const displayName =
    profile?.display_name?.trim() ||
    session?.user.user_metadata?.full_name ||
    session?.user.email ||
    "未設定";

  const partLabel = profile?.part && profile.part !== "none" ? profile.part : "未設定";
  const crewLabel = profile?.crew ?? "User";
  const isOfficialRole = positions.includes("Official");
  const hasPositionBadge = positions.some((value) => value !== "Official");
  const leaderDisplayRoles = leaderRoles.filter((role) => {
    if (role === "Administrator") return false;
    if (!hasPositionBadge) return true;
    return role !== "Supervisor" && role !== "PA Leader" && role !== "Lighting Leader";
  });
  const leaderLabel = leaderDisplayRoles.join(" / ");
  const positionBadgeLabel =
    positions.length > 0
      ? [...positions]
          .filter((value) => value !== "Official")
          .sort((a, b) => (positionPriority[a] ?? 99) - (positionPriority[b] ?? 99))
          .map((value) => positionLabels[value] ?? value)
          .join(" / ")
      : null;
  const positionDetailLabel =
    positions.length > 0
      ? [...positions]
          .sort((a, b) => (positionPriority[a] ?? 99) - (positionPriority[b] ?? 99))
          .map((value) => positionLabels[value] ?? value)
          .join(" / ")
      : null;
  const hideCrewByLeader =
    leaderDisplayRoles.includes("PA Leader") || leaderDisplayRoles.includes("Lighting Leader");
  const roleSegments: string[] = [];
  if (leaderLabel) roleSegments.push(leaderLabel);
  if (crewLabel !== "User" && !hideCrewByLeader) roleSegments.push(crewLabel);
  const roleBadge = roleSegments.length > 0 ? roleSegments.join(" / ") : "User";
  const isAdministratorRole = leaderRoles.includes("Administrator");
  const showAdminBadge = isAdministratorRole && !isOfficialRole;
  const showRoleBadge =
    roleBadge !== "User" || (!isAdministratorRole && !isOfficialRole);
  const realNameLabel = profile?.real_name?.trim() || "未設定";
  const studentIdLabel = studentId?.trim() || "未設定";
  const enrollmentYearLabel = enrollmentYear?.trim() || "未設定";
  const birthDateLabel = birthDate?.trim() || "未設定";
  const joinDate = profile?.created_at ? profile.created_at.split("T")[0] : "-";
  const discordValue =
    profile?.discord_username ||
    profile?.discord ||
    session?.user.user_metadata?.discord ||
    "";
  const discordId = profile?.discord_id ?? null;
  const discordLabel = discordValue || "未設定";
  const discordUrl = discordId
    ? `https://discord.com/users/${encodeURIComponent(discordId)}`
    : null;
  const avatarUrl =
    profile?.avatar_url ||
    session?.user.user_metadata?.avatar_url ||
    session?.user.user_metadata?.picture ||
    "";

  const editHref = "/me/profile/edit";

  const loadingBlock = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className="w-4 h-4 animate-spin" />
      読み込み中...
    </div>
  );

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">PROFILE</span>

                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mt-8">
                  <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-primary/30">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xl md:text-2xl font-bold">
                      {displayName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">{displayName}</h1>
                      {isOfficialRole && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/15 text-primary shadow-sm"
                        >
                          Official
                        </Badge>
                      )}
                      {showAdminBadge && (
                        <Badge
                          variant="outline"
                          className="border-[#aee6ff]/40 bg-[#aee6ff]/10 text-[#aee6ff]"
                        >
                          Administrator
                        </Badge>
                      )}
                      {positionBadgeLabel && <Badge variant="secondary">{positionBadgeLabel}</Badge>}
                      {showRoleBadge && (
                        <Badge variant="outline" className="bg-transparent">
                          {roleBadge}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:gap-4 text-muted-foreground text-sm md:text-base">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-primary" />
                        <span>{partLabel}</span>
                      </div>
                      <span className="hidden sm:inline">/</span>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>参加日: {joinDate}</span>
                      </div>
                    </div>
                  </div>

                  <Link href={editHref}>
                    <Button variant="outline" className="bg-transparent w-full sm:w-auto mt-4 sm:mt-0">
                      <Edit className="w-4 h-4 mr-2" />
                      編集
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              {error && (
                <div className="mb-6 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto mb-8 md:mb-12">
                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <h3 className="text-lg font-bold mb-4 md:mb-6">登録情報</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Discord</p>
                        <p className="font-medium text-sm md:text-base truncate">
                          {loading ? (
                            "..."
                          ) : discordUrl ? (
                            <a
                              href={discordUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {discordLabel}
                            </a>
                          ) : (
                            discordLabel
                          )}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">本名</p>
                        <p className="font-medium text-sm md:text-base truncate">{realNameLabel}</p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                        <IdCard className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">学籍番号</p>
                        <p className="font-medium text-sm md:text-base truncate">{studentIdLabel}</p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">入学年度</p>
                        <p className="font-medium text-sm md:text-base truncate">
                          {enrollmentYearLabel}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">誕生日</p>
                        <p className="font-medium text-sm md:text-base truncate">
                          {birthDateLabel}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">クルー</p>
                        <p className="font-medium text-sm md:text-base truncate">{crewLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
                  <h3 className="text-lg font-bold mb-4 md:mb-6">パート情報</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">メイン</p>
                        <p className="font-medium text-sm md:text-base">{partLabel}</p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BadgeCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">役職</p>
                        <p className="font-medium text-sm md:text-base">
                          {positionDetailLabel ?? "未設定"}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-border" />

                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">権限</p>
                        <p className="font-medium text-sm md:text-base">{leaderLabel ?? "未設定"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="text-xs text-primary tracking-[0.3em] font-mono">BANDS</span>
                    <h2 className="text-xl md:text-2xl font-bold mt-2">所属バンド</h2>
                  </div>
                  <Link href="/me/bands">
                    <Button variant="outline" className="bg-transparent w-full sm:w-auto">
                      バンド管理
                    </Button>
                  </Link>
                </div>

                {loading ? (
                  loadingBlock
                ) : bands.length === 0 ? (
                  <div className="text-sm text-muted-foreground">所属バンドがありません。</div>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {bands.map((band, index) => (
                      <div
                        key={band.id}
                        className="group flex items-center justify-between p-3 md:p-4 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                      >
                        <div className="flex items-center gap-3 md:gap-4 min-w-0">
                          <span className="hidden sm:block text-xs text-muted-foreground font-mono">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm md:text-base truncate">{band.name}</p>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">{band.role}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-primary shrink-0">
                          詳細
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
