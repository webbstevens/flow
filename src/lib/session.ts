import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "flow_ws";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Returns the workspace id associated with the current browser session.
 * Creates a new Workspace row + sets the cookie on first visit.
 *
 * Must be called from a Server Component, Route Handler, or Server Action
 * (anywhere Next.js `cookies()` is writable).
 */
export async function getOrCreateWorkspaceId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;

  if (existing) {
    // Verify the workspace still exists (defensive — someone could tamper)
    const found = await prisma.workspace.findUnique({
      where: { id: existing },
      select: { id: true },
    });
    if (found) return found.id;
  }

  const ws = await prisma.workspace.create({ data: {} });
  cookieStore.set(COOKIE_NAME, ws.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return ws.id;
}

/**
 * Read-only variant: returns the workspace id if a valid cookie exists,
 * otherwise null. Does NOT create a new workspace. Safe to call from
 * any server context.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(COOKIE_NAME)?.value;
  if (!id) return null;
  const found = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true },
  });
  return found?.id ?? null;
}
