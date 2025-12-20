"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Music, RefreshCw, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

type Member = {
  id: string;
  name: string;
  discord: string | null;
  part: string | null;
  crew: string | null;
  leaderRoles: string[];
  bands: string[];
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  part: string | null;
  crew: string | null;
  leader: string | null;
  discord: string | null;
  discord_username: string | null;
};

type BandMemberRow = {
  user_id: string;
  bands: { id: string; name: string } | { id: string; name: string }[] | null;
};

type LeaderRow = {
  profile_id: string;
  leader: string;
};

export default function MembersPage() {
  const { session, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [profilesRes, bandsRes, leadersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email, part, crew, leader, discord, discord_username")
          .order("display_name", { ascending: true }),
        supabase.from("band_members").select("user_id, bands(id, name)"),
        supabase.from("profile_leaders").select("profile_id, leader"),
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

      const list = (profilesRes.data ?? []).map((row) => {
        const profile = row as ProfileRow;
        const leaderFallback =
          profile.leader && profile.leader !== "none" ? [profile.leader] : [];
        const leaderRoles = Array.from(leaderMap.get(profile.id) ?? leaderFallback);
        return {
          id: profile.id,
          name: profile.display_name ?? profile.email ?? "名前未登録",
          part: profile.part && profile.part !== "none" ? profile.part : null,
          crew: profile.crew ?? null,
          leaderRoles,
          discord: profile.discord ?? profile.discord_username ?? null,
          bands: Array.from(bandMap.get(profile.id) ?? []),
        } satisfies Member;
      });

      setMembers(list);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session]);

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
                  部員情報と担当パートを確認できます。連絡はDiscordを利用してください。
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
                    const leaderLabel =
                      member.leaderRoles.length > 0 ? member.leaderRoles.join(" / ") : null;
                    const roleLabel = leaderLabel ?? member.crew ?? "User";
                    const partLabel = member.part ?? "未設定";
                    const discordLabel = member.discord ?? "未連携";
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
                              <Badge variant="secondary" className="text-xs">
                                {roleLabel}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                              <Music className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-sm text-muted-foreground">{partLabel}</span>
                            </div>

                            <div className="space-y-1 mb-3 md:mb-4 text-xs md:text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MessageCircle className="w-4 h-4 shrink-0" />
                                <span className="truncate">Discord: {discordLabel}</span>
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
