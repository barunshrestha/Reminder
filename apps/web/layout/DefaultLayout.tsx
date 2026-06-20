"use client";

import { useState } from "react";
import { Header } from "@/components/Header/header";
import { Sidebar } from "@/components/Sidebar/sidebar";
import { cn } from "@/lib/utils";

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-whiten dark:bg-boxdark-2">
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
      />
      <div
        className={cn(
          "relative flex min-h-screen flex-1 flex-col transition-all duration-300 ease-linear",
          sidebarCollapsed ? "lg:ml-0" : "lg:ml-72",
        )}
      >
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={() => setSidebarOpen(true)}
          onSidebarToggle={() => setSidebarCollapsed((value) => !value)}
        />
        <main className="px-4 pb-18 pt-24 md:px-6 2xl:px-10">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
