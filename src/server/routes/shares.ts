import { Elysia } from "elysia";
import { createShare, readShare } from "@/lib/share-server";
import { requireSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { WorkspaceError } from "@/lib/workspace-server";

export const shareRoutes = new Elysia({ prefix: "/api/shares" })
  .post("/", async ({ body, cookie, set }) => {
    try {
      const raw = cookie[SESSION_COOKIE]?.value;
      const token = typeof raw === "string" ? raw : undefined;
      const user = await requireSessionUser(token);
      set.status = 201;
      return await createShare(body, user.id);
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal membuat tautan berbagi." };
    }
  })
  .get("/:id", async ({ params, query, headers, set }) => {
    try {
      const header = headers.authorization ?? "";
      const key = header.startsWith("Bearer ") ? header.slice(7) : (query?.k ?? "");
      if (!key) {
        set.status = 401;
        return { error: "Kunci akses tidak tersedia pada tautan." };
      }
      return await readShare(params.id, key);
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Gagal membaca tautan berbagi." };
    }
  });
