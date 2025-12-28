"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type EventRow = {
  id: string;
  name: string;
  date: string;
};

type BandRow = {
  id: string;
  name: string;
  repertoire_status: string | null;
};

type SongRow = {
  id: string;
  band_id: string;
  title: string;
  artist: string | null;
  entry_type: string | null;
  url: string | null;
  order_index: number | null;
  duration_sec: number | null;
  memo: string | null;
  created_at?: string | null;
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export default function RepertoireViewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [songsByBand, setSongsByBand] = useState<Record<string, SongRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedBands, setExpandedBands] = useState<Record<string, boolean>>({});

  const bandIds = useMemo(() => bands.map((band) => band.id), [bands]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const [eventRes, bandsRes] = await Promise.all([
        supabase.from("events").select("id, name, date").eq("id", eventId).maybeSingle(),
        supabase
          .from("bands")
          .select("id, name, repertoire_status")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        toast.error("イベント情報の取得に失敗しました。");
        setEvent(null);
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (bandsRes.error) {
        console.error(bandsRes.error);
        setBands([]);
      } else {
        setBands((bandsRes.data ?? []) as BandRow[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (bandIds.length === 0) {
      setSongsByBand({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, band_id, title, artist, entry_type, url, order_index, duration_sec, memo, created_at")
        .in("band_id", bandIds);
      if (cancelled) return;
      if (error) {
        console.error(error);
        setSongsByBand({});
        return;
      }

      const grouped: Record<string, SongRow[]> = {};
      (data ?? []).forEach((row) => {
        const entry = row as SongRow;
        if (!grouped[entry.band_id]) grouped[entry.band_id] = [];
        grouped[entry.band_id].push(entry);
      });

      Object.values(grouped).forEach((rows) => {
        rows.sort((a, b) => {
          const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        });
      });

      setSongsByBand(grouped);
    })();

    return () => {
      cancelled = true;
    };
  }, [bandIds]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />

        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
                <Link href={`/events/${eventId}`} className="hover:text-primary transition-colors">
                  イベント詳細に戻る
                </Link>
              </div>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">
                  REPERTOIRE
                </span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-3">
                  レパ表一覧
                </h1>
                {event && (
                  <p className="text-muted-foreground text-sm md:text-base">
                    {event.name} / {event.date}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  読み込み中...
                </div>
              ) : bands.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  参加バンドがありません。
                </div>
              ) : (
                <div className="grid gap-6">
                  {bands.map((band) => {
                    const status = band.repertoire_status === "submitted" ? "提出済み" : "下書き";
                    const entries = songsByBand[band.id] ?? [];
                    const isExpanded = expandedBands[band.id] ?? false;
                    return (
                      <Card key={band.id} className="bg-card/60 border-border">
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBands((prev) => ({
                                ...prev,
                                [band.id]: !isExpanded,
                              }))
                            }
                            className="text-left sm:pointer-events-none"
                            aria-expanded={isExpanded}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <CardTitle className="text-lg">{band.name}</CardTitle>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {entries.filter((entry) => entry.entry_type !== "mc").length} 曲
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:hidden">
                                <Badge
                                  variant={status === "提出済み" ? "default" : "secondary"}
                                >
                                  {status}
                                </Badge>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-muted-foreground transition-transform",
                                    isExpanded ? "rotate-180" : ""
                                  )}
                                />
                              </div>
                            </div>
                          </button>
                          <Badge
                            variant={status === "提出済み" ? "default" : "secondary"}
                            className="hidden sm:inline-flex"
                          >
                            {status}
                          </Badge>
                        </CardHeader>
                        <CardContent
                          className={cn(
                            "space-y-3",
                            isExpanded ? "block" : "hidden sm:block"
                          )}
                        >
                          {entries.length === 0 ? (
                            <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                              セットリスト未提出
                            </div>
                          ) : (
                            entries.map((entry, index) => (
                              <div
                                key={entry.id}
                                className="flex flex-col gap-2 rounded-lg border border-border bg-card/70 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
                              >
                                <div className="text-xs text-muted-foreground w-8">
                                  {String(index + 1).padStart(2, "0")}
                                </div>
                                <Badge variant="outline">
                                  {entry.entry_type === "mc" ? "MC" : "曲"}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{entry.title}</div>
                                  {entry.entry_type !== "mc" && entry.artist && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {entry.artist}
                                    </div>
                                  )}
                                </div>
                                {entry.duration_sec != null && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatDuration(entry.duration_sec)}
                                  </div>
                                )}
                                {entry.url && (
                                  <Link
                                    href={entry.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                                  >
                                    URL
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
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
