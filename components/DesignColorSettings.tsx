"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useDesignColor } from "@/contexts/DesignColorContext";
import { designColorPalette, normalizeDesignColor } from "@/lib/designColors";
import { ColorWheel } from "@/components/ColorWheel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  ["ブルー", "#2563eb"], ["パープル", "#7c3aed"], ["ピンク", "#db2777"],
  ["レッド", "#dc2626"], ["オレンジ", "#ea580c"], ["グリーン", "#16a34a"],
  ["ティール", "#0d9488"], ["グレー", "#52525b"],
];

function ColorEditor({ initialColor }: { initialColor: string | null }) {
  const { ready, saving, error, saveColor } = useDesignColor();
  const [draft, setDraft] = useState(initialColor ?? "#2563eb");
  const { resolvedTheme } = useTheme();
  const color = normalizeDesignColor(draft);
  const palette = color ? designColorPalette(color) : null;
  const dark = resolvedTheme === "dark";
  const preview = palette ? {
    background: dark ? palette.darkBackground : palette.lightBackground,
    card: dark ? palette.darkCard : palette.lightCard,
    soft: dark ? palette.darkSoft : palette.lightSoft,
    border: dark ? palette.darkBorder : palette.lightBorder,
    accent: dark ? palette.dark : palette.light,
    text: dark ? "#eeeeee" : "#222222",
    onAccent: dark ? "#141414" : "#ffffff",
  } : null;
  const invalid = !color;
  return (
    <fieldset disabled={!ready || saving} className="min-w-0 space-y-4" aria-describedby="color-description color-status">
      <legend className="sr-only">アクセントカラーの設定</legend>
      <p id="color-description" className="text-sm text-muted-foreground">色相環やカラーコードで好きな色を選べます。ボタン・リンクに加え、背景やカードにも淡く色が付きます。プレビューを確認して保存すると、すべてのテーマに適用します。</p>
      <ColorWheel color={color ?? "#2563eb"} disabled={!ready || saving} onChange={setDraft} />
      <div className="flex flex-wrap gap-3" role="group" aria-label="おすすめの色">
        {COLORS.map(([name, hex]) => <button key={hex} type="button" aria-label={name} aria-pressed={color === hex} onClick={() => setDraft(hex)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" style={{ backgroundColor: hex, color: "#fff" }}>{color === hex && <span aria-hidden="true">✓</span>}</button>)}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2"><label htmlFor="design-color-picker" className="block text-sm font-medium">好きな色を選ぶ</label><input id="design-color-picker" type="color" value={color ?? "#2563eb"} onChange={(event) => setDraft(event.target.value)} className="h-11 w-20 cursor-pointer rounded border border-input bg-card p-1" /></div>
        <div className="space-y-2"><label htmlFor="design-color-hex" className="block text-sm font-medium">HEXカラー</label><input id="design-color-hex" type="text" value={draft} onChange={(event) => setDraft(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? "color-hex-error" : undefined} maxLength={7} spellCheck={false} autoCapitalize="off" placeholder="#2563eb" className="h-11 w-36 rounded border border-input bg-card px-3 font-mono text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
      </div>
      {invalid && <p id="color-hex-error" className="text-sm text-destructive">#から始まる6桁の色コードを入力してください。</p>}
      {preview && <div className="space-y-2">
        <p className="text-sm font-medium">配色プレビュー<span className="ml-2 text-xs font-normal text-muted-foreground">保存前に確認できます</span></p>
        <div className="overflow-hidden rounded-xl border" style={{ background: preview.background, borderColor: preview.border, color: preview.text }}>
          <div className="flex min-h-56">
            <div className="hidden w-32 shrink-0 space-y-3 border-r p-3 sm:block" style={{ borderColor: preview.border }} aria-hidden="true"><p className="mb-5 text-sm font-semibold">Jacla</p><div className="rounded-lg p-2 text-xs font-medium" style={{ background: preview.soft, color: preview.accent }}>ホーム</div><div className="p-2 text-xs">イベント</div><div className="p-2 text-xs">お知らせ</div></div>
            <div className="min-w-0 flex-1 space-y-4 p-5"><div><p className="text-xs" style={{ color: preview.accent }}>YOUR PORTAL</p><p className="mt-1 text-lg font-semibold">自分らしいカラーで。</p></div><div className="space-y-3 border p-4" style={{ background: preview.card, borderColor: preview.border, borderRadius: "var(--design-card-radius, 12px)" }}><p className="text-sm font-medium">次のイベント</p><p className="text-xs">背景・カード・ボタンの配色を確認</p><span className="inline-flex px-4 py-2 text-xs font-medium" style={{ background: preview.accent, color: preview.onAccent, borderRadius: "var(--design-control-radius, 8px)" }}>イベントを見る</span></div></div>
          </div>
        </div>
      </div>}
      <div className="flex flex-wrap gap-3"><Button type="button" disabled={invalid} onClick={() => color && void saveColor(color)}>この色を保存</Button><Button type="button" variant="outline" onClick={() => void saveColor(null)}>テーマ標準の色に戻す</Button></div>
      <p id="color-status" role="status" aria-live="polite" className={`min-h-6 text-sm ${error ? "text-destructive" : "text-muted-foreground"}`}>{!ready ? "設定を読み込んでいます…" : saving ? "色を保存しています…" : error ?? (initialColor ? "カスタムカラーを使用中です。" : "テーマ標準の色を使用中です。")}</p>
      {error && <Button type="button" variant="outline" onClick={() => void saveColor(initialColor)}>現在の色を再保存</Button>}
    </fieldset>
  );
}

export function DesignColorSettings() {
  const { color, ready } = useDesignColor();
  return <Card><CardHeader><CardTitle>テーマの色</CardTitle></CardHeader><CardContent><ColorEditor key={`${ready}:${color ?? "default"}`} initialColor={color} /></CardContent></Card>;
}
