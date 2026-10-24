import { AuthError, assertLoginAllowed, authenticate, clearLoginFailures, createSession, ensureAuthReady, recordLoginFailure, setSessionCookie, toSessionUser } from "@/lib/auth";
import { loginSchema } from "@/lib/users-validation";
import { WorkspaceError, workspaceError, workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await ensureAuthReady();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await request.text());
    } catch {
      throw new WorkspaceError("Format permintaan tidak valid.");
    }
    const parsed = loginSchema.safeParse(parsedBody);
    if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Isian tidak valid.");
    const username = parsed.data.username.toLowerCase();
    assertLoginAllowed(username);
    const row = await authenticate(username, parsed.data.password);
    if (!row) {
      recordLoginFailure(username);
      throw new AuthError("Nama pengguna atau kata sandi salah.", 401);
    }
    clearLoginFailures(username);
    const token = await createSession(row.id);
    await setSessionCookie(token, request);
    return workspaceResponse({ user: toSessionUser(row) });
  } catch (error) {
    return workspaceError(error);
  }
}
