"use client";

import { useState } from "react";
import { Header } from "@/components/Header/header";
import { Sidebar } from "@/components/Sidebar/sidebar";

export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-whiten dark:bg-boxdark-2">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="relative flex flex-1 flex-col lg:ml-72">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="px-4 pb-18 pt-24 md:px-6 2xl:px-10">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
