import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {/* pt-20 clears top nav, pb-24 clears bottom nav on mobile */}
      <div className="min-h-screen pt-20 pb-24 md:pb-12">{children}</div>
      <BottomNav />
    </>
  );
}
