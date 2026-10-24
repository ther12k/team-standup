import { getSessionUser } from "@/lib/auth";
import { workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return workspaceResponse({ error: "Belum masuk." }, 401);
  return workspaceResponse({ user });
}
