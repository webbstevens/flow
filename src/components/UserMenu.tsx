"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (!loaded) {
    return <div className="w-24 h-9" aria-hidden />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="bg-primary text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
      >
        Sign in
      </Link>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Account";
  const initial = name.charAt(0).toUpperCase();
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full pr-3 pl-1 py-1 hover:bg-surface-container transition"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-serif italic text-sm">
            {initial}
          </span>
        )}
        <span className="text-xs font-medium text-primary max-w-[140px] truncate">
          {name}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-lowest rounded-2xl shadow-lg overflow-hidden z-50">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="block px-5 py-3 text-sm text-primary hover:bg-surface-container transition"
          >
            Workspace
          </Link>
          <button
            onClick={signOut}
            className="block w-full text-left px-5 py-3 text-sm text-primary/70 hover:bg-surface-container transition"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
