import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase server client. Reads/writes auth cookies via Next.js cookie API.
 * Use from Server Components, Server Actions, and Route Handlers.
 *
 * Note: Server Components can only READ cookies. If you call this from a
 * Server Component and Supabase tries to refresh a session (cookie write),
 * it will throw. That's expected — put cookie-writing calls in Route Handlers
 * or Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll called from a Server Component — safe to ignore.
            // Session refresh is handled by the middleware / auth callback.
          }
        },
      },
    }
  );
}
