import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Music, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";

const myBands = [
  {
    id: "the-rockers",
    name: "The Rockers",
    role: "リードボーカル",
    members: 5,
    events: [{ id: "spring-live-2025", name: "春ライブ 2025", status: "提出済み" }],
  },
  {
    id: "acoustic-duo",
    name: "Acoustic Duo",
    role: "ボーカル・ギター",
    members: 2,
    events: [{ id: "welcome-concert", name: "新歓コンサート", status: "未提出" }],
  },
];

export default function MyBandsPage() {
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
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-2">参加バンド</h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  参加中のバンドとイベント情報を確認できます。
                </p>
              </div>
            </div>
          </section>

          <section className="py-8 md:py-12">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="max-w-4xl mx-auto space-y-4">
                {myBands.map((band) => (
                  <div key={band.id} className="p-4 md:p-6 bg-card/50 border border-border rounded-lg">
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
                      <p className="text-xs text-muted-foreground font-medium">関連イベント</p>
                      {band.events.map((event) => (
                        <Link
                          key={event.id}
                          href="/events"
                          className="group flex items-center justify-between p-3 bg-background/50 border border-border rounded-lg hover:border-primary/50 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {event.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={event.status === "提出済み" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {event.status}
                            </Badge>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}

