"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "github";

function ErrorFromUrl({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const paramError = searchParams.get("error");
    if (paramError) onError(decodeURIComponent(paramError));
  }, [searchParams, onError]);
  return null;
}

export default function LoginPage() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setLoading(provider);
    setError(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
    // On success, browser redirects to the provider; nothing else to do here.
  }

  return (
    <main className="max-w-md mx-auto px-6 pt-8 md:pt-16 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Sign in
        </p>
        <h1 className="font-serif italic text-[2.5rem] leading-[1.1] mt-3 text-primary">
          Welcome back.
        </h1>
        <p className="text-sm text-on-surface-variant mt-4">
          Sign in to manage your API keys, workspaces, and classifications.
        </p>
      </header>

      <Suspense>
        <ErrorFromUrl onError={setError} />
      </Suspense>

      <section className="bg-surface-lowest rounded-3xl p-8 space-y-3">
        <button
          onClick={() => signIn("google")}
          disabled={loading !== null}
          className="w-full bg-primary text-white rounded-full py-4 text-sm font-medium flex items-center justify-center gap-3 disabled:opacity-50 hover:opacity-90 transition"
        >
          <GoogleIcon />
          {loading === "google" ? "Redirecting…" : "Continue with Google"}
        </button>

        {/* GitHub sign-in — re-enable after the GitHub OAuth app is configured in Supabase
        <button
          onClick={() => signIn("github")}
          disabled={loading !== null}
          className="w-full bg-surface-container text-primary rounded-full py-4 text-sm font-medium flex items-center justify-center gap-3 disabled:opacity-50 hover:bg-surface-container-high transition"
        >
          <GitHubIcon />
          {loading === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
        */}

        {error && (
          <p className="text-xs text-red-600 font-sans mt-3">{error}</p>
        )}
      </section>

      <p className="text-xs text-primary/50 text-center mt-6">
        By signing in, you agree to the Flow terms.
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#fff"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#fff"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#fff"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#fff"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.75.08-.73.08-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.94 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.47 11.47 0 0 1 6 0c2.29-1.55 3.29-1.23 3.29-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.63-5.48 5.93.43.37.82 1.1.82 2.22 0 1.61-.02 2.9-.02 3.29 0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
