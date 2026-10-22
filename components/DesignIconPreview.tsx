"use client";

import { useContext } from "react";
import { DesignContext } from "@/contexts/DesignPresetContext";
import { Home, Calendar, Music, Settings } from "@/lib/icons";
import type { DesignPreset } from "@/lib/designPresets";

export function DesignIconPreview({ preset }: { preset: DesignPreset }) {
  const context = useContext(DesignContext);
  if (!context) return null;
  return (
    <DesignContext.Provider value={{ ...context, preset }}>
      <div aria-hidden="true" className="mt-3 flex items-center justify-between gap-3">
        <Home className="h-5 w-5" />
        <Calendar className="h-5 w-5" />
        <Music className="h-5 w-5" />
        <Settings className="h-5 w-5" />
      </div>
    </DesignContext.Provider>
  );
}
