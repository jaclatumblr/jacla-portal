"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  ClipboardList,
  Home,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Music,
  Settings,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { safeSignOut, supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/lib/toast";

const navItems = [
  { id: "home", href: "/", label: "ホーム", icon: Home },
  { id: "events", href: "/events", label: "イベント", icon: Calendar },
  { id: "pa", href: "/pa", label: "PA", icon: Music },
  { id: "lighting", href: "/lighting", label: "照明", icon: Lightbulb },
  { id: "maintenance", href: "/maintenance", label: "備品管理", icon: ClipboardList },
  { id: "announcements", href: "/announcements", label: "お知らせ", icon: Bell },
  { id: "feedback", href: "/feedback", label: "フィードバック", icon: MessageSquare },
  { id: "members", href: "/members", label: "部員一覧", icon: Users },
];

const bottomNavItems = [
  { id: "profile", href: "/me/profile", label: "アカウント", icon: User },
  { id: "bands", href: "/me/bands", label: "マイバンド", icon: Music },
];

const utilityNavItems = bottomNavItems;

export function SideNav() {
  const asideRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string | null>(null);
  const lastRouteChangeRef = useRef(0);
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("sidenavExpanded") === "1";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const { canAccessAdmin, isAdministrator } = useRoleFlags();
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    document.body.dataset.hasSidenav = "1";
    return () => {
      delete document.body.dataset.hasSidenav;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (isAdministrator) return;
    if (typeof window === "undefined") return;
    const storageKey = `crewNoticeShown:${userId}`;
    if (window.sessionStorage.getItem(storageKey)) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("crew")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }

      const crewValue = (data as { crew?: string | null } | null)?.crew ?? "User";
      if (crewValue === "User") {
        toast.info("jobが未設定です。PAか照明を選択してください。");
        window.sessionStorage.setItem(storageKey, "1");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdministrator, userId]);

  const avatarUrl =
    session?.user.user_metadata?.avatar_url ||
    session?.user.user_metadata?.picture ||
    null;
  const accountLabel =
    session?.user.user_metadata?.full_name ||
    session?.user.user_metadata?.name ||
    session?.user.email ||
    "アカウント";

  const updateExpanded = (value: boolean) => {
    setIsExpanded(value);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("sidenavExpanded", value ? "1" : "0");
    }
  };

  const isAsideHovering = () => {
    const el = asideRef.current;
    if (!el) return false;
    return el.matches(":hover");
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 520);
    const isDark = root.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  };

  useLayoutEffect(() => {
    const syncHover = () => {
      const hovering = isAsideHovering();
      updateExpanded(hovering);
    };
    const id = window.setTimeout(syncHover, 220);
    return () => window.clearTimeout(id);
  }, []);

  // ルートが変わったらモバイルメニューだけ閉じる
  useEffect(() => {
    lastRouteChangeRef.current = Date.now();
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      updateExpanded(el.matches(":hover"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  const handleLogout = async () => {
    await safeSignOut();
    setIsMobileMenuOpen(false);
    router.replace("/login");
  };

  useEffect(() => {
    if (isMobileMenuOpen) {
      if (bodyOverflowRef.current === null) {
        bodyOverflowRef.current = document.body.style.overflow;
      }
      document.body.style.overflow = "hidden";
    } else if (bodyOverflowRef.current !== null) {
      document.body.style.overflow = bodyOverflowRef.current || "";
      bodyOverflowRef.current = null;
    }
    return () => {
      if (bodyOverflowRef.current !== null) {
        document.body.style.overflow = bodyOverflowRef.current || "";
        bodyOverflowRef.current = null;
      }
    };
  }, [isMobileMenuOpen]);

  useLayoutEffect(() => {
    document.body.dataset.mobileTopbar = "1";
    const el = topbarRef.current;
    const updateTopbarHeight = () => {
      if (!el) return;
      const height = el.getBoundingClientRect().height;
      document.body.style.setProperty("--mobile-topbar-height", `${height}px`);
    };
    updateTopbarHeight();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && el) {
      resizeObserver = new ResizeObserver(() => updateTopbarHeight());
      resizeObserver.observe(el);
    } else {
      window.addEventListener("resize", updateTopbarHeight);
    }
    return () => {
      delete document.body.dataset.mobileTopbar;
      document.body.style.removeProperty("--mobile-topbar-height");
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", updateTopbarHeight);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isAccountMenuOpen]);

  return (
    <>
      {/* モバイル用トップバー */}
      <div
        ref={topbarRef}
        className="md:hidden fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-4 min-h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-card/95 backdrop-blur-xl border-b border-border"
      >
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          aria-label="ホームへ戻る"
        >
          <Image
            src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
            alt="Jacla logo"
            width={36}
            height={22}
            className="object-contain"
          />
        </Link>
        <div className="relative flex items-center gap-2" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setIsAccountMenuOpen((prev) => !prev)}
            className="p-1 rounded-full border border-border bg-card/90 hover:bg-muted transition-all"
            aria-label="アカウントメニューを開く"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
          >
            <Avatar className="h-8 w-8">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={accountLabel} />
              ) : (
                <AvatarFallback className="bg-muted text-foreground">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              )}
            </Avatar>
          </button>
          {isAccountMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-11 w-44 rounded-lg border border-border bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden"
            >
              <Link
                href="/me/profile"
                onClick={() => setIsAccountMenuOpen(false)}
                className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                プロフィール
              </Link>
              <Link
                href="/me/profile/edit"
                onClick={() => setIsAccountMenuOpen(false)}
                className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                プロフィール編集
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                ログアウト
              </button>
            </div>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 bg-card/90 backdrop-blur-xl border border-border rounded-lg text-foreground hover:bg-muted transition-all"
            aria-label="メニューを開く"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* モバイル用オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* デスクトップサイドバー */}
      <aside
        ref={asideRef}
        onMouseEnter={() => updateExpanded(true)}
        onMouseLeave={() => {
          const now = Date.now();
          const recentRouteChange = now - lastRouteChangeRef.current < 250;
          const scheduleClose = () => {
            if (!isAsideHovering()) {
              updateExpanded(false);
            }
          };
          if (recentRouteChange) {
            window.setTimeout(scheduleClose, 250);
          } else {
            window.requestAnimationFrame(scheduleClose);
          }
        }}
        className={cn(
          "fixed left-0 top-0 h-screen bg-card/95 backdrop-blur-xl border-r border-border transition-all duration-300 flex flex-col z-50",
          "hidden md:flex",
          isExpanded ? "w-64" : "w-20"
        )}
      >
        {/* ロゴ */}
        <div className="px-4 py-3 border-b border-border flex items-center h-16">
          <Link href="/" className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <Image
                src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
                alt="Jacla logo"
                width={36}
                height={22}
                className="object-contain"
              />
            </div>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              )}
            >
              <p className="text-sm font-bold text-foreground whitespace-nowrap">Jacla</p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">総合音楽部</p>
            </div>
          </Link>
        </div>

        {/* メインナビゲーション */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <span
                  className={cn(
                    "flex-1 font-medium text-[13px] whitespace-nowrap transition-all duration-300",
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  )}
                >
                  {item.label}
                </span>
                {!isExpanded && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 補助ナビゲーション */}
        <div className="py-2 px-3 border-t border-border space-y-2">
          <div className="space-y-1">
            {utilityNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={cn(
                      "flex-1 font-medium text-[13px] whitespace-nowrap transition-all duration-300",
                      isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                    )}
                  >
                    {item.label}
                  </span>
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                  )}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label="テーマを切り替える"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <Moon className="w-6 h-6 dark:hidden" />
                <Sun className="w-6 h-6 hidden dark:block" />
              </div>
              <span
                className={cn(
                  "flex-1 font-medium text-[13px] whitespace-nowrap transition-all duration-300",
                  isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                <span className="dark:hidden">ダークモード</span>
                <span className="hidden dark:inline">ライトモード</span>
              </span>
            </button>
          </div>

          {canAccessAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-primary hover:bg-primary/10"
              )}
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <span
                className={cn(
                  "flex-1 font-medium text-[13px] whitespace-nowrap transition-all duration-300",
                  isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                )}
              >
                管理
              </span>
              {!isExpanded && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                  <span className="text-sm font-medium">管理</span>
                </div>
              )}
            </Link>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all group relative"
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <LogOut className="w-6 h-6" />
            </div>
            <span
              className={cn(
                "font-medium text-[13px] whitespace-nowrap transition-all duration-300",
                isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              )}
            >
              ログアウト
            </span>
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                <span className="text-sm font-medium">ログアウト</span>
              </div>
            )}
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/50 via-secondary/30 to-transparent" />
      </aside>

      {/* モバイルメニュー */}
      <aside
        className={cn(
          "md:hidden fixed inset-0 bg-card/98 backdrop-blur-xl z-50 transition-all duration-300 flex flex-col",
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
      >
        <div
          className="p-6 flex items-center justify-center"
          style={{ paddingTop: "calc(var(--mobile-topbar-height, 0px) + 1.5rem)" }}
        >
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center gap-2">
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="Jacla logo"
              width={80}
              height={48}
              className="object-contain"
            />
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">Jacla</p>
              <p className="text-xs text-muted-foreground">総合音楽部</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 flex flex-col px-8 py-6 gap-6 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-1 border border-border rounded-xl p-4 bg-card/70">
            <p className="text-xs text-muted-foreground mb-2">アカウント / 管理</p>
            <div className="grid grid-cols-2 gap-2">
              {utilityNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-6 h-6 shrink-0" />
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  </Link>
                );
              })}

              {canAccessAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    pathname.startsWith("/admin")
                      ? "bg-primary text-primary-foreground"
                      : "text-primary hover:bg-primary/10"
                  )}
                >
                  <Settings className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-medium truncate">管理</span>
                </Link>
              )}
            </div>
          </div>
        </nav>

        <div className="px-8 pb-10 space-y-4">
          <div className="space-y-1 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => {
                toggleTheme();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 px-5 py-3 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all w-full"
              aria-label="テーマを切り替える"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <Moon className="w-6 h-6 dark:hidden" />
                <Sun className="w-6 h-6 hidden dark:block" />
              </div>
              <span className="text-base font-medium">
                <span className="dark:hidden">ダークモード</span>
                <span className="hidden dark:inline">ライトモード</span>
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-5 py-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
          >
            <LogOut className="w-6 h-6 shrink-0" />
            <span className="text-base font-medium">ログアウト</span>
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/50 via-secondary/30 to-transparent" />
      </aside>
    </>
  );
}

