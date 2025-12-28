"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  Music,
  Lightbulb,
  Users,
  User,
  LogOut,
  Home,
  Menu,
  X,
  Bell,
  Settings,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabaseClient";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { id: "home", href: "/", label: "ホーム", icon: Home },
  { id: "events", href: "/events", label: "イベント", icon: Calendar },
  { id: "pa", href: "/pa", label: "PA", icon: Music },
  { id: "lighting", href: "/lighting", label: "照明", icon: Lightbulb },
  { id: "maintenance", href: "/maintenance", label: "備品管理", icon: ClipboardList },
  { id: "announcements", href: "/announcements", label: "お知らせ", icon: Bell },
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const { canAccessAdmin } = useRoleFlags();
  const { session } = useAuth();

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

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  };

  useEffect(() => {
    const saved = window.sessionStorage.getItem("sidenavExpanded") === "1";
    setIsExpanded(saved);
  }, []);

  // ルートが変わったらモバイルメニューだけ閉じる
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      const hovering = el.matches(":hover");
      updateExpanded(hovering);
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

      {/* デスクトップ用サイドバー */}
      <aside
        ref={asideRef}
        onMouseEnter={() => updateExpanded(true)}
        onMouseLeave={() => updateExpanded(false)}
        className={cn(
          "fixed left-0 top-0 h-screen bg-card/95 backdrop-blur-xl border-r border-border transition-all duration-300 flex flex-col z-50",
          "hidden md:flex",
          isExpanded ? "w-64" : "w-20"
        )}
      >
        {/* ロゴ */}
        <div className="p-4 border-b border-border flex items-center h-20">
          <Link href="/" className="flex items-center gap-3 w-full">
            <div className="w-12 h-12 flex items-center justify-center shrink-0">
              <Image
                src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
                alt="Jacla logo"
                width={40}
                height={24}
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
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={cn(
                    "flex-1 font-medium text-sm whitespace-nowrap transition-all duration-300",
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

        {/* 下部ナビゲーション */}
        <div className="py-4 px-3 border-t border-border space-y-3">
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
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={cn(
                      "flex-1 font-medium text-sm whitespace-nowrap transition-all duration-300",
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
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative",
                "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-label="テーマを切り替える"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5 dark:hidden" />
                <Sun className="w-5 h-5 hidden dark:block" />
              </div>
              <span
                className={cn(
                  "flex-1 font-medium text-sm whitespace-nowrap transition-all duration-300",
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
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-primary hover:bg-primary/10"
              )}
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <span
                className={cn(
                  "flex-1 font-medium text-sm whitespace-nowrap transition-all duration-300",
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
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all group relative"
          >
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <span
              className={cn(
                "font-medium text-sm whitespace-nowrap transition-all duration-300",
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
                  <Icon className="w-5 h-5 shrink-0" />
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
                    <Icon className="w-5 h-5 shrink-0" />
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
                  <Settings className="w-5 h-5 shrink-0" />
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
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5 dark:hidden" />
                <Sun className="w-5 h-5 hidden dark:block" />
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
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-base font-medium">ログアウト</span>
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/50 via-secondary/30 to-transparent" />
      </aside>
    </>
  );
}
