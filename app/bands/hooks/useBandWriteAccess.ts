"use client";

import { useEffect, useState } from "react";
import { useRoleFlags } from "@/lib/useRoleFlags";
import type { EventRow } from "../types";

export function useBandWriteAccess(event: EventRow | null) {
  const { canAccessAdmin, loading } = useRoleFlags();
  const [now, setNow] = useState(() => Date.now());
  const deadline = event?.repertoire_deadline ? Date.parse(event.repertoire_deadline) : NaN;
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    let timer: ReturnType<typeof setTimeout>;
    const updateClock = () => {
      const current = Date.now();
      setNow(current);
      const remaining = deadline - current;
      if (remaining >= 0) timer = setTimeout(updateClock, Math.min(remaining + 1, 2_147_483_647));
    };
    timer = setTimeout(updateClock, 0);
    return () => clearTimeout(timer);
  }, [deadline]);
  const closed = Boolean(event?.repertoire_is_closed) || (Number.isFinite(deadline) && now > deadline);
  const reason = !event ? "イベント情報を確認しています。" : loading ? "権限を確認しています。" : closed && !canAccessAdmin ? "レパ表の受付は終了しました。バンド・メンバーの変更はできません。" : null;
  return { blocked: Boolean(reason), reason };
}
