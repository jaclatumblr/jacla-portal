"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Download, MessageCircle, Music, RefreshCw, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdministrator } from "@/lib/useIsAdministrator";
import { useCanViewStudentId } from "@/lib/useCanViewStudentId";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { toast } from "@/lib/toast";
import { downloadExcelFile } from "@/lib/exportExcel";

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
  birthDate: string | null;
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
  birth_date: string | null;
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
  "Public Relations": "広報",
  "Web Secretary": "Web幹事",
};

const positionPriority: Record<string, number> = {
  Official: 0,
  President: 1,
  "Vice President": 2,
  Treasurer: 3,
  "PA Chief": 4,
  "Lighting Chief": 4,
  "Public Relations": 5,
  "Web Secretary": 6,
};

const sortOptions = [
  { value: "role", label: "権限順" },
  { value: "name", label: "名前順" },
  { value: "part", label: "パート順" },
  { value: "enrollment", label: "入学年度順" },
] as const;

type SortKey = (typeof sortOptions)[number]["value"];

export default function MembersPage() {
  const { session, loading: authLoading } = useAuth();
  const { isAdministrator, loading: adminLoading } = useIsAdministrator();
  const { canViewStudentId, loading: studentAccessLoading } = useCanViewStudentId();
  const { isAdministrator: isAdminRole, isSupervisor, isPaLeader, isLightingLeader, isPartLeader } =
    useRoleFlags();
  const [members, setMembers] = useState<Member[]>([]);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("role");
  const [loading, setLoading] = useState(true);
  const [discordFallbackFor, setDiscordFallbackFor] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const canExport = isAdminRole || isSupervisor || isPaLeader || isLightingLeader || isPartLeader;

  const getDiscordAppUrl = (id: string) => {
    const encoded = encodeURIComponent(id);
    if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
      return `intent://discord.com/users/${encoded}#Intent;scheme=https;package=com.discord;end`;
    }
    return `discord://discord.com/users/${encoded}`;
  };

  const handleExport = (scope: "all" | "pa" | "lighting") => {
    if (!canExport) {
      toast.error("エクスポートはleaderロール保持者のみ利用できます。");
      return;
    }
    if (!canViewStudentId) {
      toast.error("学籍番号の閲覧権限がありません。");
      return;
    }
    const scopeLabel =
      scope === "pa" ? "PA" : scope === "lighting" ? "照明" : "全体";
    const filtered =
      scope === "all"
        ? members
        : members.filter((member) => member.crew === (scope === "pa" ? "PA" : "Lighting"));
    const rows = filtered.map((member) => [
      member.realName ?? member.name ?? "",
      member.studentId ?? "",
    ]);
    downloadExcelFile(`名簿_${scopeLabel}`, ["本名", "学籍番号"], rows);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 320);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (authLoading || adminLoading || studentAccessLoading || !session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

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
        toast.error("部員情報の取得に失敗しました。時間をおいて再度お試しください。");
        setMembers([]);
        setLoading(false);
        return;
      }

      const bandMap = new Map<string, Set<string>>();
      if (bandsRes.error) {
        console.error(bandsRes.error);
        toast.error("バンド情報の取得に失敗しました。");
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
        toast.error("ロール情報の取得に失敗しました。");
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
        toast.error("役職情報の取得に失敗しました。");
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
      const birthDateMap = new Map<string, string>();
      if (enrollmentRes.error) {
        console.error(enrollmentRes.error);
        toast.error("入学年度の取得に失敗しました。");
      } else {
        const enrollmentRows = (enrollmentRes.data ?? []) as EnrollmentYearRow[];
        enrollmentRows.forEach((entry) => {
          if (!entry.profile_id) return;
          const yearValue = entry.enrollment_year != null ? String(entry.enrollment_year) : "";
          if (yearValue) {
            enrollmentMap.set(entry.profile_id, yearValue);
          }
          const birthValue = entry.birth_date ? String(entry.birth_date) : "";
          if (birthValue) {
            birthDateMap.set(entry.profile_id, birthValue);
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
          toast.error("学籍番号の取得に失敗しました。");
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
          birthDate: birthDateMap.get(profile.id) ?? null,
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

  const normalizedQuery = searchText.trim().toLowerCase();

  const visibleMembers = useMemo(() => {
    const filtered = normalizedQuery
      ? members.filter((member) => {
          const values: Array<string | null | undefined> = [
            member.name,
            member.realName,
            member.part,
            member.crew,
            member.discordName,
            member.enrollmentYear,
            member.birthDate,
            ...member.leaderRoles,
            ...member.positions,
            ...member.bands,
          ];
          if (member.studentId && member.leaderRoles.length > 0) {
            values.push(member.studentId);
          }
          return values.some(
            (value) => value && value.toLowerCase().includes(normalizedQuery)
          );
        })
      : members;

    if (sortKey === "role") return filtered;

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "ja");
        case "part": {
          const partA = a.part ?? "";
          const partB = b.part ?? "";
          if (!partA && !partB) return 0;
          if (!partA) return 1;
          if (!partB) return -1;
          return partA.localeCompare(partB, "ja");
        }
        case "enrollment": {
          const yearA = a.enrollmentYear ? Number(a.enrollmentYear) : Number.POSITIVE_INFINITY;
          const yearB = b.enrollmentYear ? Number(b.enrollmentYear) : Number.POSITIVE_INFINITY;
          if (yearA !== yearB) return yearA - yearB;
          return a.name.localeCompare(b.name, "ja");
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [members, normalizedQuery, sortKey]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Members"
            title="部員一覧"
            description="部員情報と担当パートを確認できます。"
            size="lg"
            meta={
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      placeholder="名前、役職、パート、バンドで検索..."
                      className="pl-10 bg-card/50 border-border"
                    />
                  </div>
                  <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as SortKey)}
                    className="h-10 w-full sm:w-auto rounded-md border border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExport("all")}
                    disabled={!canExport || !canViewStudentId}
                  >
                    <Download className="w-4 h-4" />
                    全体名簿（Excel）
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExport("pa")}
                    disabled={!canExport || !canViewStudentId}
                  >
                    <Download className="w-4 h-4" />
                    PA名簿（Excel）
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleExport("lighting")}
                    disabled={!canExport || !canViewStudentId}
                  >
                    <Download className="w-4 h-4" />
                    照明名簿（Excel）
                  </Button>
                </div>
                {!canExport && (
                  <p className="text-xs text-muted-foreground">
                    エクスポートはleaderロール保持者のみ利用できます。
                  </p>
                )}
                {canExport && !canViewStudentId && (
                  <p className="text-xs text-muted-foreground">
                    学籍番号の閲覧権限がないためエクスポートはできません。
                  </p>
                )}
              </div>
            }
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  読み込み中...
                </div>
              ) : visibleMembers.length === 0 ? (
                <div className="text-sm text-muted-foreground">部員が見つかりませんでした。</div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                  {visibleMembers.map((member, index) => {
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
                    const discordLinks = member.discordId
                      ? {
                          app: getDiscordAppUrl(member.discordId),
                          web: `https://discord.com/users/${encodeURIComponent(member.discordId)}`,
                        }
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
                            <p className="text-xs text-muted-foreground truncate">
                              誕生日: {member.birthDate ?? "未登録"}
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
                                <div className="min-w-0">
                                  {discordLinks ? (
                                    <a
                                      href={discordLinks.app}
                                      onClick={() => setDiscordFallbackFor(member.id)}
                                      className="truncate text-primary hover:underline"
                                    >
                                      Discord: {discordLabel}
                                    </a>
                                  ) : (
                                    <span className="truncate">Discord: {discordLabel}</span>
                                  )}
                                  {discordLinks && discordFallbackFor === member.id && (
                                    <div className="text-xs text-muted-foreground">
                                      開かない場合は
                                      <a
                                        href={discordLinks.web}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-1 text-primary hover:underline"
                                      >
                                        Web版
                                      </a>
                                    </div>
                                  )}
                                </div>
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

          {showBackToTop && (
            <Button
              type="button"
              size="icon"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg"
              aria-label="ページ上部へ戻る"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
