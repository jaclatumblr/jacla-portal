"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StagePlotPreview } from "@/components/StagePlotPreview";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
  event_type: string;
  venue: string | null;
  open_time: string | null;
  start_time: string | null;
};

type BandRow = {
  id: string;
  name: string;
  event_id: string;
  repertoire_status: string | null;
  general_note: string | null;
  lighting_note: string | null;
  stage_plot_data?: Record<string, unknown> | null;
};

type BandMemberRow = {
  id: string;
  band_id: string;
  instrument: string | null;
  position_x: number | null;
  position_y: number | null;
  is_mc: boolean | null;
  profiles?:
    | { display_name: string | null; real_name: string | null; part: string | null }
    | { display_name: string | null; real_name: string | null; part: string | null }[]
    | null;
};

type StageItem = {
  id: string;
  label: string;
  dashed?: boolean;
  x: number;
  y: number;
};

type StageMember = {
  id: string;
  name: string;
  instrument?: string | null;
  x: number;
  y: number;
  isMc?: boolean;
};

const dateLabel = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

const timeLabel = (start: string | null, end: string | null) => {
  if (!start && !end) return "未設定";
  if (start && end) return `${start} - ${end}`;
  return start ? `${start} -` : `- ${end}`;
};

const clampPercent = (value: number) => Math.min(95, Math.max(5, value));

const parseStageItems = (
  value: Record<string, unknown> | null | undefined
): StageItem[] => {
  const rawItems = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item, index) => {
      const entry = item as {
        id?: string;
        label?: string;
        dashed?: boolean;
        x?: number;
        y?: number;
      };
      if (!entry.label) return null;
      return {
        id: entry.id ?? `stage-${index}`,
        label: entry.label,
        dashed: Boolean(entry.dashed),
        x: clampPercent(Number(entry.x ?? 50)),
        y: clampPercent(Number(entry.y ?? 50)),
      } satisfies StageItem;
    })
    .filter(Boolean) as StageItem[];
};

export default function LightingEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [bandMembers, setBandMembers] = useState<BandMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [eventRes, bandsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, status, event_type, venue, open_time, start_time")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select(
            "id, name, event_id, repertoire_status, general_note, lighting_note, stage_plot_data"
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setEvent(null);
        setError("イベント情報の取得に失敗しました。");
      } else {
        setEvent(eventRes.data as EventRow);
      }

      const bandList = (bandsRes.data ?? []) as BandRow[];
      if (bandsRes.error) {
        console.error(bandsRes.error);
        setBands([]);
        setError((prev) => prev ?? "バンド情報の取得に失敗しました。");
      } else {
        setBands(bandList);
      }

      const bandIds = bandList.map((band) => band.id);
      if (bandIds.length === 0) {
        setBandMembers([]);
      } else {
        const { data: membersData, error: membersError } = await supabase
          .from("band_members")
          .select(
            "id, band_id, instrument, position_x, position_y, is_mc, profiles(display_name, real_name, part)"
          )
          .in("band_id", bandIds)
          .order("created_at", { ascending: true });
        if (membersError) {
          console.error(membersError);
          setBandMembers([]);
          setError((prev) => prev ?? "バンドメンバーの取得に失敗しました。");
        } else {
          setBandMembers((membersData ?? []) as BandMemberRow[]);
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
    setError(null);
  }, [error]);

  const stageItemsByBand = useMemo<Record<string, StageItem[]>>(() => {
    const next: Record<string, StageItem[]> = {};
    bands.forEach((band) => {
      next[band.id] = parseStageItems(band.stage_plot_data);
    });
    return next;
  }, [bands]);

  const bandMembersByBand = useMemo<Record<string, StageMember[]>>(() => {
    const next: Record<string, StageMember[]> = {};
    bandMembers.forEach((row) => {
      const profile = Array.isArray(row.profiles)
        ? row.profiles[0] ?? null
        : row.profiles ?? null;
      const name = profile?.real_name ?? profile?.display_name ?? "名前未登録";
      const instrument = row.instrument ?? profile?.part ?? null;
      if (!next[row.band_id]) next[row.band_id] = [];
      next[row.band_id].push({
        id: row.id,
        name,
        instrument,
        x: clampPercent(Number(row.position_x ?? 50)),
        y: clampPercent(Number(row.position_y ?? 50)),
        isMc: Boolean(row.is_mc),
      });
    });
    return next;
  }, [bandMembers]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Lighting"
            title="照明イベント詳細"
            backHref="/lighting"
            backLabel="照明ダッシュボードへ戻る"
            tone="accent"
            meta={
              event ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {dateLabel(event.date)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {timeLabel(event.open_time, event.start_time)}
                  </span>
                  {event.venue && <span>{event.venue}</span>}
                </div>
              ) : null
            }
          />

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6 max-w-5xl">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  イベント情報を読み込み中です...
                </div>
              ) : bands.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  バンド情報がありません。
                </div>
              ) : (
                bands.map((band) => {
                  const stageItems = stageItemsByBand[band.id] ?? [];
                  const members = bandMembersByBand[band.id] ?? [];
                  const hasStagePlot = stageItems.length > 0 || members.length > 0;
                  return (
                    <Card key={band.id} className="bg-card/60 border-border">
                      <CardHeader className="space-y-1">
                        <CardTitle className="text-lg flex flex-wrap items-center gap-3">
                          {band.name}
                          <Badge
                            variant={
                              band.repertoire_status === "submitted"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {band.repertoire_status === "submitted"
                              ? "提出済み"
                              : "下書き"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="text-xs font-semibold text-primary">共通</div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {band.general_note?.trim() || "未入力"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="text-xs font-semibold text-primary">照明</div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {band.lighting_note?.trim() || "未入力"}
                          </p>
                        </div>
                        <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2">
                          <div className="text-xs font-semibold text-primary">立ち位置</div>
                          {hasStagePlot ? (
                            <StagePlotPreview
                              items={stageItems}
                              members={members}
                              className="mt-2"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              立ち位置は未入力です。
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Link
                            href={`/events/${eventId}/repertoire/view`}
                            className="text-xs text-primary hover:underline"
                          >
                            レパ表一覧を見る
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
