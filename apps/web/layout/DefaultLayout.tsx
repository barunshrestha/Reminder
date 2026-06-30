"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header/header";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Sidebar } from "@/components/Sidebar/sidebar";
import { cn } from "@/lib/utils";

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    setSidebarVisible(window.matchMedia("(min-width: 1024px)").matches);
  }, []);

  function toggleSidebar() {
    setSidebarVisible((visible) => !visible);
  }

  return (
    <div className="min-h-screen bg-whiten dark:bg-boxdark-2 pb-[env(safe-area-inset-bottom)]">
      <Sidebar visible={sidebarVisible} onToggle={toggleSidebar} />
      <div
        className={cn(
          "relative flex min-h-screen flex-1 flex-col transition-[margin] duration-300 ease-linear",
          sidebarVisible ? "lg:ml-72" : "lg:ml-0",
        )}
      >
        <Header sidebarVisible={sidebarVisible} onToggleSidebar={toggleSidebar} />
        <main className="px-4 pb-20 pt-24 md:px-6 2xl:px-10">
          <div className="mx-auto w-full max-w-screen-2xl">
            <InstallPrompt />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
