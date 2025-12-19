"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
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

const navItems = [
  { id: "home", href: "/", label: "ホーム", icon: Home },
  { id: "events", href: "/events", label: "イベント", icon: Calendar },
  { id: "pa", href: "/pa", label: "PA機材", icon: Music },
  { id: "lighting", href: "/lighting", label: "照明", icon: Lightbulb },
  { id: "announcements", href: "/announcements", label: "お知らせ", icon: Bell },
  { id: "members", href: "/members", label: "部員一覧", icon: Users },
];

const bottomNavItems = [
  { id: "profile", href: "/me/profile", label: "アカウント", icon: User },
  { id: "bands", href: "/me/bands", label: "マイバンド", icon: Music },
];
const utilityNavItems = bottomNavItems;

const currentUser = {
  // TODO: 認証ロジックとつないで admin 判定を行う
  isAdmin: true,
};

export function SideNav() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
    router.replace("/login");
  };

  return (
    <>
      {/* モバイル用ハンバーガーボタン */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-[60] p-3 bg-card/90 backdrop-blur-xl border border-border rounded-lg text-foreground hover:bg-muted transition-all"
        aria-label="メニューを開く"
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* モバイル用オーバーレイ */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* デスクトップ用サイドバー */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
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
                alt="jacla logo"
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
              <p className="text-sm font-bold text-foreground whitespace-nowrap">
                jacla
              </p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                総合音楽部
              </p>
            </div>
          </Link>
        </div>

        {/* メインナビゲーション */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

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
                    <span className="text-sm font-medium text-foreground">
                      {item.label}
                    </span>
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
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

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
                      <span className="text-sm font-medium text-foreground">
                        {item.label}
                      </span>
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
              {!isExpanded && (
                <div className="absolute left-full ml-2 px-3 py-2 bg-card border border-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
                  <span className="text-sm font-medium text-foreground">
                    <span className="dark:hidden">ダークモード</span>
                    <span className="hidden dark:inline">ライトモード</span>
                  </span>
                </div>
              )}
            </button>
          </div>

          {currentUser.isAdmin && (
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
                  <span className="text-sm font-medium text-foreground">
                    管理
                  </span>
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

      {/* モバイル用サイドバー */}
      <aside
        className={cn(
          "md:hidden fixed inset-0 bg-card/98 backdrop-blur-xl z-50 transition-all duration-300 flex flex-col",
          isMobileMenuOpen
            ? "opacity-100 visible"
            : "opacity-0 invisible pointer-events-none"
        )}
      >
        <div className="p-6 pt-12 flex items-center justify-center">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex flex-col items-center gap-2"
          >
            <Image
              src="/images/e3-83-ad-e3-82-b42-20-281-29.png"
              alt="jacla logo"
              width={80}
              height={48}
              className="object-contain"
            />
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">jacla</p>
              <p className="text-xs text-muted-foreground">総合音楽部</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 flex flex-col justify-center px-8 py-4 gap-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-base font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="px-8 pb-8 space-y-2">
          <div className="space-y-1">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-base font-medium">{item.label}</span>
                </Link>
              );
            })}

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

          {currentUser.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-4 px-6 py-4 rounded-lg transition-all duration-200",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-primary hover:bg-primary/10"
              )}
            >
              <Settings className="w-6 h-6 shrink-0" />
              <span className="text-lg font-medium">管理</span>
            </Link>
          )}

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
