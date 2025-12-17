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
  ArrowLeft,
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

type Event = {
  id: string;
  name: string;
  date: string;
  venue: string | null;
  status: string;
  open_time: string | null;
  start_time: string | null;
  note: string | null;
};

type BandSummary = {
  name: string;
  status: "提出済み" | "未提出";
  songs: number;
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // TODO: Supabase から bands / songs を取得して実データ化する
  const [bands] = useState<BandSummary[]>([
    { name: "The Rockers", status: "提出済み", songs: 4 },
    { name: "Jazz Quartet", status: "提出済み", songs: 5 },
    { name: "Acoustic Duo", status: "未提出", songs: 0 },
    { name: "Pop Stars", status: "提出済み", songs: 3 },
    { name: "Metal Heads", status: "未提出", songs: 0 },
    { name: "Indie Band", status: "提出済み", songs: 4 },
    { name: "Electronic Beats", status: "提出済み", songs: 3 },
    { name: "Folk Friends", status: "未提出", songs: 0 },
  ]);

  useEffect(() => {
    if (!eventId) return;

    (async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, date, venue, status, open_time, start_time, note"
        )
        .eq("id", eventId)
        .maybeSingle();

      if (error) {
        console.error(error);
        setError("イベント情報の取得に失敗しました。");
      } else if (!data) {
        setError("イベントが見つかりませんでした。");
      } else {
        setEvent(data as Event);
      }

      setLoading(false);
    })();
  }, [eventId]);

  const timeRange =
    event?.open_time && event?.start_time
      ? `${event.open_time} - ${event.start_time}`
      : "時間未定";

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-16 md:py-24 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />

            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="pt-12 md:pt-0">
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 md:mb-8"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">イベント一覧に戻る</span>
                </Link>

                {loading ? (
                  <p className="text-sm text-muted-foreground">
                    イベント情報を読み込み中です…
                  </p>
                ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : event ? (
                  <div className="max-w-4xl">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className="text-xs text-primary tracking-[0.3em] font-mono">
                        EVENT DETAIL
                      </span>
                      <Badge variant="default">{event.status}</Badge>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                      {event.name}
                    </h1>
                    {event.note && (
                      <p className="text-muted-foreground text-base md:text-lg max-w-2xl mb-8">
                        {event.note}
                      </p>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                      <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                        <Calendar className="w-5 h-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">
                          開催日
                        </p>
                        <p className="font-medium text-sm md:text-base">
                          {event.date}
                        </p>
                      </div>
                      <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                        <Clock className="w-5 h-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">
                          時間
                        </p>
                        <p className="font-medium text-sm md:text-base">
                          {timeRange}
                        </p>
                      </div>
                      <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                        <MapPin className="w-5 h-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">
                          会場
                        </p>
                        <p className="font-medium text-sm md:text-base">
                          {event.venue ?? "未設定"}
                        </p>
                      </div>
                      <div className="p-3 md:p-4 bg-card/50 border border-border rounded-lg">
                        <FileText className="w-5 h-5 text-primary mb-2" />
                        <p className="text-xs text-muted-foreground mb-1">
                          メモ
                        </p>
                        <p className="font-medium text-xs md:text-sm line-clamp-3">
                          {event.note ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* アクションカード（今はリンクだけ / 将来ここにTT・レパートリーなどを実装） */}
          {event && (
            <section className="py-8 md:py-12">
              <div className="container mx-auto px-4 sm:px-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
                  <Link
                    href={`/events/${event.id}/repertoire/view`}
                    className="group"
                  >
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-primary/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <Music className="w-6 md:w-8 h-6 md:h-8 text-primary mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">
                          レパートリー
                        </h3>
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

                  <Link
                    href={`/events/${event.id}/repertoire/submit`}
                    className="group"
                  >
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-secondary/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <FileText className="w-6 md:w-8 h-6 md:h-8 text-secondary mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">
                          レパートリー提出
                        </h3>
                        <p className="text-xs md:text-sm text-muted-foreground flex-1">
                          自分のバンドの曲を登録
                        </p>
                        <div className="flex items-center gap-2 text-secondary text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>提出する</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>

                  <Link
                    href={`/events/${event.id}/tt/view`}
                    className="group sm:col-span-2 lg:col-span-1"
                  >
                    <div className="relative h-40 md:h-48 p-4 md:p-6 bg-card/50 border border-border rounded-lg hover:border-accent/50 transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                      <div className="relative h-full flex flex-col">
                        <List className="w-6 md:w-8 h-6 md:h-8 text-accent mb-3 md:mb-4" />
                        <h3 className="text-base md:text-lg font-bold mb-2">
                          タイムテーブル
                        </h3>
                        <p className="text-xs md:text-sm text-muted-foreground flex-1">
                          演奏順序と時間割を確認
                        </p>
                        <div className="flex items-center gap-2 text-accent text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>詳しく見る</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* 参加バンド一覧（今はダミー / 後でSupabaseと接続） */}
          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6 md:mb-8">
                  <span className="text-xs text-primary tracking-[0.3em] font-mono">
                    BANDS
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold mt-2">
                    参加バンド一覧
                  </h2>
                </div>

                <Tabs defaultValue="all">
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <TabsList className="mb-6 bg-card/50 border border-border w-max sm:w-auto">
                      <TabsTrigger value="all" className="text-sm">
                        全て ({bands.length})
                      </TabsTrigger>
                      <TabsTrigger value="submitted" className="text-sm">
                        提出済み (
                        {bands.filter((b) => b.status === "提出済み").length})
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="text-sm">
                        未提出 (
                        {bands.filter((b) => b.status === "未提出").length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="all" className="space-y-3">
                    {bands.map((band, index) => (
                      <div
                        key={`${band.name}-${index}`}
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
                            <p className="font-medium text-sm md:text-base truncate">
                              {band.name}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {band.songs > 0 ? `${band.songs}曲` : "未提出"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            band.status === "提出済み" ? "default" : "outline"
                          }
                          className="shrink-0 text-xs"
                        >
                          {band.status}
                        </Badge>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="submitted">
                    <p className="text-muted-foreground text-center py-8">
                      提出済みバンドのみ表示（後でフィルタ実装）
                    </p>
                  </TabsContent>

                  <TabsContent value="pending">
                    <p className="text-muted-foreground text-center py-8">
                      未提出バンドのみ表示（後でフィルタ実装）
                    </p>
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


