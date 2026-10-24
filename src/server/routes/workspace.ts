import { Elysia } from "elysia";
import {
  getWorkspace,
  saveWorkspace,
  resetWorkspace,
  WorkspaceError,
} from "@/lib/workspace-server";
import {
  requireWorkspaceAccess,
  assertAdminUser,
  SESSION_COOKIE,
} from "@/lib/auth";

function getSessionToken(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

export const workspaceRoutes = new Elysia({ prefix: "/api/workspace" })
  .get("/", async ({ cookie, headers, set }) => {
    try {
      const token = getSessionToken(cookie[SESSION_COOKIE]?.value);
      await requireWorkspaceAccess(token, headers.authorization);
      return await getWorkspace();
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Terjadi kesalahan server." };
    }
  })
  .put("/", async ({ body, cookie, headers, set }) => {
    try {
      const token = getSessionToken(cookie[SESSION_COOKIE]?.value);
      await requireWorkspaceAccess(token, headers.authorization);

      const parsed = body as { state: unknown; baseRevision: number };
      if (!parsed || typeof parsed !== "object" || typeof parsed.baseRevision !== "number") {
        set.status = 400;
        return { error: "Format permintaan tidak valid." };
      }

      return await saveWorkspace(parsed);
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal menyimpan workspace." };
    }
  })
  .post("/reset", async ({ cookie, headers, set }) => {
    try {
      const token = getSessionToken(cookie[SESSION_COOKIE]?.value);
      const user = await requireWorkspaceAccess(token, headers.authorization);
      if (!user) {
        set.status = 403;
        return { error: "Memuat ulang riwayat hanya untuk koordinator yang masuk." };
      }
      assertAdminUser(user);
      return await resetWorkspace();
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal memuat ulang riwayat." };
    }
  });
