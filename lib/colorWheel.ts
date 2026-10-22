export function hexToHsv(hex: string) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return { hue: (hue * 60 + 360) % 360, saturation: max ? delta / max * 100 : 0, brightness: max * 100 };
}

export function hsvToHex(hue: number, saturation: number, brightness: number) {
  const h = ((hue % 360) + 360) % 360 / 60;
  const s = Math.min(100, Math.max(0, saturation)) / 100;
  const v = Math.min(100, Math.max(0, brightness)) / 100;
  const chroma = v * s, x = chroma * (1 - Math.abs(h % 2 - 1)), m = v - chroma;
  const channels = h < 1 ? [chroma, x, 0] : h < 2 ? [x, chroma, 0] : h < 3 ? [0, chroma, x] : h < 4 ? [0, x, chroma] : h < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${channels.map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

// Hue zero is at the top, matching CSS conic-gradient's default angle.
export function pointToHue(x: number, y: number) {
  return (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
}
