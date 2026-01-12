"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Music,
  FileText,
  List,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { PageHeader } from "@/components/PageHeader";
import { useRoleFlags } from "@/lib/useRoleFlags";

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

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;
  const { canAccessAdmin } = useRoleFlags();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  // TODO: Supabase から bands / songs を取得して実データ化する
  const [bands, setBands] = useState<BandSummary[]>([]);
  const canViewTimetable = Boolean(event?.tt_is_published) || canAccessAdmin;

  useEffect(() => {
    if (!eventId) return;

    (async () => {
      setLoading(true);

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
        let counts: Record<string, number> = {};
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

      setLoading(false);
    })();
  }, [eventId]);

  const timeRange =
    event?.open_time && event?.start_time
      ? `${event.open_time} - ${event.start_time}`
      : "時間未設定";

  const headerTitle = loading ? "イベント情報を読み込み中..." : event?.name ?? "イベント詳細";
  const headerDescription =
    !loading && event?.note ? event.note : "イベントの詳細を確認できます。";
  const headerMeta = event ? (
    <div className="flex items-center gap-3 flex-wrap">
      <Badge variant="default">{event.status}</Badge>
    </div>
  ) : null;

  const eventTypeLabel = (eventType: string) => {
    if (eventType === "live") return "ライブ";
    if (eventType === "workshop") return "講習会";
    if (eventType === "briefing") return "説明会";
    if (eventType === "camp") return "合宿";
    return "その他";
  };

  const canManageBands = event?.event_type === "live" || event?.event_type === "camp";

  const submittedBands = bands.filter((band) => band.status === "submitted");
  const pendingBands = bands.filter((band) => band.status === "pending");

  const renderBandList = (list: BandSummary[]) => {
    if (list.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          該当するバンドがありません。
        </p>
      );
    }
    return list.map((band, index) => (
      <div
        key={band.id}
        className="flex items-center justify-between p-3 md:p-4 bg-card/50 border border-border rounded-lg hover:border-primary/30 transition-all"
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <span className="hidden sm:block text-xs text-muted-foreground font-mono w-6">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm md:text-base truncate">{band.name}</p>
            <p className="text-xs md:text-sm text-muted-foreground">
              {band.songs > 0 ? `${band.songs}曲` : "未提出"}
            </p>
          </div>
        </div>
        <Badge
          variant={band.status === "submitted" ? "default" : "outline"}
          className="shrink-0 text-xs"
        >
          {band.status === "submitted" ? "提出済み" : "未提出"}
        </Badge>
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
            <section className="pb-12 md:pb-16">
              <div className="container mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-4xl">
                  <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                    <Calendar className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">開催日</p>
                    <p className="font-medium text-sm md:text-base">{event.date}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                    <Clock className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">時間</p>
                    <p className="font-medium text-sm md:text-base">{timeRange}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                    <MapPin className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">会場</p>
                    <p className="font-medium text-sm md:text-base">{event.venue ?? "未設定"}</p>
                  </div>
                  <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                    <List className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">イベント種別</p>
                    <p className="font-medium text-sm md:text-base">
                      {eventTypeLabel(event.event_type)}
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                    <FileText className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground mb-1">メモ</p>
                    <p className="font-medium text-xs md:text-sm line-clamp-3">
                      {event.note ?? "未設定"}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {event && (
            <section className="py-8 md:py-12">
              <div className="container mx-auto px-4 sm:px-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
                  <Link href={`/events/${event.id}/repertoire/view`} className="group">
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <Music className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">レパ表一覧</h3>
                        <p className="text-xs md:text-sm text-muted-foreground flex-1">
                          全バンドのセットリストを確認
                        </p>
                        <div className="flex items-center gap-2 text-primary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>詳しく見る</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>

                  {canManageBands && (
                    <Link href={`/events/${event.id}/repertoire/submit`} className="group">
                      <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-secondary/50 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                        <div className="relative h-full flex flex-col">
                          <FileText className="w-6 md:w-8 h-6 md:h-8 text-secondary mb-3 md:mb-4" />
                          <h3 className="text-base md:text-lg font-bold mb-2">レパ表提出</h3>
                          <p className="text-xs md:text-sm text-muted-foreground flex-1">
                            自分のバンドで曲を登録
                          </p>
                          <div className="flex items-center gap-2 text-secondary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>提出する</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {canViewTimetable ? (
                    <Link
                      href={`/events/${event.id}/tt/view`}
                      className="group sm:col-span-2 lg:col-span-1"
                    >
                      <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-accent/50 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                        <div className="relative h-full flex flex-col">
                          <List className="w-6 md:w-8 h-6 md:h-8 text-accent mb-3 md:mb-4" />
                          <h3 className="text-base md:text-lg font-bold mb-2">タイムテーブル</h3>
                          <p className="text-xs md:text-sm text-muted-foreground flex-1">
                            演奏順と時間割を確認
                          </p>
                          <div className="flex items-center gap-2 text-accent text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>詳しく見る</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="sm:col-span-2 lg:col-span-1">
                      <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/30 border border-border/60 rounded-lg">
                        <div className="relative h-full flex flex-col">
                          <List className="w-6 md:w-8 h-6 md:h-8 text-muted-foreground mb-3 md:mb-4" />
                          <h3 className="text-base md:text-lg font-bold mb-2 text-muted-foreground">
                            タイムテーブル
                          </h3>
                          <p className="text-xs md:text-sm text-muted-foreground flex-1">
                            まだ公開されていません
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6 md:mb-8">
                  <span className="text-xs text-primary tracking-[0.3em] font-mono">BANDS</span>
                  <h2 className="text-xl md:text-2xl font-bold mt-2">参加バンド一覧</h2>
                </div>

                <Tabs defaultValue="all">
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <TabsList className="mb-6 bg-card/50 border border-border w-max sm:w-auto">
                      <TabsTrigger value="all" className="text-sm">
                        全て ({bands.length})
                      </TabsTrigger>
                      <TabsTrigger value="submitted" className="text-sm">
                        提出済み ({bands.filter((b) => b.status === "submitted").length})
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="text-sm">
                        未提出 ({bands.filter((b) => b.status === "pending").length})
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
        </main>
      </div>
    </AuthGuard>
  );
}
