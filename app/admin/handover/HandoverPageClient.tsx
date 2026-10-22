"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AuthGuard } from "@/lib/AuthGuard";
import { useRoleFlags } from "@/lib/useRoleFlags";
import { SideNav } from "@/components/SideNav";
import { PageHeader } from "@/components/PageHeader";

export function HandoverPageClient({ content }: { content: string }) {
  const { canViewHandover, loading, error } = useRoleFlags();
  const sections = content.split("\n").filter((line) => line.startsWith("## ")).map((line) => line.slice(3).trim());
  const sectionId = (title: string) => `section-${sections.indexOf(title) + 1}`;

  if (loading || !canViewHandover) {
    return (
      <AuthGuard>
        <main className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {loading ? "権限を確認しています..." : error ?? "引き継ぎ書は管理者・PA長・照明長・会計のみ閲覧できます。"}
            </p>
            {!loading && <Link href="/admin" className="text-sm text-primary underline underline-offset-4">管理ダッシュボードに戻る</Link>}
          </div>
        </main>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <SideNav />
        <main className="min-w-0 flex-1 md:ml-20">
          <PageHeader kicker="Admin" title="管理者向け引き継ぎ書" description="日常の管理手順と、担当交代時に確認することをまとめています。" size="lg" />
          <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
            <Link href="/admin" className="text-sm text-primary underline underline-offset-4">管理ダッシュボードに戻る</Link>
            <nav aria-label="引き継ぎ書の目次" className="mt-6 rounded-lg border border-border bg-card/50 p-4 sm:p-6">
              <p className="mb-3 text-sm font-semibold">目次</p>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {sections.map((section) => <li key={section}><a href={`#${sectionId(section)}`} className="text-primary underline underline-offset-4">{section}</a></li>)}
              </ul>
            </nav>
            <article className="mt-6 min-w-0 space-y-5 rounded-lg border border-border bg-card/50 p-4 text-sm leading-7 sm:p-8 [&_h2]:scroll-mt-6 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-3 [&_h2]:pt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:pt-3 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li>p]:my-1 [&_strong]:font-semibold [&_code]:break-words [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_p]:break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: () => null,
                  h2: ({ children }) => <h2 id={sectionId(String(children))}>{children}</h2>,
                  table: ({ children }) => <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[32rem] border-collapse text-left text-sm">{children}</table></div>,
                  th: ({ children }) => <th className="border-b border-border bg-muted/50 px-4 py-3 font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border-b border-border px-4 py-3 align-top last:border-b-0">{children}</td>,
                  a: ({ href, children }) => {
                    // Companion documents remain repository references, not broken website URLs.
                    if (!href || !/^(https?:\/\/|mailto:|\/|#)/.test(href)) {
                      return <span title={`リポジトリ内の資料: ${href ?? ""}`}>{children}（リポジトリ内の資料）</span>;
                    }
                    return <a href={href} className="text-primary underline underline-offset-4">{children}</a>;
                  },
                  code: ({ children }) => {
                    const value = String(children);
                    return /^\/(?:admin|events|me|pa|lighting)(?:\/[^\s]*)?$/.test(value)
                      ? <Link href={value} className="text-primary underline underline-offset-4"><code>{children}</code></Link>
                      : <code>{children}</code>;
                  },
                }}
              >{content}</ReactMarkdown>
            </article>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
