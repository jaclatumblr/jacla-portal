"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Music, Users } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";

type EventInfo = {
  name: string | null;
  date: string | null;
};

type BandRow = {
  id: string;
  name: string;
  event_id?: string | null;
  created_by?: string | null;
  events?: EventInfo | EventInfo[] | null;
};

type BandMemberRow = {
  band_id: string;
  instrument: string | null;
};

type BandSummary = {
  id: string;
  name: string;
  role: string;
  members: number;
  eventId?: string | null;
  eventName?: string | null;
  eventDate?: string | null;
};

const pickEventInfo = (band: BandRow): EventInfo | null => {
  const event = Array.isArray(band.events) ? band.events[0] : band.events;
  return event ?? null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function MyBandsPage() {
  const { session } = useAuth();
  const [eventBands, setEventBands] = useState<BandSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const userId = session.user.id;

      const [memberRes, createdRes] = await Promise.all([
        supabase.from("band_members").select("band_id, instrument").eq("user_id", userId),
        supabase
          .from("bands")
          .select("id")
          .eq("created_by", userId)
          .eq("band_type", "event"),
      ]);

      if (cancelled) return;

      if (memberRes.error || createdRes.error) {
        console.error(memberRes.error ?? createdRes.error);
        toast.error("マイバンドの取得に失敗しました。");
        setEventBands([]);
        setLoading(false);
        return;
      }

      const memberRows = (memberRes.data ?? []) as BandMemberRow[];
      const createdIds = (createdRes.data ?? []).map((row) => (row as { id: string }).id);
      const bandIds = Array.from(new Set([...memberRows.map((row) => row.band_id), ...createdIds]));

      if (bandIds.length === 0) {
        setEventBands([]);
        setLoading(false);
        return;
      }

      const { data: bandsData, error: bandsError } = await supabase
        .from("bands")
        .select("id, name, event_id, created_by, events(name, date)")
        .in("id", bandIds)
        .eq("band_type", "event");

      if (cancelled) return;
      if (bandsError) {
        console.error(bandsError);
        toast.error("バンド情報の取得に失敗しました。");
        setEventBands([]);
        setLoading(false);
        return;
      }

      const eventBandIds = (bandsData ?? []).map((band) => band.id);
      const { data: countsData, error: countsError } =
        eventBandIds.length > 0
          ? await supabase.from("band_members").select("band_id, user_id").in("band_id", eventBandIds)
          : { data: [], error: null };

      if (countsError) {
        console.error(countsError);
      }

      const roleMap = new Map<string, Set<string>>();
      memberRows.forEach((row) => {
        if (!row.instrument) return;
        const entry = roleMap.get(row.band_id) ?? new Set<string>();
        entry.add(row.instrument);
        roleMap.set(row.band_id, entry);
      });

      const memberCounts = new Map<string, Set<string>>();
      (countsData ?? []).forEach((row) => {
        const entry = row as { band_id: string; user_id: string };
        const set = memberCounts.get(entry.band_id) ?? new Set<string>();
        set.add(entry.user_id);
        memberCounts.set(entry.band_id, set);
      });

      const ownerIds = new Set(createdIds);
      const eventList = (bandsData ?? []).map((band) => {
        const roles = roleMap.get(band.id);
        const eventInfo = pickEventInfo(band);
        return {
          id: band.id,
          name: band.name,
          role: roles?.size ? Array.from(roles).join(" / ") : ownerIds.has(band.id) ? "代表" : "参加中",
          members: memberCounts.get(band.id)?.size ?? 0,
          eventId: band.event_id ?? null,
          eventName: eventInfo?.name ?? null,
          eventDate: eventInfo?.date ?? null,
        } satisfies BandSummary;
      });

      eventList.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
      setEventBands(eventList);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const hasEventBands = eventBands.length > 0;

  const eventContent = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          読み込み中...
        </div>
      );
    }
    if (!hasEventBands) {
      return (
        <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
          参加中のイベントバンドがありません。
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {eventBands.map((band) => (
          <div key={band.id} className="rounded-lg border border-border bg-card/60 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                  <Music className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold md:text-base">{band.name}</p>
                  <p className="truncate text-xs text-muted-foreground md:text-sm">{band.role}</p>
                  {(band.eventName || band.eventDate) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {band.eventName ?? "イベント"} {band.eventDate ? `(${formatDate(band.eventDate)})` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{band.members}人</span>
                </div>
                {band.eventId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/events/${band.eventId}/repertoire/submit?bandId=${band.id}`}>
                      レパ表へ
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [eventBands, hasEventBands, loading]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="My Bands"
            title="マイバンド"
            description="参加しているイベントバンドを確認できます。"
            actions={
              <Button asChild>
                <Link href="/bands">バンドを組む</Link>
              </Button>
            }
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="mx-auto max-w-5xl space-y-3">
                <div>
                  <h2 className="text-lg font-bold md:text-xl">イベントバンド</h2>
                  <p className="text-sm text-muted-foreground">
                    イベントごとに編成された出演バンドです。
                  </p>
                </div>
                {eventContent}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
