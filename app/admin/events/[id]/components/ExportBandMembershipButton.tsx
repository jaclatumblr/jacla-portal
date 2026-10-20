"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "@/lib/icons";
import { downloadExcelWorkbook } from "@/lib/exportExcel";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";

type Membership = {
  id: string;
  user_id: string;
  instrument: string | null;
  profiles: { real_name: string | null; display_name: string | null } | null;
  bands: { id: string; name: string };
};

export function ExportBandMembershipButton({
  eventId,
  eventName,
  eventDate,
}: {
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
}) {
  const [exporting, setExporting] = useState(false);
  const inFlight = useRef(false);

  const handleExport = async () => {
    if (!eventId || inFlight.current) return;
    inFlight.current = true;
    setExporting(true);
    try {
      const memberships: Membership[] = [];
      // Paginate to avoid silently truncating larger events at the API row limit.
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("band_members")
          .select("id, user_id, instrument, profiles(real_name, display_name), bands!inner(id, name)")
          .eq("bands.event_id", eventId)
          .eq("bands.band_type", "event")
          .order("id", { ascending: true })
          .range(offset, offset + pageSize - 1)
          .returns<Membership[]>();
        if (error) throw error;
        memberships.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }

      if (memberships.length === 0) {
        toast.info("このイベントには出力する所属メンバーがいません。");
        return;
      }

      const name = (member: Membership) =>
        member.profiles?.real_name?.trim() || member.profiles?.display_name?.trim() || "未設定";
      memberships.sort((a, b) =>
        name(a).localeCompare(name(b), "ja") ||
        a.user_id.localeCompare(b.user_id) ||
        a.bands.name.localeCompare(b.bands.name, "ja")
      );
      const safeEventName = Array.from(eventName || "イベント", (char) =>
        char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? "_" : char
      ).join("").slice(0, 80);
      await downloadExcelWorkbook(`${safeEventName}_バンド所属一覧.xlsx`, [{
        name: "バンド所属一覧",
        headers: ["氏名", "表示名", "所属バンド", "担当パート", "イベント", "開催日"],
        rows: memberships.map((member) => [
          member.profiles?.real_name?.trim() || "未設定",
          member.profiles?.display_name?.trim() || "未設定",
          member.bands.name,
          member.instrument?.trim() || "未設定",
          eventName || "未設定",
          eventDate || "未設定",
        ]),
        colWidths: [24, 24, 36, 20, 36, 16],
        filterable: true,
      }]);
      toast.success("バンド所属一覧をExcelで出力しました。");
    } catch (error) {
      console.error("Failed to export band memberships", error);
      toast.error("所属一覧の出力に失敗しました。時間をおいて再度お試しください。");
    } finally {
      inFlight.current = false;
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" disabled={!eventId || exporting} onClick={handleExport}>
      {exporting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
      {exporting ? "出力中..." : "所属一覧をExcel出力"}
    </Button>
  );
}
