"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Music, Users } from "lucide-react";
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
  band_type?: string | null;
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
  const [fixedBands, setFixedBands] = useState<BandSummary[]>([]);
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
        supabase.from("bands").select("id").eq("created_by", userId),
      ]);

      if (cancelled) return;

      if (memberRes.error || createdRes.error) {
        console.error(memberRes.error ?? createdRes.error);
        toast.error("マイバンドの取得に失敗しました。");
        setFixedBands([]);
        setEventBands([]);
        setLoading(false);
        return;
      }

      const memberRows = (memberRes.data ?? []) as BandMemberRow[];
      const createdIds = (createdRes.data ?? []).map((row) => (row as { id: string }).id);
      const bandIds = Array.from(new Set([...memberRows.map((row) => row.band_id), ...createdIds]));

      if (bandIds.length === 0) {
        setFixedBands([]);
        setEventBands([]);
        setLoading(false);
        return;
      }

      const { data: bandsData, error: bandsError } = await supabase
        .from("bands")
        .select("id, name, band_type, event_id, created_by, events(name, date)")
        .in("id", bandIds);

      if (cancelled) return;
      if (bandsError) {
        console.error(bandsError);
        toast.error("バンド情報の取得に失敗しました。");
        setFixedBands([]);
        setEventBands([]);
        setLoading(false);
        return;
      }

      const { data: countsData, error: countsError } = await supabase
        .from("band_members")
        .select("band_id, user_id")
        .in("band_id", bandIds);

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
      const fixedList: BandSummary[] = [];
      const eventList: BandSummary[] = [];

      (bandsData ?? []).forEach((band) => {
        const bandType = band.band_type ?? (band.event_id ? "event" : "fixed");
        const roles = roleMap.get(band.id);
        const roleLabel = roles?.size
          ? Array.from(roles).join(" / ")
          : ownerIds.has(band.id)
          ? "代表"
          : "参加中";
        const summary: BandSummary = {
          id: band.id,
          name: band.name,
          role: roleLabel,
          members: memberCounts.get(band.id)?.size ?? 0,
        };

        if (bandType === "fixed") {
          fixedList.push(summary);
        } else {
          const eventInfo = pickEventInfo(band);
          eventList.push({
            ...summary,
            eventId: band.event_id ?? null,
            eventName: eventInfo?.name ?? null,
            eventDate: eventInfo?.date ?? null,
          });
        }
      });

      fixedList.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      eventList.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));

      setFixedBands(fixedList);
      setEventBands(eventList);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const hasFixedBands = fixedBands.length > 0;
  const hasEventBands = eventBands.length > 0;

  const fixedContent = useMemo(() => {
    if (loading) {
      return (
        <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          読み込み中...
        </div>
      );
    }
    if (!hasFixedBands) {
      return (
        <div className="rounded-lg border border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
          固定バンドがありません。
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {fixedBands.map((band) => (
          <div key={band.id} className="p-4 md:p-5 bg-card/60 border border-border rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm md:text-base truncate">{band.name}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{band.role}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{band.members}人</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [fixedBands, hasFixedBands, loading]);

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
          イベントバンドがありません。
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {eventBands.map((band) => (
          <div key={band.id} className="p-4 md:p-5 bg-card/60 border border-border rounded-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm md:text-base truncate">{band.name}</p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{band.role}</p>
                  {(band.eventName || band.eventDate) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {band.eventName ?? "イベント"} {band.eventDate ? `(${formatDate(band.eventDate)})` : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{band.members}人</span>
                </div>
                {band.eventId && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/events/${band.eventId}/repertoire/submit`}>レパ表へ</Link>
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
            description="所属している固定バンドとイベントバンドを確認できます。"
            actions={
              <Button asChild>
                <Link href="/bands">バンドを組む</Link>
              </Button>
            }
          />

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-5xl mx-auto space-y-10">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg md:text-xl font-bold">固定バンド</h2>
                      <p className="text-sm text-muted-foreground">
                        いつでも活動できるバンドです。
                      </p>
                    </div>
                  </div>
                  {fixedContent}
                </div>

                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold">イベントバンド</h2>
                    <p className="text-sm text-muted-foreground">
                      イベントごとに編成されたバンドです。
                    </p>
                  </div>
                  {eventContent}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
