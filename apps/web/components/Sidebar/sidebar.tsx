"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/schedules", label: "Schedules" },
  { href: "/import", label: "Import" },
  { href: "/connectors", label: "Connectors" },
  { href: "/settings", label: "Settings" },
  { href: "/audit", label: "Audit" },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-9999 flex h-screen w-72 flex-col overflow-y-hidden bg-black duration-300 ease-linear lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-7.5 py-5.5">
          <Link href="/dashboard" className="text-title-sm font-bold text-white">
            Payment Reminder
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-bodydark2 lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          <nav className="px-4 py-4 lg:px-6">
            <ul className="flex flex-col gap-2">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-sm px-4 py-2 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4",
                        active && "bg-graydark text-white dark:bg-meta-4",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-999 bg-black/80 lg:hidden"
          onClick={onClose}
        />
      ) : null}
    </>
  );
}
