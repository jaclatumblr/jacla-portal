"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, Music, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";

type EventRow = {
  id: string;
  name: string;
  date: string | null;
};

type BandRow = {
  id: string;
  name: string;
  event_id: string;
  repertoire_status: string | null;
  events?: EventRow | EventRow[] | null;
};

type BandMemberRow = {
  band_id: string;
  instrument: string | null;
  bands?: BandRow | BandRow[] | null;
};

type BandSummary = {
  id: string;
  name: string;
  role: string;
  members: number;
  event: (EventRow & { status: string | null }) | null;
};

const statusLabel = (status: string | null) =>
  status === "submitted" ? "提出済み" : "下書き";

const dateLabel = (value: string | null) => (value ? value.slice(0, 10) : "-");

export default function MyBandsPage() {
  const { session } = useAuth();
  const [bands, setBands] = useState<BandSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const userId = session.user.id;

      const [memberRes, createdRes] = await Promise.all([
        supabase
          .from("band_members")
          .select(
            "band_id, instrument, bands(id, name, event_id, repertoire_status, events(id, name, date))"
          )
          .eq("user_id", userId),
        supabase
          .from("bands")
          .select("id, name, event_id, repertoire_status, events(id, name, date)")
          .eq("created_by", userId),
      ]);

      if (cancelled) return;

      if (memberRes.error || createdRes.error) {
        console.error(memberRes.error ?? createdRes.error);
        toast.error("マイバンドの取得に失敗しました。");
        setBands([]);
        setLoading(false);
        return;
      }

      const memberRows = (memberRes.data ?? []) as BandMemberRow[];
      const createdBands = (createdRes.data ?? []) as BandRow[];

      const bandMap = new Map<
        string,
        { name: string; event: BandSummary["event"]; roles: Set<string>; isOwner: boolean }
      >();

      const addBandEntry = (
        band: BandRow,
        role: string | null,
        isOwner: boolean
      ) => {
        const eventValue = Array.isArray(band.events)
          ? band.events[0] ?? null
          : band.events ?? null;
        const event = eventValue
          ? {
              id: eventValue.id,
              name: eventValue.name,
              date: eventValue.date,
              status: band.repertoire_status ?? "draft",
            }
          : null;
        const entry = bandMap.get(band.id) ?? {
          name: band.name,
          event,
          roles: new Set<string>(),
          isOwner: false,
        };
        if (role) entry.roles.add(role);
        if (isOwner) entry.isOwner = true;
        bandMap.set(band.id, entry);
      };

      memberRows.forEach((row) => {
        const bandEntries = Array.isArray(row.bands)
          ? row.bands
          : row.bands
          ? [row.bands]
          : [];
        bandEntries.forEach((band) => addBandEntry(band, row.instrument, false));
      });

      createdBands.forEach((band) => addBandEntry(band, null, true));

      const bandIds = Array.from(bandMap.keys());
      const memberCountsRes = bandIds.length
        ? await supabase
            .from("band_members")
            .select("band_id, user_id")
            .in("band_id", bandIds)
        : { data: [], error: null };

      if (memberCountsRes.error) {
        console.error(memberCountsRes.error);
      }

      const memberCounts = new Map<string, Set<string>>();
      (memberCountsRes.data ?? []).forEach((row) => {
        const entry = row as { band_id: string; user_id: string };
        const set = memberCounts.get(entry.band_id) ?? new Set<string>();
        set.add(entry.user_id);
        memberCounts.set(entry.band_id, set);
      });

      const list = Array.from(bandMap.entries()).map(([id, entry]) => {
        const roleLabel = entry.roles.size
          ? Array.from(entry.roles).join(" / ")
          : entry.isOwner
          ? "代表者"
          : "担当未設定";
        return {
          id,
          name: entry.name,
          role: roleLabel,
          members: memberCounts.get(id)?.size ?? 0,
          event: entry.event,
        } satisfies BandSummary;
      });

      list.sort((a, b) => {
        const dateA = a.event?.date ?? "";
        const dateB = b.event?.date ?? "";
        return dateA.localeCompare(dateB, "ja");
      });

      setBands(list);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const hasBands = bands.length > 0;

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl pt-12 md:pt-0">
                <Link
                  href="/me/profile"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">マイページ</span>
                </Link>

                <span className="text-xs text-primary tracking-[0.3em] font-mono">MY BANDS</span>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">
                  マイバンド
                </h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  自分が参加しているバンドとイベントを確認できます。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-4">
                {loading ? (
                  <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                    読み込み中...
                  </div>
                ) : !hasBands ? (
                  <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                    所属バンドがありません。
                  </div>
                ) : (
                  bands.map((band) => (
                    <div
                      key={band.id}
                      className="p-4 md:p-6 bg-card/50 border border-border rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Music className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{band.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{band.role}</span>
                              <span className="hidden sm:inline">・</span>
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{band.members}人</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">
                          参加イベント
                        </p>
                        {band.event ? (
                          <Link
                            key={band.event.id}
                            href={`/events/${band.event.id}`}
                            className="group flex items-center justify-between p-3 bg-background/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="w-4 h-4 text-primary shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                  {band.event.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {dateLabel(band.event.date)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant={
                                  band.event.status === "submitted" ? "default" : "outline"
                                }
                                className="text-xs"
                              >
                                {statusLabel(band.event.status)}
                              </Badge>
                              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          </Link>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            イベント情報がありません。
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
