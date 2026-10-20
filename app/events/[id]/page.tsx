"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Guitar,
  List,
  MapPin,
  Music,
  Users,
} from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { formatTimeText } from "@/lib/time";
import { CreateEventBandForm } from "@/app/bands/components/CreateEventBandForm";
import { EventBandList } from "@/app/bands/components/EventBandList";
import { useEventBands } from "@/app/bands/hooks/useEventBands";
import { useProfiles } from "@/app/bands/hooks/useProfiles";
import { formatDate } from "@/app/bands/types";

type Event = {
  id: string;
  name: string;
  date: string;
  event_type: string;
  venue: string | null;
  status: string;
  open_time: string | null;
  start_time: string | null;
  note: string | null;
  tt_is_published: boolean;
};

type BandSummary = {
  id: string;
  name: string;
  status: "submitted" | "pending";
  songs: number;
};

function eventTypeLabel(eventType: string) {
  if (eventType === "live") return "ライブ";
  if (eventType === "workshop") return "講習会";
  if (eventType === "briefing") return "説明会";
  if (eventType === "camp") return "合宿";
  return "その他";
}

function eventStatusLabel(status: string) {
  if (status === "draft") return "下書き";
  if (status === "recruiting") return "募集中";
  if (status === "fixed") return "確定";
  if (status === "closed") return "終了";
  return status;
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = typeof params?.id === "string" ? params.id : "";
  const { isAdmin } = useRoleFlags();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [bands, setBands] = useState<BandSummary[]>([]);

  const {
    events,
    selectedEventId,
    setSelectedEventId,
    selectedEvent,
    eventBands,
    loading: eventBandsLoading,
    refreshEventBands,
  } = useEventBands({ initialEventId: eventId });
  const { subPartsByProfileId, selfPart, getFilteredProfiles } = useProfiles();

  const loadEventData = useCallback(
    async (showLoading = true) => {
      if (!eventId) return;
      if (showLoading) setLoading(true);

      const [eventRes, bandsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, venue, status, event_type, open_time, start_time, note, tt_is_published")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("bands")
          .select("id, name, repertoire_status")
          .eq("event_id", eventId)
          .eq("band_type", "event")
          .order("created_at", { ascending: true }),
      ]);

      if (eventRes.error) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else if (!eventRes.data) {
        toast.error("イベントが見つかりませんでした。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as Event);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        toast.error("バンド情報の取得に失敗しました。");
        setBands([]);
      } else {
        const bandList = (bandsRes.data ?? []) as {
          id: string;
          name: string;
          repertoire_status: string | null;
        }[];
        const bandIds = bandList.map((band) => band.id);
        const counts: Record<string, number> = {};

        if (bandIds.length > 0) {
          const { data: songsData, error: songsError } = await supabase
            .from("songs")
            .select("band_id, entry_type")
            .in("band_id", bandIds);

          if (songsError) {
            console.error(songsError);
            toast.error("セットリストの取得に失敗しました。");
          } else {
            (songsData ?? []).forEach((row) => {
              const entry = row as { band_id: string; entry_type?: string | null };
              if (entry.entry_type === "mc") return;
              counts[entry.band_id] = (counts[entry.band_id] ?? 0) + 1;
            });
          }
        }

        setBands(
          bandList.map((band) => ({
            id: band.id,
            name: band.name,
            status: band.repertoire_status === "submitted" ? "submitted" : "pending",
            songs: counts[band.id] ?? 0,
          }))
        );
      }

      if (showLoading) setLoading(false);
    },
    [eventId]
  );

  useEffect(() => {
    queueMicrotask(() => {
      void loadEventData();
    });
  }, [loadEventData]);

  const canViewTimetable = Boolean(event?.tt_is_published) || isAdmin;
  const canManageBands = event?.event_type === "live" || event?.event_type === "camp";
  const submittedBands = bands.filter((band) => band.status === "submitted");
  const pendingBands = bands.filter((band) => band.status === "pending");

  const openText = formatTimeText(event?.open_time) ?? event?.open_time;
  const startText = formatTimeText(event?.start_time) ?? event?.start_time;
  const timeRange = openText && startText ? `${openText} - ${startText}` : "時間未定";

  const headerTitle = loading ? "イベント情報を読み込み中..." : event?.name ?? "イベント詳細";
  const headerDescription =
    !loading && event?.note ? event.note : "イベントの詳細、バンド編成、レパートリー提出状況を確認できます。";
  const headerMeta = event ? (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">{eventStatusLabel(event.status)}</Badge>
      <Badge variant="outline">{eventTypeLabel(event.event_type)}</Badge>
    </div>
  ) : null;

  const refreshBandArea = async () => {
    await Promise.all([refreshEventBands(), loadEventData(false)]);
  };

  const renderBandList = (list: BandSummary[]) => {
    if (list.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          該当するバンドがありません。
        </p>
      );
    }

    return list.map((band, index) => (
      <div
        key={band.id}
        className="rounded-lg border border-border bg-card/50 p-3 transition-all hover:border-primary/30 hover:bg-card/70 md:p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <span className="hidden w-6 font-mono text-xs text-muted-foreground sm:block">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 md:h-10 md:w-10">
              <Music className="h-4 w-4 text-primary md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => router.push(`/events/${eventId}/repertoire/view?bandId=${band.id}`)}
                className="inline-flex max-w-full items-center gap-1 text-left text-sm font-medium text-foreground transition-colors hover:text-primary md:text-base"
              >
                <span className="truncate">{band.name}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
              <p className="text-xs text-muted-foreground md:text-sm">
                {band.songs > 0 ? `${band.songs}曲` : "曲未登録"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={band.status === "submitted" ? "default" : "outline"} className="text-xs">
              {band.status === "submitted" ? "提出済み" : "未提出"}
            </Badge>
            {canManageBands && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/events/${eventId}/repertoire/submit?bandId=${band.id}`}>
                  レパ表入力
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    ));
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <PageHeader
            kicker="Event Detail"
            title={headerTitle}
            description={headerDescription}
            backHref="/events"
            backLabel="イベント一覧に戻る"
            meta={headerMeta}
            size="lg"
          />

          {!loading && event && (
            <>
              <section className="pb-8 md:pb-12">
                <div className="container mx-auto px-4 sm:px-6">
                  <div className="grid max-w-4xl grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-card/50 p-3 md:p-4">
                      <Calendar className="mb-2 h-5 w-5 text-primary" />
                      <p className="mb-1 text-xs text-muted-foreground">開催日</p>
                      <p className="text-sm font-medium md:text-base">{event.date}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/50 p-3 md:p-4">
                      <Clock className="mb-2 h-5 w-5 text-primary" />
                      <p className="mb-1 text-xs text-muted-foreground">時間</p>
                      <p className="text-sm font-medium md:text-base">{timeRange}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/50 p-3 md:p-4">
                      <MapPin className="mb-2 h-5 w-5 text-primary" />
                      <p className="mb-1 text-xs text-muted-foreground">会場</p>
                      <p className="text-sm font-medium md:text-base">{event.venue ?? "未設定"}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card/50 p-3 md:p-4">
                      <List className="mb-2 h-5 w-5 text-primary" />
                      <p className="mb-1 text-xs text-muted-foreground">イベント種別</p>
                      <p className="text-sm font-medium md:text-base">{eventTypeLabel(event.event_type)}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="py-6 md:py-8">
                <div className="container mx-auto px-4 sm:px-6">
                  <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3 md:gap-6">
                    {canManageBands && (
                      <a href="#event-bands" className="group">
                        <div className="relative h-full min-h-40 rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-primary/50 md:p-6">
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                          <div className="relative flex h-full flex-col">
                            <Guitar className="mb-4 h-7 w-7 text-primary" />
                            <h3 className="mb-2 text-base font-bold md:text-lg">バンドを組む</h3>
                            <p className="flex-1 text-xs text-muted-foreground md:text-sm">
                              このイベント用のバンド作成、参加、メンバー追加を行えます。
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-sm text-primary">
                              <span>作成に進む</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </a>
                    )}

                    {canManageBands && (
                      <Link href={`/events/${event.id}/repertoire/submit`} className="group">
                        <div className="relative h-full min-h-40 rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-secondary/50 md:p-6">
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-secondary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                          <div className="relative flex h-full flex-col">
                            <FileText className="mb-4 h-7 w-7 text-secondary" />
                            <h3 className="mb-2 text-base font-bold md:text-lg">レパ表提出</h3>
                            <p className="flex-1 text-xs text-muted-foreground md:text-sm">
                              参加中のバンドを選んで、曲・メンバー・配置図を入力します。
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-sm text-secondary">
                              <span>入力する</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    )}

                    {canViewTimetable ? (
                      <Link href={`/events/${event.id}/tt/view`} className="group">
                        <div className="relative h-full min-h-40 rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-accent/50 md:p-6">
                          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                          <div className="relative flex h-full flex-col">
                            <List className="mb-4 h-7 w-7 text-accent" />
                            <h3 className="mb-2 text-base font-bold md:text-lg">TT・レパ表</h3>
                            <p className="flex-1 text-xs text-muted-foreground md:text-sm">
                              タイムテーブルと提出済みレパ表をまとめて確認できます。
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-sm text-accent">
                              <span>確認する</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="relative h-full min-h-40 rounded-lg border border-border/60 bg-card/30 p-4 md:p-6">
                        <List className="mb-4 h-7 w-7 text-muted-foreground" />
                        <h3 className="mb-2 text-base font-bold text-muted-foreground md:text-lg">
                          TT・レパ表
                        </h3>
                        <p className="text-xs text-muted-foreground md:text-sm">
                          まだ公開されていません。
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {canManageBands && (
                <section id="event-bands" className="py-8 md:py-12">
                  <div className="container mx-auto px-4 sm:px-6">
                    <div className="mx-auto max-w-6xl space-y-6">
                      <div>
                        <span className="font-mono text-xs tracking-[0.3em] text-primary">BAND BUILDER</span>
                        <h2 className="mt-2 text-xl font-bold md:text-2xl">このイベントのバンドを組む</h2>
                        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                          ここで作成したバンドは、このイベントのレパ表提出やTTにそのまま使われます。
                        </p>
                      </div>

                      <CreateEventBandForm
                        key={`create-${selectedEventId}`}
                        events={events}
                        selectedEventId={selectedEventId}
                        onEventChange={setSelectedEventId}
                        selfPart={selfPart}
                        onCreated={refreshBandArea}
                        showEventSelect={false}
                      />

                      <EventBandList
                        key={`list-${selectedEventId}`}
                        loading={eventBandsLoading}
                        events={events}
                        selectedEventId={selectedEventId}
                        onEventChange={setSelectedEventId}
                        bands={eventBands}
                        eventName={selectedEvent?.name ?? event.name}
                        eventDate={
                          selectedEvent?.date ? formatDate(selectedEvent.date) : formatDate(event.date)
                        }
                        selfPart={selfPart}
                        subPartsByProfileId={subPartsByProfileId}
                        getFilteredProfiles={getFilteredProfiles}
                        onRefresh={refreshBandArea}
                        showEventSelect={false}
                      />
                    </div>
                  </div>
                </section>
              )}

              <section className="py-8 md:py-12">
                <div className="container mx-auto px-4 sm:px-6">
                  <div className="mx-auto max-w-4xl">
                    <div className="mb-6 md:mb-8">
                      <span className="font-mono text-xs tracking-[0.3em] text-primary">REPERTOIRE</span>
                      <h2 className="mt-2 text-xl font-bold md:text-2xl">レパ表状況</h2>
                    </div>

                    <Tabs defaultValue="all">
                      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                        <TabsList className="mb-6 w-max border border-border bg-card/50 sm:w-auto">
                          <TabsTrigger value="all" className="text-sm">
                            すべて ({bands.length})
                          </TabsTrigger>
                          <TabsTrigger value="submitted" className="text-sm">
                            提出済み ({submittedBands.length})
                          </TabsTrigger>
                          <TabsTrigger value="pending" className="text-sm">
                            未提出 ({pendingBands.length})
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="all" className="space-y-3">
                        {renderBandList(bands)}
                      </TabsContent>
                      <TabsContent value="submitted" className="space-y-3">
                        {renderBandList(submittedBands)}
                      </TabsContent>
                      <TabsContent value="pending" className="space-y-3">
                        {renderBandList(pendingBands)}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </section>
            </>
          )}

          {!loading && !event && (
            <section className="py-12">
              <div className="container mx-auto px-4 sm:px-6">
                <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card/60 p-6 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">イベントが見つかりません</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    イベント一覧から対象のイベントを選び直してください。
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/events">イベント一覧へ</Link>
                  </Button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
