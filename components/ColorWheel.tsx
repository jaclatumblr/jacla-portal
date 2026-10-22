"use client";

import { useState, type PointerEvent } from "react";
import { hexToHsv, hsvToHex, pointToHue } from "@/lib/colorWheel";

export function ColorWheel({ color, disabled, onChange }: { color: string; disabled: boolean; onChange: (color: string) => void }) {
  const [selection, setSelection] = useState(() => ({ color, ...hexToHsv(color) }));
  let hsv = selection;
  if (selection.color !== color) {
    const incoming = hexToHsv(color);
    hsv = { color, ...incoming, hue: incoming.saturation ? incoming.hue : selection.hue };
    setSelection(hsv);
  }
  const hue = hsv.hue;
  const change = (nextHue: number, saturation: number, brightness: number) => {
    if (disabled) return;
    const next = hsvToHex(nextHue, saturation, brightness);
    // Preserve HSV at black/grayscale, where the HEX value loses information.
    setSelection({ color: next, hue: nextHue, saturation, brightness });
    onChange(next);
  };
  const changeHue = (next: number) => {
    if (disabled) return;
    change(next, hsv.saturation || 100, hsv.brightness || 100);
  };
  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    if (Math.hypot(x, y) < rect.width * .15) return;
    changeHue(pointToHue(x, y));
  };
  const radians = hue * Math.PI / 180;
  return <div className="flex flex-wrap items-center gap-6">
    <div role="slider" aria-label="色相環" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hue) % 360} aria-valuetext={`${Math.round(hue) % 360}度`} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
      className="relative h-52 w-52 shrink-0 touch-none rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      style={{ background: "conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)", opacity: disabled ? .5 : 1, cursor: disabled ? "default" : "crosshair" }}
      onPointerDown={(event) => { if (disabled || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); updatePointer(event); }}
      onPointerMove={(event) => { if (!disabled && event.currentTarget.hasPointerCapture(event.pointerId)) updatePointer(event); }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onKeyDown={(event) => {
        const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
        if (disabled || (!(event.key in steps) && event.key !== "Home" && event.key !== "End")) return;
        event.preventDefault();
        changeHue(event.key === "Home" ? 0 : event.key === "End" ? 359 : (hue + steps[event.key] + 360) % 360);
      }}>
      <div className="pointer-events-none absolute inset-[18%] flex flex-col items-center justify-center rounded-full border border-border bg-card text-sm"><span className="mb-2 h-12 w-12 rounded-full border border-border" style={{ background: color }} /><span className="font-mono text-xs">{color}</span></div>
      <span aria-hidden="true" className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_1px_#0008]" style={{ left: `${50 + 42 * Math.sin(radians)}%`, top: `${50 - 42 * Math.cos(radians)}%`, background: hsvToHex(hue, 100, 100) }} />
    </div>
    <div className="min-w-40 flex-1 space-y-4">
      <p className="text-sm text-muted-foreground">円をドラッグして色相を選択。矢印キーでも調整できます。</p>
      <div><label htmlFor="color-saturation" className="mb-2 flex justify-between text-sm"><span>鮮やかさ</span><span>{Math.round(hsv.saturation)}%</span></label><input id="color-saturation" type="range" min={0} max={100} value={Math.round(hsv.saturation)} disabled={disabled} onChange={(event) => change(hue, Number(event.target.value), hsv.brightness)} className="h-6 w-full accent-primary" /></div>
      <div><label htmlFor="color-brightness" className="mb-2 flex justify-between text-sm"><span>明るさ</span><span>{Math.round(hsv.brightness)}%</span></label><input id="color-brightness" type="range" min={0} max={100} value={Math.round(hsv.brightness)} disabled={disabled} onChange={(event) => change(hue, hsv.saturation, Number(event.target.value))} className="h-6 w-full accent-primary" /></div>
    </div>
  </div>;
}
