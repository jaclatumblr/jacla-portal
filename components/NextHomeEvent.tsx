import Link from "next/link";
import { ArrowRight, Calendar, Clock, Guitar, MapPin, Users } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatTimeText } from "@/lib/time";
import { homeEventStatusLabel, type HomeEventSummary } from "@/lib/homeEvents";

export function NextHomeEvent({ event, loading, error, today, onRetry }: {
  event: HomeEventSummary | null;
  loading: boolean;
  error: string | null;
  today: string;
  onRetry: () => void;
}) {
  const dateLabel = event ? new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${event.date}T00:00:00`)) : "";
  const open = formatTimeText(event?.openTime), start = formatTimeText(event?.startTime);
  return <section aria-labelledby="next-event-heading" className="px-4 pb-6 sm:px-6 md:pb-8">
    <div className="container mx-auto">
      <Card>
        <CardHeader className="pb-3"><h2 id="next-event-heading" className="flex items-center gap-2 text-base font-semibold"><Calendar className="h-5 w-5 text-primary" />{event?.date === today ? "本日のイベント" : "次のイベント"}</h2></CardHeader>
        <CardContent>
          {loading ? <p role="status" className="py-4 text-sm text-muted-foreground">イベントを読み込んでいます…</p>
            : error ? <div role="alert" className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={onRetry}>再読み込み</Button></div>
              : event ? <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-primary">{dateLabel}</p><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{homeEventStatusLabel(event.status)}</span></div>
                  <h3 className="break-words text-xl font-semibold sm:text-2xl"><Link href={`/events/${event.id}`} className="hover:text-primary hover:underline">{event.name}</Link></h3>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" />{[open && `開場 ${open}`, start && `開演 ${start}`].filter(Boolean).join(" ／ ") || "時間未定"}</span><span className="inline-flex min-w-0 items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{event.venue?.trim() || "会場未定"}</span></span></div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild size="sm"><Link href={`/events/${event.id}`}>イベント詳細<ArrowRight /></Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/me/bands"><Guitar />マイバンド</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/me/tasks"><Users />自分のシフト</Link></Button>
                </div>
              </div>
                : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">今後のイベントはまだありません。</p><Button asChild variant="outline" size="sm"><Link href="/events">イベント一覧<ArrowRight /></Link></Button></div>}
        </CardContent>
      </Card>
    </div>
  </section>;
}
