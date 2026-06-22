"use client";

import { useEffect, useState } from "react";
import { logout, me } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { HamburgerButton } from "@/components/ui/hamburger-button";
import { cn } from "@/lib/utils";

export function Header({
  sidebarVisible,
  onToggleSidebar,
}: {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
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
        "fixed top-0 z-999 border-b border-stroke bg-white shadow-1 dark:border-strokedark dark:bg-boxdark",
        sidebarVisible ? "left-0 right-0 lg:left-72" : "left-0 right-0",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 2xl:px-10">
        <HamburgerButton
          onClick={onToggleSidebar}
          label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        />

        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={toggleTheme}
          >
            {isDark ? "Light" : "Dark"}
          </Button>
          <div className="hidden max-w-[10rem] truncate text-right sm:block md:max-w-[12rem]">
            <span className="block truncate text-sm font-medium text-black dark:text-white">
              {userEmail || "User"}
            </span>
            <span className="block text-xs text-bodydark2">{userRole || "—"}</span>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 whitespace-nowrap"
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
