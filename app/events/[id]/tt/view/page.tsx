"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, ChevronDown, Clock, List } from "lucide-react";
import { AuthGuard } from "@/lib/AuthGuard";
import { SideNav } from "@/components/SideNav";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/lib/toast";

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

type SlotRow = {
  id: string;
  event_id: string;
  band_id: string | null;
  slot_type: "band" | "break" | "mc" | "other";
  order_in_event: number | null;
  start_time: string | null;
  end_time: string | null;
  changeover_min: number | null;
  note: string | null;
  bands?: { name: string | null } | { name: string | null }[] | null;
};

const slotLabel = (slot: SlotRow) => {
  if (slot.slot_type === "band") {
    if (Array.isArray(slot.bands)) {
      return slot.bands[0]?.name ?? "バンド未設定";
    }
    return slot.bands?.name ?? "バンド未設定";
  }
  if (slot.slot_type === "break") return "休憩";
  if (slot.slot_type === "mc") return "MC";
  return "その他";
};

const slotBadge = (slot: SlotRow) => {
  if (slot.slot_type === "band") return "default" as const;
  if (slot.slot_type === "break") return "secondary" as const;
  if (slot.slot_type === "mc") return "outline" as const;
  return "outline" as const;
};

const timeLabel = (start: string | null, end: string | null) => {
  if (!start && !end) return "時間未設定";
  if (start && end) return `${start} - ${end}`;
  return start ? `${start} -` : `- ${end}`;
};

export default function EventTimeTablePage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id as string | undefined;

  const [event, setEvent] = useState<EventRow | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const [eventRes, slotsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, date, status, event_type, venue, open_time, start_time")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_slots")
          .select(
            "id, event_id, band_id, slot_type, order_in_event, start_time, end_time, changeover_min, note, bands(name)"
          )
          .eq("event_id", eventId)
          .order("order_in_event", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

      if (cancelled) return;

      if (eventRes.error || !eventRes.data) {
        console.error(eventRes.error);
        setEvent(null);
        setError("イベント情報の取得に失敗しました。");
      } else {
        setEvent(eventRes.data as EventRow);
      }

      if (slotsRes.error) {
        console.error(slotsRes.error);
        setSlots([]);
        setError((prev) => prev ?? "タイムテーブルの取得に失敗しました。");
      } else {
        setSlots((slotsRes.data ?? []) as SlotRow[]);
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

  const orderedSlots = useMemo(() => {
    return [...slots].sort((a, b) => {
      const orderA = a.order_in_event ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order_in_event ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const startA = a.start_time ?? "";
      const startB = b.start_time ?? "";
      return startA.localeCompare(startB);
    });
  }, [slots]);

  const toggleSlot = (slotId: string) => {
    setExpandedSlots((prev) => ({ ...prev, [slotId]: !prev[slotId] }));
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <Link
                href={`/events/${eventId}`}
                className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">イベント詳細へ戻る</span>
              </Link>
              <div className="max-w-4xl mt-6">
                <span className="text-xs text-primary tracking-[0.3em] font-mono">TIMETABLE</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3">タイムテーブル</h1>
                {event && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {event.date}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {timeLabel(event.open_time, event.start_time)}
                    </span>
                    {event.venue && (
                      <span className="flex items-center gap-2">
                        <List className="w-4 h-4" />
                        {event.venue}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="pb-12 md:pb-16">
            <div className="container mx-auto px-4 sm:px-6 space-y-6">
              {loading ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  タイムテーブルを読み込み中...
                </div>
              ) : orderedSlots.length === 0 ? (
                <div className="rounded-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                  タイムテーブルがまだ作成されていません。
                </div>
              ) : (
                <Card className="bg-card/60 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <List className="w-4 h-4 text-primary" />
                      タイムテーブル一覧
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 md:hidden">
                      {orderedSlots.map((slot, index) => {
                        const isExpanded = Boolean(expandedSlots[slot.id]);
                        const detailsId = `slot-details-${slot.id}`;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggleSlot(slot.id)}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            className={`w-full text-left rounded-md border border-border p-3 transition-colors ${
                              isExpanded ? "bg-background/70" : "bg-background/50"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>#{String(index + 1).padStart(2, "0")}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={slotBadge(slot)} className="text-[10px]">
                                  {slot.slot_type.toUpperCase()}
                                </Badge>
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </div>
                            </div>
                            <div className="mt-1 text-sm font-semibold">{slotLabel(slot)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {timeLabel(slot.start_time, slot.end_time)}
                            </div>
                            {isExpanded && (
                              <div id={detailsId} className="mt-2 grid gap-2 text-xs text-muted-foreground">
                                <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                                  <div className="text-[11px] text-foreground">転換</div>
                                  <div>
                                    {slot.changeover_min != null ? `${slot.changeover_min}分` : "-"}
                                  </div>
                                </div>
                                <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1">
                                  <div className="text-[11px] text-foreground">メモ</div>
                                  <div className="whitespace-pre-wrap">{slot.note || "-"}</div>
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="hidden md:block overflow-x-auto rounded-md border border-border bg-background/40">
                      <Table className="min-w-[820px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[52px]">#</TableHead>
                            <TableHead className="w-[140px]">時間</TableHead>
                            <TableHead>内容</TableHead>
                            <TableHead className="w-[120px]">種別</TableHead>
                            <TableHead className="w-[260px]">メモ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderedSlots.map((slot, index) => {
                            const isExpanded = Boolean(expandedSlots[slot.id]);
                            return (
                              <Fragment key={slot.id}>
                                <TableRow
                                  onClick={() => toggleSlot(slot.id)}
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isExpanded}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      toggleSlot(slot.id);
                                    }
                                  }}
                                  className="cursor-pointer hover:bg-muted/30"
                                >
                                  <TableCell className="text-xs text-muted-foreground">
                                    {String(index + 1).padStart(2, "0")}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {timeLabel(slot.start_time, slot.end_time)}
                                  </TableCell>
                                  <TableCell className="text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                      <ChevronDown
                                        className={`w-3 h-3 transition-transform ${
                                          isExpanded ? "rotate-180" : ""
                                        }`}
                                      />
                                      <span>{slotLabel(slot)}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={slotBadge(slot)} className="text-xs">
                                      {slot.slot_type.toUpperCase()}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <span className="line-clamp-1">{slot.note || "-"}</span>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow className="bg-muted/20">
                                    <TableCell colSpan={5} className="text-xs text-muted-foreground">
                                      <div className="grid gap-2 md:grid-cols-[160px,140px,1fr]">
                                        <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1">
                                          <div className="text-[11px] text-foreground">時間</div>
                                          <div>{timeLabel(slot.start_time, slot.end_time)}</div>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1">
                                          <div className="text-[11px] text-foreground">転換</div>
                                          <div>
                                            {slot.changeover_min != null ? `${slot.changeover_min}分` : "-"}
                                          </div>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-background/50 px-2 py-1">
                                          <div className="text-[11px] text-foreground">メモ</div>
                                          <div className="whitespace-pre-wrap">{slot.note || "-"}</div>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
