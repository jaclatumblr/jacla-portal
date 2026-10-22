export const DESIGN_PRESETS = [
  { id: "original", name: "Jacla", description: "Jaclaらしい色使いと、やわらかなグラデーション。", detail: "オリジナル", colors: ["#edf2f8", "#fff", "#1685bc"], radius: "12px" },
  { id: "shadcn", name: "Vercel", description: "Geistの書体、モノトーンと細い罫線。整理されたワークスペース。", detail: "Geist Design System", colors: ["#fafafa", "#fff", "#171717"], radius: "6px" },
  { id: "radix", name: "Linear", description: "Interの書体、コンパクトな一覧と固定サイドバー。作業に集中できる表示。", detail: "コンパクトなワークスペース", colors: ["#f7f7f8", "#fff", "#5e6ad2"], radius: "6px" },
  { id: "material", name: "Google", description: "Material 3の文字と丸い選択表示。ラベル付きの広いメニューで、ゆったりした操作感。", detail: "Material Design 3", colors: ["#fef7ff", "#f3edf7", "#6750a4"], radius: "16px" },
] as const;

export type DesignPreset = typeof DESIGN_PRESETS[number]["id"];
export const DESIGN_METADATA_KEY = "portal_design_preset";
export const DESIGN_ACTIVE_USER_KEY = "jacla:design:active-user";
export const designStorageKey = (userId: string) => `jacla:design:user:${userId}`;
export const isDesignPreset = (value: unknown): value is DesignPreset =>
  typeof value === "string" && DESIGN_PRESETS.some((preset) => preset.id === value);

export function resolveDesignPreset(accountValue: unknown, cachedValue: unknown): DesignPreset {
  if (isDesignPreset(accountValue)) return accountValue;
  return isDesignPreset(cachedValue) ? cachedValue : "original";
}

// Apply the cached preference before first paint; no auth tokens are accessed.
export const designPresetBootstrap = `(()=>{try{const u=localStorage.getItem(${JSON.stringify(DESIGN_ACTIVE_USER_KEY)});const p=u?localStorage.getItem(${JSON.stringify(designStorageKey(""))}+u):null;if(${JSON.stringify(DESIGN_PRESETS.map((p) => p.id))}.includes(p))document.documentElement.dataset.design=p;}catch{}})();`;
