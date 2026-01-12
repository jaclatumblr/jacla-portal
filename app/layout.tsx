import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryProvider } from "@/components/QueryProvider";
import { PageTransition } from "@/components/PageTransition";
import { TitleManager } from "@/components/TitleManager";
import { ToastViewport } from "@/components/ToastViewport";
import { PageViewTracker } from "@/components/PageViewTracker";
import { siteTitle, titleTemplate } from "@/lib/pageTitles";

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: titleTemplate,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <TitleManager />
              <PageViewTracker />
              <div className="min-h-screen flex flex-col">
                {/* スキップリンク（キーボードナビゲーション用） */}
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
                >
                  メインコンテンツへスキップ
                </a>
                <PageTransition>
                  <div id="main-content">{children}</div>
                </PageTransition>
                <footer className="app-footer border-t border-border bg-background/80 print:hidden">
                  <div className="container mx-auto px-4 py-6 sm:px-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/images/jacla-logo.png"
                          alt="Jacla logo"
                          width={60}
                          height={36}
                          className="h-8 w-auto object-contain"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">総合音楽部 Jacla</p>
                          <p className="text-xs text-muted-foreground">部員ポータル</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:items-end">
                        <div className="flex gap-4">
                          <Link href="/terms" className="hover:text-foreground">
                            利用規約
                          </Link>
                          <Link href="/privacy" className="hover:text-foreground">
                            プライバシーポリシー
                          </Link>
                          <Link href="/updates" className="hover:text-foreground">
                            更新履歴
                          </Link>
                          <Link href="/feedback" className="hover:text-foreground">
                            フィードバック
                          </Link>
                        </div>
                        <span>© 2026 Tokyo University of Technology - 総合音楽部 Jacla All rights reserved.</span>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
              <ToastViewport />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
