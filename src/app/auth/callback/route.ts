import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * OAuth callback. Supabase redirects here with a `?code=...` param after
 * successful sign-in. We exchange the code for a session, then:
 *   1. If the browser has a flow_ws cookie pointing to an unclaimed workspace,
 *      bind that workspace to the Supabase user (auto-claim existing keys).
 *   2. Otherwise, ensure the user has exactly one owned workspace.
 *   3. Clear the flow_ws cookie — Supabase session is canonical from here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "unknown")}`
    );
  }

  const userId = data.user.id;
  const cookieStore = await cookies();
  const oldWsId = cookieStore.get("flow_ws")?.value;

  // Auto-claim: existing unclaimed cookie workspace → bind to this user
  if (oldWsId) {
    const existing = await prisma.workspace.findUnique({
      where: { id: oldWsId },
    });
    if (existing && !existing.ownerUserId) {
      await prisma.workspace.update({
        where: { id: oldWsId },
        data: { ownerUserId: userId },
      });
    }
  }

  // Ensure the user owns at least one workspace
  const owned = await prisma.workspace.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  if (!owned) {
    await prisma.workspace.create({
      data: { ownerUserId: userId },
    });
  }

  // Clear the anonymous cookie — Supabase session takes over
  cookieStore.delete("flow_ws");

  return NextResponse.redirect(`${origin}${next}`);
}
