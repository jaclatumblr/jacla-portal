import { ExternalLinksPageClient } from "@/components/links/ExternalLinksPageClient";
import { EXTERNAL_LINKS_DEFAULT_CONTENT } from "@/lib/externalLinks";

export default function LinksPage() {
  return (
    <ExternalLinksPageClient
      pageId={1}
      defaultContent={EXTERNAL_LINKS_DEFAULT_CONTENT}
      kicker="External Links"
      introSummary="Jacla の公式 SNS、大学案内、過去アーカイブをまとめたリンク集です。必要に応じて各サイトへそのまま移動できます。"
      introDetail="アーカイブセクションからは、限定公開 YouTube 動画を整理する専用ページにも入れます。"
      actions={[
        {
          label: "大学リンクを見る",
          href: "https://www.teu.ac.jp/student/circle/detail.html?id=57",
          external: true,
          icon: "external",
        },
      ]}
      appendArchiveVideoLibraryLink
    />
  );
}
