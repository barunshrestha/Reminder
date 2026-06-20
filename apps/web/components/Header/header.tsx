"use client";

import { useEffect, useState } from "react";
import { logout, me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header({
  onMenuClick,
  onSidebarToggle,
  sidebarCollapsed,
}: {
  onMenuClick: () => void;
  onSidebarToggle: () => void;
  sidebarCollapsed: boolean;
}) {
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    me()
      .then((result) => {
        setUserEmail(result.user.email);
        setUserRole(result.user.role);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("color-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextIsDark = stored === "dark" || (stored === null && prefersDark);
    document.documentElement.classList.toggle("dark", nextIsDark);
    setIsDark(nextIsDark);
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("color-theme", next ? "dark" : "light");
  }

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-999 flex w-full border-b border-stroke bg-white shadow-1 dark:border-strokedark dark:bg-boxdark",
        sidebarCollapsed ? "lg:left-0" : "lg:left-72",
      )}
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 md:px-6 2xl:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-sm border border-stroke p-1.5 shadow-sm dark:border-strokedark lg:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={onSidebarToggle}
            className="hidden rounded-sm border border-stroke p-1.5 shadow-sm dark:border-strokedark lg:inline-flex"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "☰" : "←"}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button type="button" variant="outline" size="sm" onClick={toggleTheme}>
            {isDark ? "Light" : "Dark"}
          </Button>
          <div className="hidden max-w-[12rem] truncate text-right md:block">
            <span className="block truncate text-sm font-medium text-black dark:text-white">
              {userEmail || "User"}
            </span>
            <span className="block text-xs text-bodydark2">{userRole || "—"}</span>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void logout().then(() => {
                window.location.href = "/login";
              });
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
