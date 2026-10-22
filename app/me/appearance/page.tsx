"use client";

import { SideNav } from "@/components/SideNav";
import { DesignIconPreview } from "@/components/DesignIconPreview";
import { DesignSystemPlayground } from "@/components/DesignSystemPlayground";
import { DesignColorSettings } from "@/components/DesignColorSettings";
import { PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthGuard } from "@/lib/AuthGuard";
import { DESIGN_PRESETS } from "@/lib/designPresets";
import { useDesignPreset } from "@/contexts/DesignPresetContext";

export default function AppearancePage() {
  const { preset, ready, saving, error, setPreset } = useDesignPreset();
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="flex-1 md:ml-20">
          <PageHeader kicker="Theme" title="テーマ変更" description="いつものポータルを、自分の見やすいデザインに。" backHref="/me/profile" backLabel="プロフィールへ" />
          <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 md:py-12">
            <fieldset disabled={!ready || saving} aria-describedby="preset-description preset-status" className="min-w-0 space-y-4">
              <legend className="text-lg font-semibold">テーマを選ぶ</legend>
              <p id="preset-description" className="text-sm text-muted-foreground">選ぶとすぐに切り替わり、アカウントに保存されます。機能は共通で、文字や部品、ナビゲーションの表示が変わります。</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {DESIGN_PRESETS.map((option) => (
                  <label key={option.id} className="design-option group relative block cursor-pointer rounded-xl border border-border bg-card p-4 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring has-[:disabled]:cursor-wait">
                    <input className="sr-only" type="radio" name="design-preset" value={option.id} checked={preset === option.id} onChange={() => void setPreset(option.id)} />
                    <div aria-hidden="true" className="design-option-preview mb-4 overflow-hidden border p-3" style={{ background: option.colors[0], borderColor: "#d8d8df", borderRadius: option.radius }}>
                      <div className="flex gap-2">
                        <div className={`${option.id === "shadcn" || option.id === "radix" ? "w-10" : "w-4"} shrink-0 space-y-2 rounded p-1`} style={{ background: option.colors[1], border: "1px solid #dddddf" }}><div className="h-1 rounded" style={{ background: option.colors[2] }} /><div className="h-1 rounded bg-black/20" /><div className="h-1 rounded bg-black/20" /></div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-2 w-2/3 rounded" style={{ background: option.colors[2] }} />
                          <div className="space-y-2 p-2" style={{ background: option.colors[1], borderRadius: option.radius }}><div className="h-1 w-full bg-black/15" /><div className="h-1 w-3/4 bg-black/10" /><div className="h-4 w-1/2" style={{ background: option.colors[2], borderRadius: option.radius }} /></div>
                        </div>
                      </div>
                      <div style={{ color: option.colors[2] }}><DesignIconPreview preset={option.id} /></div>
                    </div>
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold">{option.name}</span><span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-xs group-has-[:checked]:border-primary group-has-[:checked]:bg-primary group-has-[:checked]:text-primary-foreground">{preset === option.id ? "✓" : ""}</span></div>
                    <p className="mt-1 text-xs font-medium text-primary">{option.detail}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
                  </label>
                ))}
              </div>
              <div id="preset-status" role="status" aria-live="polite" className="min-h-6 text-sm text-muted-foreground">{!ready ? "設定を読み込んでいます..." : saving ? "アカウントに保存しています..." : error ? <span className="text-destructive">{error}</span> : "選択したデザインを使用しています。"}</div>
              {error && <Button type="button" variant="outline" onClick={() => void setPreset(preset)}>選択中のデザインを再保存</Button>}
            </fieldset>
            <DesignColorSettings />
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <Card><CardHeader><CardTitle>明るさ</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">どのプリセットでも、ライト／ダークを切り替えられます。</p><ThemeToggle /></CardContent></Card>
              <Card><CardHeader><CardTitle>このデザインでの表示例</CardTitle></CardHeader><CardContent className="space-y-4">
                <DesignSystemPlayground />
                <Button type="button" variant="outline" onClick={() => void setPreset("original")} disabled={!ready || saving}>Jaclaに戻す</Button>
              </CardContent></Card>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
