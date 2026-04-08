"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  ClipboardList,
  Guitar,
  Home,
  Lightbulb,
  Link2,
  LogOut,
  Menu,
  MessageSquare,
  Music,
  Settings,
  User,
  Users,
  X,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { safeSignOut, supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  THEME_TRANSITION_END_EVENT,
  THEME_TRANSITION_START_EVENT,
} from "@/lib/themeTransition";
import { toast } from "@/lib/toast";

const navItems = [
  { id: "home", href: "/", label: "ホーム", icon: Home },
  { id: "events", href: "/events", label: "イベント", icon: Calendar },
  { id: "band-builder", href: "/bands", label: "バンドを組む", icon: Guitar },
  { id: "pa", href: "/pa", label: "PA", icon: Music },
  { id: "lighting", href: "/lighting", label: "照明", icon: Lightbulb },
  { id: "maintenance", href: "/maintenance", label: "備品管理", icon: ClipboardList },
  { id: "announcements", href: "/announcements", label: "お知らせ", icon: Bell },
  { id: "links", href: "/links", label: "外部リンク集", icon: Link2 },
  { id: "feedback", href: "/feedback", label: "フィードバック", icon: MessageSquare },
  { id: "members", href: "/members", label: "部員一覧", icon: Users },
];

const bottomNavItems = [
  { id: "profile", href: "/me/profile", label: "アカウント", icon: User },
  { id: "bands", href: "/me/bands", label: "マイバンド", icon: Music },
];

const utilityNavItems = bottomNavItems;
const navChromeClass = "border-sky-200/70 dark:border-violet-800/70";
const navDesktopShadowClass =
  "shadow-[0_1px_0_rgba(15,23,42,0.03),8px_0_24px_rgba(15,23,42,0.04)]";
const navFloatingClass =
  "border-sky-200/80 bg-card/95 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-violet-800/80";
const navButtonClass =
  "border-sky-200/80 bg-background/90 text-sky-700 hover:bg-sky-100/40 dark:border-violet-800/80 dark:text-violet-100 dark:hover:bg-violet-500/10";
const navItemActiveClass =
  "border border-sky-300/70 bg-sky-100/35 text-sky-700 dark:border-violet-500/30 dark:bg-violet-500/12 dark:text-violet-100";
const navItemIdleClass =
  "text-sky-700/80 hover:bg-sky-100/40 hover:text-sky-800 dark:text-violet-200/75 dark:hover:bg-violet-500/10 dark:hover:text-violet-100";
const navTooltipClass =
  "border-sky-200/80 bg-card text-sky-800 shadow-lg dark:border-violet-800/80 dark:text-violet-100";
const navAdminActiveClass =
  "border border-sky-300/70 bg-sky-100/50 text-sky-800 shadow-sm dark:border-violet-500/35 dark:bg-violet-500/15 dark:text-violet-50";
const navAdminIdleClass =
  "text-sky-700 hover:bg-sky-100/40 hover:text-sky-800 dark:text-violet-200 dark:hover:bg-violet-500/10 dark:hover:text-violet-50";
const navDividerClass = "border-sky-200/70 dark:border-violet-800/70";
const navToggleHoverClass =
  "border-sky-200/80 text-sky-700 hover:bg-sky-100/40 dark:border-violet-800/80 dark:text-violet-100 dark:hover:bg-violet-500/10";
