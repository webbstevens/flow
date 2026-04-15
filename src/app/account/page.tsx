import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getWorkspaceId } from "@/lib/session";
import { KeyManager } from "./KeyManager";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    // Edge case: signed in but no workspace yet (shouldn't normally happen
    // because /auth/callback creates one). Bounce through init to create it.
    redirect("/account/init");
  }

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      prefix: true,
      name: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Workspace";
  const initial = displayName.charAt(0).toUpperCase();
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <main className="max-w-2xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Workspace
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Workspace
        </h1>
      </header>

      {/* Profile card */}
      <section className="bg-surface-lowest rounded-3xl p-8 mb-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
              <span className="font-serif italic text-2xl">{initial}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-sans text-lg font-medium text-primary truncate">
              {displayName}
            </p>
            <p className="text-xs text-primary/50 mt-0.5 truncate">
              {user.email}
            </p>
          </div>
        </div>
      </section>

      {/* Key management (client island) */}
      <KeyManager initialKeys={keys} />

      {/* Usage card */}
      <section className="bg-surface-lowest rounded-3xl p-8 mt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-primary/50">
            Classifications this month
          </p>
          <p className="font-serif italic text-xl text-primary">
            0 <span className="text-primary/40">/ 5,000</span>
          </p>
        </div>
        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: "0%" }} />
        </div>
      </section>
    </main>
  );
}
