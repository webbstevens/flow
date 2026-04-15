import { redirect } from "next/navigation";
import { getOrCreateWorkspaceId } from "@/lib/session";

// Cookie-creation helper — redirects back to /account once the workspace cookie is set.
// Route handlers can write cookies; Server Components cannot.
export async function GET() {
  await getOrCreateWorkspaceId();
  redirect("/account");
}
