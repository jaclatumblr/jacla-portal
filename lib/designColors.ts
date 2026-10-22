export const DESIGN_COLOR_METADATA_KEY = "portal_design_color";
export const colorStorageKey = (userId: string) => `jacla:design:color:${userId}`;

export function normalizeDesignColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

export function resolveDesignColor(accountValue: unknown, cachedValue: unknown): string | null {
  // Explicit null means the account has restored the preset's default colors.
  return accountValue !== undefined ? normalizeDesignColor(accountValue) : normalizeDesignColor(cachedValue);
}

// Generate separate readable accents for light and dark surfaces. Keep this
// self-contained so exactly the same calculation can run before first paint.
export function designColorPalette(hex: string) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (channels: number[]) => channels.reduce((sum, channel, i) => {
    const value = channel / 255;
    return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  const format = (channels: number[]) => `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  const adjust = (dark: boolean) => {
    for (let step = 0; step <= 100; step++) {
      const channels = rgb.map((value) => Math.round(value + ((dark ? 255 : 0) - value) * step / 100));
      const lightness = luminance(channels);
      // Bounds also cover selected surfaces and the brightest dark cards.
      if (dark ? lightness >= 0.52 : lightness <= 0.12) return format(channels);
    }
    return dark ? "#ffffff" : "#000000";
  };
  const tint = (base: number[], amount: number) => format(base.map((value, i) => value + (rgb[i] - value) * amount));
  return {
    light: adjust(false), dark: adjust(true),
    lightBackground: tint([255, 255, 255], .08),
    lightCard: tint([255, 255, 255], .03),
    lightSoft: tint([255, 255, 255], .10),
    lightBorder: tint([210, 210, 216], .20),
    darkBackground: tint([18, 18, 20], .07),
    darkCard: tint([30, 30, 34], .06),
    darkSoft: tint([36, 36, 40], .07),
    darkBorder: tint([69, 69, 74], .18),
  };
}

export function applyDesignColor(color: string | null) {
  const root = document.documentElement;
  if (!color) {
    delete root.dataset.customColor;
    for (const key of Object.keys(designColorPalette("#000000"))) {
      root.style.removeProperty(`--custom-color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    }
    return;
  }
  const palette = designColorPalette(color);
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(`--custom-color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  }
  root.dataset.customColor = color;
}

export const designColorBootstrap = `(()=>{try{const u=localStorage.getItem("jacla:design:active-user");const c=u?localStorage.getItem("jacla:design:color:"+u):null;if(!/^#[0-9a-f]{6}$/i.test(c||""))return;const p=(${designColorPalette.toString()})(c);const r=document.documentElement;for(const[k,v]of Object.entries(p))r.style.setProperty("--custom-color-"+k.replace(/[A-Z]/g,l=>"-"+l.toLowerCase()),v);r.dataset.customColor=c;}catch{}})();`;
