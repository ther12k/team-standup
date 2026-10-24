import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, workspace } from "@/db/schema";
import {
  AuthError,
  ensureAuthReady,
  findUserById,
  requireAdmin,
  requireSessionUser,
  revokeUserSessions,
  toSessionUser,
  assertAdminUser,
  SESSION_COOKIE,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createUserSchema, updateUserSchema } from "@/lib/users-validation";
import { WorkspaceError } from "@/lib/workspace-server";
import type { AuthRole } from "@/lib/types";

function getSessionToken(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

export const userRoutes = new Elysia({ prefix: "/api/users" })
  .get("/", async ({ cookie, set }) => {
    try {
      await ensureAuthReady();
      const token = getSessionToken(cookie[SESSION_COOKIE]?.value);
      await requireAdmin(token);
      const rows = await db.select().from(users);
      return { users: rows.map(toSessionUser) };
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Terjadi kesalahan server." };
    }
  })
  .post("/", async ({ body, cookie, set }) => {
    try {
      await ensureAuthReady();
      const token = getSessionToken(cookie[SESSION_COOKIE]?.value);
      await requireAdmin(token);

      const parsed = createUserSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Isian akun tidak valid." };
      }

      const { username, displayName, password, role, division, memberId } = parsed.data;
      if (memberId) {
        const [row] = await db.select({ state: workspace.state }).from(workspace).limit(1);
        if (!row.state.members.some(member => member.id === memberId)) {
          set.status = 400;
          return { error: "Anggota tim tidak ditemukan di workspace." };
        }
      }

      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (taken) {
        set.status = 409;
        return { error: `Nama pengguna "${username}" sudah dipakai.` };
      }

      let inserted;
      try {
        inserted = await db
          .insert(users)
          .values({
            id: `u-${randomUUID()}`,
            username,
            displayName,
            passwordHash: await hashPassword(password),
            role,
            division,
            memberId,
            active: true,
            passwordChanged: true,
          })
          .returning();
      } catch (err: unknown) {
        if (typeof (err as { code?: string }).code === "string" && (err as { code: string }).code === "23505") {
          set.status = 409;
          return { error: `Nama pengguna "${username}" sudah dipakai.` };
        }
        throw err;
      }

      const row = inserted[0];
      if (!row) {
        set.status = 503;
        return { error: "Gagal membuat akun." };
      }

      set.status = 201;
      return { user: toSessionUser(row) };
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Terjadi kesalahan server." };
    }
  })
  .patch("/:id", async ({ params, body, cookie, set }) => {
    try {
      await ensureAuthReady();
      const token = getSessionToken(cookie[SESSION_COOKIE]?.value);
      const me = await requireSessionUser(token);
      const target = await findUserById(params.id);
      if (!target) {
        set.status = 404;
        return { error: "Akun tidak ditemukan." };
      }

      const isSelf = me.id === target.id;
      if (me.role !== "admin" && !isSelf) {
        set.status = 403;
        return { error: "Aksi ini hanya untuk koordinator." };
      }
      if (!isSelf) assertAdminUser(me);

      const parsed = updateUserSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "Perubahan tidak valid." };
      }
      const patch = parsed.data;

      if (me.role !== "admin") {
        if (patch.role !== undefined || patch.active !== undefined) {
          set.status = 403;
          return { error: "Aksi ini hanya untuk koordinator." };
        }
        if (patch.password !== undefined) {
          const okCurrent = patch.currentPassword ? await verifyPassword(patch.currentPassword, target.passwordHash) : false;
          if (!okCurrent) {
            set.status = 401;
            return { error: "Kata sandi lama tidak cocok." };
          }
        }
      }

      if (patch.memberId !== undefined && patch.memberId !== null) {
        const [row] = await db.select({ state: workspace.state }).from(workspace).limit(1);
        if (!row.state.members.some(member => member.id === patch.memberId)) {
          set.status = 400;
          return { error: "Anggota tim tidak ditemukan di workspace." };
        }
      }

      const nextRole: AuthRole = patch.role ?? (target.role === "admin" ? "admin" : "member");
      const nextActive = patch.active ?? target.active;
      const losesAdmin = target.role === "admin" && target.active && (nextRole !== "admin" || !nextActive);

      const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (patch.displayName !== undefined) values.displayName = patch.displayName;
      if (patch.memberId !== undefined) values.memberId = patch.memberId;
      if (patch.role !== undefined) values.role = patch.role;
      if (patch.division !== undefined) values.division = patch.division;
      if (patch.active !== undefined) values.active = patch.active;
      if (patch.password !== undefined) {
        values.passwordHash = await hashPassword(patch.password);
        values.passwordChanged = true;
      }

      const row = await db.transaction(async tx => {
        if (losesAdmin) {
          const locked = await tx
            .select({ id: users.id, active: users.active })
            .from(users)
            .where(eq(users.role, "admin"))
            .for("update");
          const others = locked.filter(admin => admin.id !== target.id && admin.active);
          if (others.length === 0) throw new WorkspaceError("Tidak bisa menurunkan/menonaktifkan admin aktif terakhir.");
        }
        const updated = await tx.update(users).set(values).where(eq(users.id, target.id)).returning();
        return updated[0] ?? null;
      });
      if (!row) {
        set.status = 404;
        return { error: "Akun tidak ditemukan." };
      }

      if (patch.password !== undefined || nextActive === false) {
        const exceptToken = isSelf ? token : undefined;
        await revokeUserSessions(target.id, exceptToken);
      }

      return { user: toSessionUser(row) };
    } catch (e) {
      if (e instanceof WorkspaceError) {
        set.status = e.status;
        return { error: e.message };
      }
      set.status = 500;
      return { error: "Terjadi kesalahan server." };
    }
  });
