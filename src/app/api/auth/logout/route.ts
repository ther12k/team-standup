import { SESSION_COOKIE, clearSessionCookie, destroySession } from "@/lib/auth";
import { cookies } from "next/headers";
import { workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value ?? "";
  if (token) {
    try {
      await destroySession(token);
    } catch {
      /* sesi sudah tidak ada pun tidak masalah */
    }
  }
  await clearSessionCookie();
  return workspaceResponse({ ok: true });
}
