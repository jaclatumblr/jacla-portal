"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Music, RefreshCw, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useCanViewStudentId } from "@/lib/useCanViewStudentId";

type Member = {
  id: string;
  name: string;
  realName: string | null;
  email: string | null;
  studentId: string | null;
  discordName: string | null;
  discordId: string | null;
  part: string | null;
  crew: string | null;
  leaderRoles: string[];
  positions: string[];
  bands: string[];
  avatarUrl: string | null;
  enrollmentYear: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  real_name: string | null;
  email?: string | null;
  part: string | null;
  crew: string | null;
  leader: string | null;
  discord: string | null;
  discord_username: string | null;
  discord_id?: string | null;
  avatar_url?: string | null;
};

type ProfilePrivateRow = {
  profile_id: string;
  student_id: string;
};

type EnrollmentYearRow = {
  profile_id: string;
  enrollment_year: number | null;
};

type BandMemberRow = {
  user_id: string;
  bands: { id: string; name: string } | { id: string; name: string }[] | null;
};

type LeaderRow = {
  profile_id: string;
  leader: string;
};

type PositionRow = {
  profile_id: string;
  position: string;
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

export default function MembersPage() {
  const { session, loading: authLoading } = useAuth();
  const { isAdministrator, loading: adminLoading } = useIsAdministrator();
  const { canViewStudentId, loading: studentAccessLoading } = useCanViewStudentId();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || adminLoading || studentAccessLoading || !session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const profilesPromise = isAdministrator
        ? supabase
            .from("profiles")
            .select(
              "id, display_name, real_name, email, part, crew, leader, discord, discord_username, discord_id, avatar_url"
            )
            .order("display_name", { ascending: true })
        : supabase
            .from("profiles")
            .select("id, display_name, real_name, part, crew, leader, discord, discord_username, discord_id, avatar_url")
            .order("display_name", { ascending: true });

      const [profilesRes, bandsRes, leadersRes, positionsRes, enrollmentRes] = await Promise.all([
        profilesPromise,
        supabase.from("band_members").select("user_id, bands(id, name)"),
        supabase.from("profile_leaders").select("profile_id, leader"),
        supabase.from("profile_positions").select("profile_id, position"),
        supabase.rpc("get_profile_enrollment_years"),
      ]);

      if (cancelled) return;

      if (profilesRes.error) {
        console.error(profilesRes.error);
        setError("部員情報の取得に失敗しました。時間をおいて再度お試しください。");
        setMembers([]);
        setLoading(false);
        return;
      }

      const bandMap = new Map<string, Set<string>>();
      if (bandsRes.error) {
        console.error(bandsRes.error);
        setError((prev) => prev ?? "バンド情報の取得に失敗しました。");
      } else {
        (bandsRes.data ?? []).forEach((row) => {
          const bandRow = row as BandMemberRow;
          const bandEntries = Array.isArray(bandRow.bands)
            ? bandRow.bands
            : bandRow.bands
            ? [bandRow.bands]
            : [];
          const current = bandMap.get(bandRow.user_id) ?? new Set<string>();
          bandEntries.forEach((band) => current.add(band.name));
          bandMap.set(bandRow.user_id, current);
        });
      }

      const leaderMap = new Map<string, Set<string>>();
      if (leadersRes.error) {
        console.error(leadersRes.error);
        setError((prev) => prev ?? "ロール情報の取得に失敗しました。");
      } else {
        (leadersRes.data ?? []).forEach((row) => {
          const leaderRow = row as LeaderRow;
          if (!leaderRow.profile_id || !leaderRow.leader || leaderRow.leader === "none") return;
          const current = leaderMap.get(leaderRow.profile_id) ?? new Set<string>();
          current.add(leaderRow.leader);
          leaderMap.set(leaderRow.profile_id, current);
        });
      }

      const positionMap = new Map<string, Set<string>>();
      if (positionsRes.error) {
        console.error(positionsRes.error);
        setError((prev) => prev ?? "役職情報の取得に失敗しました。");
      } else {
        (positionsRes.data ?? []).forEach((row) => {
          const positionRow = row as PositionRow;
          if (!positionRow.profile_id || !positionRow.position) return;
          const current = positionMap.get(positionRow.profile_id) ?? new Set<string>();
          current.add(positionRow.position);
          positionMap.set(positionRow.profile_id, current);
        });
      }

      const enrollmentMap = new Map<string, string>();
      if (enrollmentRes.error) {
        console.error(enrollmentRes.error);
        setError((prev) => prev ?? "入学年度の取得に失敗しました。");
      } else {
        const enrollmentRows = (enrollmentRes.data ?? []) as EnrollmentYearRow[];
        enrollmentRows.forEach((entry) => {
          if (!entry.profile_id) return;
          const yearValue = entry.enrollment_year != null ? String(entry.enrollment_year) : "";
          if (yearValue) {
            enrollmentMap.set(entry.profile_id, yearValue);
          }
        });
      }

      const studentMap = new Map<string, string>();
      if (canViewStudentId) {
        const { data: privateData, error: privateError } = await supabase
          .from("profile_private")
          .select("profile_id, student_id");
        if (privateError) {
          console.error(privateError);
          setError((prev) => prev ?? "学籍番号の取得に失敗しました。");
        } else {
          (privateData ?? []).forEach((row) => {
            const entry = row as ProfilePrivateRow;
            if (!entry.profile_id) return;
            studentMap.set(entry.profile_id, entry.student_id);
          });
        }
      }

      const list = (profilesRes.data ?? []).map((row) => {
        const profile = row as ProfileRow;
        const leaderFallback =
          profile.leader && profile.leader !== "none" ? [profile.leader] : [];
        const leaderRoles = Array.from(leaderMap.get(profile.id) ?? leaderFallback);
        const positions = Array.from(positionMap.get(profile.id) ?? []);
        return {
          id: profile.id,
          name: profile.display_name ?? "名前未登録",
          realName: profile.real_name ?? null,
          email: isAdministrator ? profile.email ?? null : null,
          studentId: canViewStudentId ? studentMap.get(profile.id) ?? null : null,
          enrollmentYear: enrollmentMap.get(profile.id) ?? null,
          part: profile.part && profile.part !== "none" ? profile.part : null,
          crew: profile.crew ?? null,
          leaderRoles,
          positions,
          discordName: profile.discord_username ?? profile.discord ?? null,
          discordId: profile.discord_id ?? null,
          bands: Array.from(bandMap.get(profile.id) ?? []),
          avatarUrl: profile.avatar_url ?? null,
        } satisfies Member;
      });

      const leaderPriority: Record<string, number> = {
        Administrator: 0,
        Supervisor: 1,
        "PA Leader": 2,
        "Lighting Leader": 3,
        "Part Leader": 4,
      };
      const crewPriority: Record<string, number> = {
        PA: 5,
        Lighting: 6,
        User: 7,
      };
      const getPositionRank = (member: Member) => {
        if (member.positions.length === 0) return Number.POSITIVE_INFINITY;
        let rank = Number.POSITIVE_INFINITY;
        member.positions.forEach((position) => {
          if (position === "Official") return;
          const value = positionPriority[position];
          if (value !== undefined && value < rank) {
            rank = value;
          }
        });
        return Number.isFinite(rank) ? rank : 99;
      };
      const getTopRank = (member: Member) => {
        if (member.positions.includes("Official")) return 0;
        if (member.leaderRoles.includes("Administrator")) return 1;
        return 2;
      };
      const getRoleRank = (member: Member) => {
        let rank = Number.POSITIVE_INFINITY;
        member.leaderRoles.forEach((role) => {
          const value = leaderPriority[role];
          if (value !== undefined && value < rank) {
            rank = value;
          }
        });
        if (!Number.isFinite(rank)) {
          const crewValue = member.crew ? crewPriority[member.crew] : undefined;
          rank = crewValue ?? 99;
        }
        return rank;
      };

      const sorted = [...list].sort((a, b) => {
        const topA = getTopRank(a);
        const topB = getTopRank(b);
        if (topA !== topB) return topA - topB;
        const positionA = getPositionRank(a);
        const positionB = getPositionRank(b);
        if (positionA !== positionB) return positionA - positionB;
        const roleA = getRoleRank(a);
        const roleB = getRoleRank(b);
        if (roleA !== roleB) return roleA - roleB;
        return a.name.localeCompare(b.name, "ja");
      });

      setMembers(sorted);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, adminLoading, studentAccessLoading, isAdministrator, canViewStudentId, session]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-5xl pt-12 md:pt-0">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">MEMBERS</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-4 mb-4">部員一覧</h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl mb-8">
                  部員情報と担当パートを確認できます。
                </p>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 max-w-xl">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="名前、パート、バンドで検索..."
                      className="pl-10 bg-card/50 border-border"
                    />
                  </div>
                  <Button variant="outline" className="bg-transparent w-full sm:w-auto">
                    絞り込み
                  </Button>
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

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  読み込み中...
                </div>
              ) : members.length === 0 ? (
                <div className="text-sm text-muted-foreground">部員が見つかりませんでした。</div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                  {members.map((member, index) => {
                    const isOfficialRole = member.positions.includes("Official");
                    const isAdministratorRole = member.leaderRoles.includes("Administrator");
                    const showAdminBadge = isAdministratorRole && !isOfficialRole;
                    const hasPositionBadge = member.positions.some(
                      (value) => value !== "Official"
                    );
                    const leaderDisplayRoles = member.leaderRoles.filter((role) => {
                      if (role === "Administrator") return false;
                      if (!hasPositionBadge) return true;
                      return role !== "Supervisor" && role !== "PA Leader" && role !== "Lighting Leader";
                    });
                    const leaderLabel = leaderDisplayRoles.join(" / ");
                    const crewLabel = member.crew ?? "User";
                    const hideCrewByLeader =
                      leaderDisplayRoles.includes("PA Leader") ||
                      leaderDisplayRoles.includes("Lighting Leader");
                    const roleSegments: string[] = [];
                    if (leaderLabel) roleSegments.push(leaderLabel);
                    if (crewLabel !== "User" && !hideCrewByLeader) roleSegments.push(crewLabel);
                    const roleLabel = roleSegments.length > 0 ? roleSegments.join(" / ") : "User";
                    const showRoleBadge =
                      roleLabel !== "User" || (!isAdministratorRole && !isOfficialRole);
                    const positionLabel =
                      member.positions.length > 0
                        ? [...member.positions].filter((value) => value !== "Official")
                            .sort(
                              (a, b) =>
                                (positionPriority[a] ?? 99) - (positionPriority[b] ?? 99)
                            )
                            .map((value) => positionLabels[value] ?? value)
                            .join(" / ")
                        : null;
                    const partLabel = member.part ?? "未設定";
                    const discordLabel = member.discordName ?? "未連携";
                    const discordUrl = member.discordId
                      ? `https://discord.com/users/${encodeURIComponent(member.discordId)}`
                      : null;
                    const bandLabels = member.bands.length > 0 ? member.bands : ["所属バンドなし"];
                    const initial = member.name.trim().charAt(0) || "?";
                    return (
                      <div
                        key={member.id}
                        className="group relative p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />

                        <div className="relative flex items-start gap-3 md:gap-4">
                          <Avatar className="w-12 h-12 md:w-16 md:h-16 border-2 border-border shrink-0">
                            {member.avatarUrl && (
                              <AvatarImage src={member.avatarUrl} alt={member.name} />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-base md:text-lg">
                              {initial}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground font-mono">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <h3 className="font-bold text-base md:text-lg truncate">{member.name}</h3>
                              {isOfficialRole && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-primary/40 bg-primary/15 text-primary shadow-sm"
                                >
                                  Official
                                </Badge>
                              )}
                              {showAdminBadge && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-[#aee6ff]/40 bg-[#aee6ff]/10 text-[#aee6ff]"
                                >
                                  Administrator
                                </Badge>
                              )}
                              {positionLabel && (
                                <Badge variant="secondary" className="text-xs">
                                  {positionLabel}
                                </Badge>
                              )}
                              {showRoleBadge && (
                                <Badge variant="outline" className="text-xs bg-transparent">
                                  {roleLabel}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              本名: {member.realName ?? "未設定"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              入学年度: {member.enrollmentYear ?? "未登録"}
                            </p>
                            {canViewStudentId && (
                              <p className="text-xs text-muted-foreground truncate">
                                学籍番号: {member.studentId ?? "未登録"}
                              </p>
                            )}
                            {isAdministrator && (
                              <p className="text-xs text-muted-foreground truncate">
                                {member.email ?? "メール未登録"}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                              <Music className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-sm text-muted-foreground">{partLabel}</span>
                            </div>

                            <div className="space-y-1 mb-3 md:mb-4 text-xs md:text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MessageCircle className="w-4 h-4 shrink-0" />
                                {discordUrl ? (
                                  <a
                                    href={discordUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-primary hover:underline"
                                  >
                                    Discord: {discordLabel}
                                  </a>
                                ) : (
                                  <span className="truncate">Discord: {discordLabel}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1 md:gap-2">
                              {bandLabels.map((band) => (
                                <Badge key={band} variant="outline" className="bg-transparent text-xs">
                                  {band}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
