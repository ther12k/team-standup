import { Elysia } from "elysia";
import { pool } from "@/db";

export const healthRoutes = new Elysia({ prefix: "/api/health" })
  .get("/", async ({ set }) => {
    try {
      await pool.query("select 1");
      return { ok: true };
    } catch {
      set.status = 503;
      return { ok: false, error: "Database unreachable" };
    }
  });
