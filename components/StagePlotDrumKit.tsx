"use client";

import { cn } from "@/lib/utils";

type StagePlotDrumKitProps = {
  className?: string;
};

export function StagePlotDrumKit({ className }: StagePlotDrumKitProps) {
  return (
    <svg
      viewBox="0 0 200 150"
      className={cn("w-full h-full text-zinc-600", className)}
      aria-hidden="true"
    >
      <rect x="80" y="55" width="40" height="50" rx="4" className="fill-current opacity-40" />
      <circle cx="70" cy="110" r="16" className="fill-current opacity-60" />
      <circle cx="140" cy="100" r="18" className="fill-current opacity-50" />
      <circle cx="85" cy="45" r="14" className="fill-current opacity-55" />
      <circle cx="115" cy="45" r="14" className="fill-current opacity-55" />
      <circle cx="40" cy="100" r="12" className="fill-current opacity-60" />
      <circle cx="40" cy="40" r="15" className="fill-current opacity-35" />
      <circle cx="160" cy="40" r="15" className="fill-current opacity-35" />
      <circle cx="150" cy="70" r="15" className="fill-current opacity-45" />
      <path
        d="M 90 130 Q 100 140 110 130"
        className="stroke-current opacity-50"
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
}
