import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { createClient } from "./supabase/server";

const COOKIE_NAME = "flow_ws";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Returns the current user's workspace.
 *
 * Resolution order:
 *   1. If a Supabase session exists, find/create a workspace owned by that user.
 *   2. Otherwise, read (or create) an anonymous cookie-scoped workspace.
 *
 * Must be called from a Server Action or Route Handler (writes cookies on first anon visit).
 */
export async function getOrCreateWorkspaceId(): Promise<string> {
  // Prefer signed-in user
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const existing = await prisma.workspace.findFirst({
      where: { ownerUserId: data.user.id },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.workspace.create({
      data: { ownerUserId: data.user.id },
      select: { id: true },
    });
    return created.id;
  }

  // Anonymous fallback — cookie-scoped workspace
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (existingCookie) {
    const found = await prisma.workspace.findUnique({
      where: { id: existingCookie },
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
 * Read-only: returns the current workspace id if resolvable, else null.
 * Does NOT create anything. Safe to call from Server Components.
 */
export async function getWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const existing = await prisma.workspace.findFirst({
      where: { ownerUserId: data.user.id },
      select: { id: true },
    });
    return existing?.id ?? null;
  }

  const cookieStore = await cookies();
  const id = cookieStore.get(COOKIE_NAME)?.value;
  if (!id) return null;
  const found = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true },
  });
  return found?.id ?? null;
}

/**
 * Returns the current signed-in Supabase user, or null.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
