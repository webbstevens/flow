"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/classify", label: "Classify" },
  { href: "/trade", label: "Trade" },
  { href: "/analytics", label: "Analytics" },
  { href: "/docs", label: "Docs" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md">
      <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">hub</span>
          <span className="text-2xl font-serif font-bold tracking-tight text-primary">
            Flow
          </span>
        </Link>

        <nav className="hidden md:flex gap-8 items-center">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "text-accent"
                    : "text-primary/60 hover:text-accent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/account"
            className="bg-primary text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
