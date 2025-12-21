"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getPageTitle, siteTitle, titleTemplate } from "@/lib/pageTitles";

export function TitleManager() {
  const pathname = usePathname();

  useEffect(() => {
    const pageTitle = getPageTitle(pathname);
    document.title = pageTitle
      ? titleTemplate.replace("%s", pageTitle)
      : siteTitle;
  }, [pathname]);

  return null;
}
