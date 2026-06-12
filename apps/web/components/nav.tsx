"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/invoices", label: "Invoices" },
  { href: "/schedules", label: "Schedules" },
  { href: "/import", label: "Import" },
  { href: "/connectors", label: "Connectors" },
  { href: "/settings", label: "Settings" },
  { href: "/audit", label: "Audit" },
];

export function Nav({ user }: { user?: { email: string; role: string } }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-4 border-b bg-card px-6 py-4">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "text-sm font-medium text-foreground hover:text-primary",
            pathname === l.href && "font-bold text-primary",
          )}
        >
          {l.label}
        </Link>
      ))}
      <span className="ml-auto text-sm text-muted-foreground">
        {user?.email} ({user?.role})
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          void logout().then(() => {
            window.location.href = "/login";
          });
        }}
      >
        Log out
      </Button>
    </nav>
  );
}
