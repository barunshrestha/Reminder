"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function HamburgerButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-stroke bg-white text-black shadow-sm transition hover:bg-gray-3 dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-meta-4",
        className,
      )}
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
