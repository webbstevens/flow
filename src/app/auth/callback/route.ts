import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Build the public-facing origin for redirects, respecting Railway/proxy headers.
 * `new URL(request.url).origin` resolves to the internal container URL
 * (localhost:PORT) behind a proxy, which breaks redirects.
 */
function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  const host = request.headers.get("host");
  if (host) {
    return `${request.nextUrl.protocol}//${host}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");
  const next = searchParams.get("next") ?? "/account";

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
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

    // Auto-claim existing anonymous workspace
    if (oldWsId) {
      const existing = await prisma.workspace.findUnique({ where: { id: oldWsId } });
      if (existing && !existing.ownerUserId) {
        await prisma.workspace.update({
          where: { id: oldWsId },
          data: { ownerUserId: userId },
        });
      }
    }

    // Ensure the user has a workspace
    const owned = await prisma.workspace.findFirst({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (!owned) {
      await prisma.workspace.create({ data: { ownerUserId: userId } });
    }

    cookieStore.delete("flow_ws");
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err: unknown) {
    console.error("Auth callback error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }
}
