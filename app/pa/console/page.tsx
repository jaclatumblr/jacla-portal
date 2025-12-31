import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { SideNav } from "@/components/SideNav";
import { AuthGuard } from "@/lib/AuthGuard";
import { cn } from "@/lib/utils";

const channelColors = [
  "bg-white/40",
  "bg-white/40",
  "bg-white/40",
  "bg-white/40",
  "bg-white/40",
];

const channelLabels = [
  "Top L",
  "Top R",
  "F.Tom",
  "L.Tom",
  "H.Tom",
  "B.Dr",
  "S.Dr Top",
  "S.Dr Bottom",
  "H.H",
  "予備",
  "Bass (DI)",
  "管1",
  "管2",
  "LINE1",
  "LINE2",
  "LINE3",
  "LINE4",
  "Gt1",
  "Gt2",
  "Perc.",
  "MC1",
  "MC2",
  "予備",
  "予備",
  "TB",
];

const channels = channelLabels.map((label, index) => ({
  id: index + 1,
  label,
  accent: channelColors[index % channelColors.length],
}));

const knobLabels = ["GAIN", "TRIM", "PAN", "AUX 1", "AUX 2", "FX", "COMP", "GATE"];

type KnobProps = {
  label: string;
  accent?: string;
  size?: "sm" | "md";
};

const Knob = ({ label, accent, size = "md" }: KnobProps) => {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative rounded-full bg-gradient-to-b from-white/25 to-black/50 border border-white/10 shadow-inner",
          sizeClass
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1/2 -translate-x-1/2 h-3 w-1 rounded-full bg-white/80",
            accent ? "shadow-[0_0_8px_rgba(255,255,255,0.3)]" : ""
          )}
        />
        {accent && (
          <span
            className={cn(
              "absolute inset-1 rounded-full opacity-70 blur-[1px]",
              accent
            )}
          />
        )}
      </div>
      <span className="text-[8px] uppercase tracking-[0.22em] text-white/60">
        {label}
      </span>
    </div>
  );
};

type ChannelStripProps = {
  label: string;
  accent: string;
};

const ChannelStrip = ({ label, accent }: ChannelStripProps) => (
  <div className="min-w-0 flex flex-col items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-3">
    <div className="text-[9px] leading-tight text-center text-white/60 min-h-[28px]">
      {label}
    </div>
    <div className="flex items-center gap-1">
      <span className={cn("h-2 w-2 rounded-full", accent)} />
      <span className="text-[8px] text-white/40">SIG</span>
    </div>
    <Knob label="PAN" accent={accent} size="sm" />
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-3 rounded-full bg-white/15" />
      <span className="h-1.5 w-3 rounded-full bg-white/15" />
    </div>
    <div className="relative h-24 w-2 rounded-full bg-white/10">
      <div className="absolute bottom-[42%] left-1/2 -translate-x-1/2 h-3 w-6 rounded-md bg-white/80 shadow-lg" />
    </div>
    <div className="text-[8px] text-white/40">-INF</div>
  </div>
);

export default function PAConsolePage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <section className="relative py-12 md:py-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6">
              <div className="max-w-5xl pt-10 md:pt-0 space-y-3">
                <Link
                  href="/pa"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm">PAダッシュボードへ戻る</span>
                </Link>
                <div>
                  <span className="text-xs text-white/60 tracking-[0.3em] font-mono">
                    PA CONSOLE
                  </span>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3">
                    疑似PAコンソール
                  </h1>
                  <p className="text-muted-foreground text-base md:text-lg mt-3">
                    見た目だけのイメージ表示です。PAセクションの雰囲気を共有するためのビジュアルです。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="pb-14">
            <div className="container mx-auto px-4 sm:px-6">
              <div className="rounded-[28px] border border-white/10 bg-[#0b0d12] text-white shadow-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-white/40 to-white/10 flex items-center justify-center shadow-lg">
                      <SlidersHorizontal className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold tracking-[0.2em] text-white/80">
                        JACLA STAGE MIX
                      </p>
                      <p className="text-xs text-white/40">VIRTUAL PA CONSOLE</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    <span className="text-xs text-white/50">ONLINE</span>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_2fr_1fr] px-6 py-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/50 tracking-[0.28em]">INPUT</p>
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {knobLabels.map((label, index) => (
                        <Knob
                          key={label}
                          label={label}
                          accent={index % 2 === 0 ? "bg-white/30" : undefined}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101726] via-[#0f1320] to-[#0c1018] p-4">
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>EQ / DYNAMICS</span>
                      <span className="text-white/70">ACTIVE</span>
                    </div>
                    <div className="mt-3 relative h-28 rounded-xl border border-white/10 bg-[#0b1420] overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_55%)]" />
                      <div className="absolute inset-0 bg-[linear-gradient(transparent_60%,rgba(255,255,255,0.1))]" />
                      <div className="absolute inset-0 flex items-end justify-between px-6 pb-4">
                        <span className="text-[10px] text-white/40">LF</span>
                        <span className="text-[10px] text-white/40">LMF</span>
                        <span className="text-[10px] text-white/40">HMF</span>
                        <span className="text-[10px] text-white/40">HF</span>
                      </div>
                      <div className="absolute bottom-4 left-6 right-6 h-8">
                        <div className="h-full w-full rounded-full border border-white/10 bg-gradient-to-r from-white/25 via-white/15 to-white/25" />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {["LOW", "LOW MID", "HIGH MID", "HIGH"].map((label) => (
                        <Knob key={label} label={label} size="sm" />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>MASTER</span>
                      <span className="text-white/60">L / R</span>
                    </div>
                    <div className="flex items-end gap-3 h-32">
                      {[1, 2].map((meter) => (
                        <div key={meter} className="flex flex-col items-center gap-2">
                          <div className="relative h-24 w-5 rounded-full bg-white/10 overflow-hidden">
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/40 via-white/25 to-white/10" />
                          </div>
                          <span className="text-[10px] text-white/40">0 dB</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/40">
                      <span>OUTPUT</span>
                      <span>READY</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/10 px-4 pb-6 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-white/50 tracking-[0.3em]">
                      CHANNEL STRIPS
                    </p>
                    <span className="text-xs text-white/40">25CH</span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid gap-2 min-w-[900px] md:min-w-0 grid-cols-[repeat(25,minmax(0,1fr))] pb-2">
                      {channels.map((channel) => (
                        <ChannelStrip
                          key={channel.id}
                          label={channel.label}
                          accent={channel.accent}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
