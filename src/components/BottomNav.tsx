"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/trade", label: "Trade", icon: "language" },
  { href: "/analytics", label: "Analytics", icon: "insights" },
  { href: "/classify", label: "Classify", icon: "photo_camera" },
  { href: "/account", label: "Account", icon: "person" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-around items-center px-4 py-3 pb-safe bg-white/95 backdrop-blur-md md:hidden">
      {tabs.map((tab) => {
        const active =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition ${
              active
                ? "bg-secondary text-on-secondary"
                : "text-primary/50"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {tab.icon}
            </span>
            <span className="font-sans text-[10px] font-bold uppercase tracking-widest mt-0.5">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
