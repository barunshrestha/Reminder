"use client";

import { useEffect, useState } from "react";
import { logout, me } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
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
    <header className="fixed left-0 right-0 top-0 z-999 flex w-full border-b border-stroke bg-white shadow-1 dark:border-strokedark dark:bg-boxdark lg:left-72">
      <div className="flex w-full items-center justify-between px-4 py-4 md:px-6 2xl:px-10">
        <div className="flex items-center gap-2 sm:gap-4 lg:hidden">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-sm border border-stroke p-1.5 shadow-sm dark:border-strokedark"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={toggleTheme}>
            {isDark ? "Light" : "Dark"}
          </Button>
          <div className="hidden text-right sm:block">
            <span className="block text-sm font-medium text-black dark:text-white">
              {userEmail || "User"}
            </span>
            <span className="block text-xs text-bodydark2">{userRole || "—"}</span>
          </div>
          <Button
            type="button"
            size="sm"
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
