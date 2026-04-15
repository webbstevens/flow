import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/session";
import { KeyManager } from "./KeyManager";

export default async function AccountPage() {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    // First visit — bounce through the init route handler which can set cookies.
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

  // Count usage roughly by counting products created by the workspace's seller
  // (For now, we don't have a workspace->seller link, so show total classifications
  // via a placeholder until that's wired up.)
  const classificationsThisMonth = 0;

  return (
    <main className="max-w-2xl mx-auto px-6 pt-4 pb-10">
      <header className="mb-10">
        <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-accent">
          Flow · Workspace
        </p>
        <h1 className="font-serif italic text-[2.25rem] leading-[1.1] mt-3 text-primary">
          Workspace
        </h1>
        <p className="text-xs text-primary/50 mt-3 font-mono truncate">
          {workspaceId}
        </p>
      </header>

      {/* Profile card */}
      <section className="bg-surface-lowest rounded-3xl p-8 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
            <span className="font-serif italic text-2xl">W</span>
          </div>
          <div>
            <p className="font-sans text-lg font-medium text-primary">
              My Workspace
            </p>
            <p className="text-xs text-primary/50 mt-0.5">
              Workspace · cookie-scoped session
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
            {classificationsThisMonth}{" "}
            <span className="text-primary/40">/ 5,000</span>
          </p>
        </div>
        <div className="h-2 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{
              width: `${Math.min(100, (classificationsThisMonth / 5000) * 100)}%`,
            }}
          />
        </div>
      </section>
    </main>
  );
}
