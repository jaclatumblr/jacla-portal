export const siteTitle = "jacla Portal";
export const titleTemplate = "%s | jacla Portal";

const exactTitles: Record<string, string> = {
  "/": "ホーム",
  "/home": "ダッシュボード",
  "/login": "ログイン",
  "/members": "部員一覧",
  "/events": "イベント",
  "/announcements": "お知らせ",
  "/pa": "PA",
  "/pa/instructions": "PA指示",
  "/pa/live-adviser": "Live Adviser",
  "/lighting": "照明",
  "/lighting/instructions": "照明指示",
  "/admin": "管理",
  "/admin/roles": "ユーザー管理",
  "/admin/events": "イベント管理",
  "/admin/announcements": "お知らせ管理",
  "/me": "マイページ",
  "/me/profile": "プロフィール",
  "/me/profile/edit": "プロフィール編集",
  "/me/tasks": "タスク",
  "/me/bands": "マイバンド",
  "/terms": "利用規約",
  "/privacy": "プライバシーポリシー",
  "/feedback": "フィードバック",
  "/onboarding": "初回設定",
  "/auth/callback": "ログイン処理中",
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
    if (pathname.includes("/repertoire/submit")) return "レパートリー提出";
    if (pathname.includes("/repertoire/view")) return "レパートリー確認";
    if (pathname.includes("/tt/view")) return "タイムテーブル";
    return "イベント詳細";
  }

  return null;
}