const navLogoutClass =
  "text-sky-700/80 hover:bg-rose-100 hover:text-rose-700 dark:text-violet-200/75 dark:hover:bg-rose-500/12 dark:hover:text-rose-200";

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
  const previousPathnameRef = useRef<string | null>(null);
  const themeTransitionLockRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessAdmin, isAdmin, loading: roleLoading } = useRoleFlags();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const roleReady = Boolean(userId) && !roleLoading;

  useEffect(() => {
    document.body.dataset.hasSidenav = "1";
    return () => {
      delete document.body.dataset.hasSidenav;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadProfileAvatar = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }

      const nextAvatarUrl = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
      setProfileAvatarUrl(nextAvatarUrl);
    };

    void loadProfileAvatar();

    const handleProfileUpdated = () => {
      void loadProfileAvatar();
    };
    window.addEventListener("profile:updated", handleProfileUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("profile:updated", handleProfileUpdated);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!roleReady) return;
    if (isAdmin) return;
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
  }, [isAdmin, roleReady, userId]);

  const avatarUrl =
    profileAvatarUrl ||
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

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");

    const handleThemeTransitionStart = () => {
      if (!desktopQuery.matches) return;
      themeTransitionLockRef.current = true;
    };

    const handleThemeTransitionEnd = () => {
      if (!themeTransitionLockRef.current) return;
      themeTransitionLockRef.current = false;
      window.requestAnimationFrame(() => {
        updateExpanded(isAsideHovering());
      });
    };

    window.addEventListener(THEME_TRANSITION_START_EVENT, handleThemeTransitionStart);
    window.addEventListener(THEME_TRANSITION_END_EVENT, handleThemeTransitionEnd);

    return () => {
      window.removeEventListener(THEME_TRANSITION_START_EVENT, handleThemeTransitionStart);
      window.removeEventListener(THEME_TRANSITION_END_EVENT, handleThemeTransitionEnd);
    };
  }, []);

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
    if (previousPathnameRef.current === pathname) {
      previousPathnameRef.current = pathname;
      return;
    }
    previousPathnameRef.current = pathname;
    lastRouteChangeRef.current = Date.now();
    const id = window.setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsAccountMenuOpen(false);
    }, 0);
    return () => window.clearTimeout(id);
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
    setIsAccountMenuOpen(false);
    router.replace("/login");
  };

  const handleAccountMenuToggle = () => {
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen((prev) => !prev);
  };

  const handleMobileMenuToggle = () => {
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen((prev) => !prev);
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
        data-theme-sync="1"
        ref={topbarRef}
        className={cn(
          "md:hidden fixed top-0 left-0 right-0 z-[60] flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl",
          navChromeClass
        )}
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
          aria-label="ホームへ戻る"
        >
          <Image
            src="/images/jacla-logo.png"
            alt="Jacla logo"
            width={36}
            height={22}
            className="object-contain"
          />
        </Link>
        <div className="relative flex shrink-0 items-center gap-2" ref={accountMenuRef}>
          <button
            type="button"
            onClick={handleAccountMenuToggle}
            className={cn(
              "rounded-full border p-1 text-foreground transition-all",
              navButtonClass
            )}
            aria-label="アカウントメニューを開く"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
          >
            <Avatar className="h-8 w-8">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={accountLabel} />
              ) : (
                <AvatarFallback className="bg-sky-100/60 text-sky-700 dark:bg-violet-500/15 dark:text-violet-100">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              )}
            </Avatar>
          </button>
          {isAccountMenuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute right-0 top-11 w-44 overflow-hidden rounded-xl border backdrop-blur-xl",
                navFloatingClass
              )}
            >
              <Link
                href="/me/profile"
                onClick={() => setIsAccountMenuOpen(false)}
                className={cn(
                  "block px-4 py-2 text-sm text-sky-700 transition-colors dark:text-violet-100",
                  navToggleHoverClass
                )}
              >
                プロフィール
              </Link>
              <Link
                href="/me/profile/edit"
                onClick={() => setIsAccountMenuOpen(false)}
                className={cn(
                  "block px-4 py-2 text-sm text-sky-700 transition-colors dark:text-violet-100",
                  navToggleHoverClass
                )}
              >
                プロフィール編集
              </Link>
              <div className="px-2 py-2">
                <ThemeToggle
                  variant="ghost"
                  className={cn("h-9 w-full justify-start px-2 text-sm", navToggleHoverClass)}
                />
              </div>
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
            type="button"
            onClick={handleMobileMenuToggle}
            className={cn(
              "rounded-lg border p-2.5 text-foreground transition-all",
              navButtonClass
            )}
            aria-label="メニューを開く"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* モバイル用オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* デスクトップサイドバー */}
      <aside
        data-theme-sync="1"
        ref={asideRef}
        role="navigation"
        aria-label="メインナビゲーション"
        onMouseEnter={() => updateExpanded(true)}
        onMouseLeave={() => {
          if (themeTransitionLockRef.current) return;
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
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-background/96 backdrop-blur-xl transition-all duration-300",
          "hidden md:flex",
          navChromeClass,
          navDesktopShadowClass,
          isExpanded ? "w-64" : "w-20"
        )}
      >
        {/* ロゴ */}
        <div className={cn("px-4 py-3 border-b flex items-center h-16", navDividerClass)}>
          <Link href="/" className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <Image
                src="/images/jacla-logo.png"
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
              <p className="text-sm font-bold whitespace-nowrap text-sky-700 dark:text-violet-100">Jacla</p>
              <p className="text-xs whitespace-nowrap text-sky-600/80 dark:text-violet-200/70">総合音楽部</p>
            </div>
          </Link>
        </div>

        {/* メインナビゲーション */}
        <nav aria-label="メインメニュー" className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
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
                  isActive ? navItemActiveClass : navItemIdleClass
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
                  <div
                    className={cn(
                      "absolute left-full z-50 ml-2 invisible whitespace-nowrap rounded-lg border px-3 py-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100",
                      navTooltipClass
                    )}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 補助ナビゲーション */}
        <div className={cn("py-2 px-3 border-t space-y-2", navDividerClass)}>
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
                    isActive ? navItemActiveClass : navItemIdleClass
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
                    <div
                      className={cn(
                        "absolute left-full z-50 ml-2 invisible whitespace-nowrap rounded-lg border px-3 py-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100",
                        navTooltipClass
                      )}
                    >
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                  )}
                </Link>
              );
            })}

          </div>

          {canAccessAdmin && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                pathname.startsWith("/admin") ? navAdminActiveClass : navAdminIdleClass
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
                <div
                  className={cn(
                    "absolute left-full z-50 ml-2 invisible whitespace-nowrap rounded-lg border px-3 py-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100",
                    navTooltipClass
                  )}
                >
                  <span className="text-sm font-medium">管理</span>
                </div>
              )}
            </Link>
          )}

          <div className="group relative">
            <ThemeToggle
              compact={!isExpanded}
              className={cn(!isExpanded ? "w-full justify-center" : "w-full", navToggleHoverClass)}
            />
            {!isExpanded && (
              <div
                className={cn(
                  "absolute left-full z-50 ml-2 invisible whitespace-nowrap rounded-lg border px-3 py-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100",
                  navTooltipClass
                )}
              >
                <span className="text-sm font-medium">テーマ</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "group relative flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all",
              navLogoutClass
            )}
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
              <div
                className={cn(
                  "absolute left-full z-50 ml-2 invisible whitespace-nowrap rounded-lg border px-3 py-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100",
                  navTooltipClass
                )}
              >
                <span className="text-sm font-medium">ログアウト</span>
              </div>
            )}
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-sky-200/70 dark:bg-violet-800/70" />
      </aside>

      {/* モバイルメニュー */}
      <aside
        data-theme-sync="1"
        className={cn(
          "md:hidden fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl transition-all duration-300",
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}
      >
        <div
          className="p-6 flex items-center justify-center"
          style={{ paddingTop: "calc(var(--mobile-topbar-height, 0px) + 1.5rem)" }}
        >
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex flex-col items-center gap-2">
            <Image
              src="/images/jacla-logo.png"
              alt="Jacla logo"
              width={80}
              height={48}
              className="object-contain"
            />
            <div className="text-center">
              <p className="text-lg font-bold text-sky-700 dark:text-violet-100">Jacla</p>
              <p className="text-xs text-sky-600/80 dark:text-violet-200/70">総合音楽部</p>
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
                    isActive ? navItemActiveClass : navItemIdleClass
                  )}
                >
                  <Icon className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-medium truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div
            className={cn(
              "space-y-1 rounded-xl border bg-surface-secondary/70 p-4",
              navDividerClass
            )}
          >
            <p className="mb-2 text-xs text-sky-600/80 dark:text-violet-200/70">アカウント / 管理</p>
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
                      isActive ? navItemActiveClass : navItemIdleClass
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
                    pathname.startsWith("/admin") ? navAdminActiveClass : navAdminIdleClass
                  )}
                >
                  <Settings className="w-6 h-6 shrink-0" />
                  <span className="text-sm font-medium truncate">管理</span>
                </Link>
              )}
              <ThemeToggle className={cn("col-span-2", navToggleHoverClass)} />
            </div>
          </div>
        </nav>

        <div className="px-8 pb-10 space-y-4">
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-5 py-3 transition-all",
              navLogoutClass
            )}
          >
            <LogOut className="w-6 h-6 shrink-0" />
            <span className="text-base font-medium">ログアウト</span>
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-sky-200/70 dark:bg-violet-800/70" />
      </aside>
    </>
  );
}
