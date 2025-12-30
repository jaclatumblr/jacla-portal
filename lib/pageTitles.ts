export const siteTitle = "Jacla Portal";
export const titleTemplate = "%s | Jacla Portal";

const exactTitles: Record<string, string> = {
  "/": "ホーム",
  "/home": "ダッシュボード",
  "/login": "ログイン",
  "/members": "部員一覧",
  "/events": "イベント",
  "/announcements": "お知らせ",
  "/maintenance": "備品管理",
  "/maintenance/equipment": "備品管理",
  "/maintenance/instruments": "楽器管理",
  "/pa": "PA",
  "/pa/instructions": "PA指示",
  "/pa/live-adviser": "Live Adviser",
  "/pa/equipment": "PA機材",
  "/lighting": "照明",
  "/lighting/instructions": "照明指示",
  "/lighting/equipment": "照明機材",
  "/admin": "管理",
  "/admin/roles": "ユーザー管理",
  "/admin/events": "イベント管理",
  "/admin/announcements": "お知らせ管理",
  "/admin/feedback": "フィードバック",
  "/me": "マイページ",
  "/me/profile": "プロフィール",
  "/me/profile/edit": "プロフィール編集",
  "/me/tasks": "タスク",
  "/me/bands": "マイバンド",
  "/terms": "利用規約",
  "/privacy": "プライバシーポリシー",
  "/feedback": "フィードバック",
  "/onboarding": "初回設定",
  "/auth/callback": "ログイン処理",
  "/debug-auth": "認証デバッグ",
};

export function getPageTitle(pathname: string): string | null {
  if (exactTitles[pathname]) return exactTitles[pathname];

  if (pathname.startsWith("/announcements/")) {
    return "お知らせ詳細";
  }

  if (pathname.startsWith("/admin/events/")) {
    return "イベント管理詳細";
  }

  if (pathname.startsWith("/pa/events/")) {
    return "PAイベント詳細";
  }

  if (pathname.startsWith("/lighting/events/")) {
    return "照明イベント詳細";
  }

  if (pathname.startsWith("/events/")) {
    if (pathname.includes("/repertoire/submit")) return "レパ表提出";
    if (pathname.includes("/repertoire/view")) return "レパ表一覧";
    if (pathname.includes("/tt/view")) return "タイムテーブル";
    return "イベント詳細";
  }

  return null;
}
