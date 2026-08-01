"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "Chat" },
  { href: "/admin", label: "Admin" },
] as const;

export function Sidebar({ orgId }: { orgId: string | null | undefined }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] p-4">
        <span className="text-lg font-bold">DocuMind</span>
      </div>

      <div className="border-b border-[var(--border)] p-4">
        <OrganizationSwitcher
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--accent)] font-medium"
                  : "text-[var(--muted)] hover:bg-[var(--accent)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <UserButton afterSignOutUrl="/" />
      </div>
    </aside>
  );
}
