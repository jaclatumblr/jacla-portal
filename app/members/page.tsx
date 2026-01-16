"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Users } from "lucide-react";
import { SkeletonMemberCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";
import { AuthGuard } from "@/lib/AuthGuard";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { useMembers } from "./hooks/useMembers";
import { MemberCard } from "./components/MemberCard";
import { MemberFilters } from "./components/MemberFilters";
import { ExportButtons } from "./components/ExportButtons";
import type { SortKey } from "./types";

export default function MembersPage() {
  const { members, subPartsByProfileId, loading, isAdministrator, canViewStudentId } =
    useMembers();
  const { isAdministrator: isAdminRole, isSupervisor } = useRoleFlags();

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("role");
  const [discordFallbackFor, setDiscordFallbackFor] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const canExport = isAdminRole || isSupervisor;

  // スクロール位置の監視
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 320);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 検索・ソート
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
          ...(subPartsByProfileId[member.id] ?? []),
        ];
        if (member.studentId && member.leaderRoles.length > 0) {
          values.push(member.studentId);
        }
        return values.some((value) => value && value.toLowerCase().includes(normalizedQuery));
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
  }, [members, normalizedQuery, sortKey, subPartsByProfileId]);

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
                <div className="flex flex-wrap items-center gap-4">
                  <MemberFilters
                    searchText={searchText}
                    onSearchChange={setSearchText}
                    sortKey={sortKey}
                    onSortChange={setSortKey}
                  />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-primary">{members.filter(m => !m.leaderRoles.includes("Administrator")).length}</span>
                    <span className="text-muted-foreground">名</span>
                  </div>
                </div>
                <ExportButtons
                  members={members}
                  canExport={canExport}
                  canViewStudentId={canViewStudentId}
                />
              </div>
            }
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              {loading ? (
                <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                  {[...Array(6)].map((_, i) => (
                    <SkeletonMemberCard key={i} />
                  ))}
                </div>
              ) : visibleMembers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  部員が見つかりませんでした。
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                  {visibleMembers.map((member, index) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      index={index}
                      subParts={subPartsByProfileId[member.id] ?? []}
                      canViewStudentId={canViewStudentId}
                      isAdministrator={isAdministrator}
                      discordFallbackFor={discordFallbackFor}
                      onDiscordClick={setDiscordFallbackFor}
                    />
                  ))}
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
