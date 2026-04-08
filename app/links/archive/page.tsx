import { ExternalLinksPageClient } from "@/components/links/ExternalLinksPageClient";
import { YOUTUBE_ARCHIVE_DEFAULT_CONTENT } from "@/lib/externalLinks";

export default function ArchiveLinksPage() {
  return (
    <ExternalLinksPageClient
      pageId={2}
      defaultContent={YOUTUBE_ARCHIVE_DEFAULT_CONTENT}
      kicker="YouTube Archive"
      introSummary="限定公開の YouTube 動画を、年度ごと・ライブごとに整理して置いておくためのアーカイブページです。"
      introDetail="年度はセクション、各ライブはその中のグループとして追加できるので、ライブ映像が増えても崩れにくい構成です。"
      actions={[
        {
          label: "リンク集へ戻る",
          href: "/links",
          variant: "outline",
          icon: "left",
        },
      ]}
      allowSectionGrouping
    />
  );
}
