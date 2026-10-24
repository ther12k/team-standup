import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, workspace } from "@/db/schema";
import {
  AuthError,
  SESSION_COOKIE,
  assertAdminUser,
  ensureAuthReady,
  findUserById,
  requireSessionUser,
  revokeUserSessions,
  toSessionUser,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { updateUserSchema } from "@/lib/users-validation";
import type { AuthRole } from "@/lib/types";
import { WorkspaceError, workspaceError, workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

/**
 * Perbarui akun: koordinator dapat mengubah akun siapa pun (termasuk reset sandi,
 * peran, status aktif); pengguna biasa hanya akunnya sendiri dan wajib memasukkan
 * sandi lama untuk mengganti sandi. Sandi berganti atau akun nonaktif => sesi
 * lamanya dicabut. Admin aktif terakhir tidak boleh dinonaktifkan/diturunkan.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureAuthReady();
    const me = await requireSessionUser();
    const { id } = await context.params;
    const target = await findUserById(id);
    if (!target) throw new AuthError("Akun tidak ditemukan.", 404);
    const isSelf = me.id === target.id;
    if (me.role !== "admin" && !isSelf) throw new AuthError("Aksi ini hanya untuk koordinator.", 403);
    // Admin mengubah akun orang lain = aksi koordinator → wajib sandi sudah diganti,
    // konsisten dengan GET/POST /api/users dan reset workspace.
    if (!isSelf) assertAdminUser(me);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await request.text());
    } catch {
      throw new WorkspaceError("Format permintaan tidak valid.");
    }
    const parsed = updateUserSchema.safeParse(parsedBody);
    if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Perubahan tidak valid.");
    const patch = parsed.data;

    // Pengguna biasa tidak boleh mengubah peran/status aktif; sandi butuh sandi lama.
    if (me.role !== "admin") {
      if (patch.role !== undefined || patch.active !== undefined) {
        throw new AuthError("Aksi ini hanya untuk koordinator.", 403);
      }
      if (patch.password !== undefined) {
        const okCurrent = patch.currentPassword ? await verifyPassword(patch.currentPassword, target.passwordHash) : false;
        if (!okCurrent) throw new WorkspaceError("Kata sandi lama tidak cocok.", 401);
      }
    }

    if (patch.memberId !== undefined && patch.memberId !== null) {
      const [row] = await db.select({ state: workspace.state }).from(workspace).limit(1);
      if (!row.state.members.some(member => member.id === patch.memberId)) {
        throw new WorkspaceError("Anggota tim tidak ditemukan di workspace.");
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

    // Transaksi dengan kunci baris admin aktif: dua permintaan demosi bersamaan
    // tidak bisa sama-sama melihat "masih ada 1 admin tersisa".
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
    if (!row) throw new AuthError("Akun tidak ditemukan.", 404);

    // Sandi berganti/di-reset atau akun nonaktif: kuki lama segera dicabut.
    // Sesi pemanggil dipertahankan bila ia mengubah akunnya sendiri.
    if (patch.password !== undefined || nextActive === false) {
      let exceptToken: string | undefined;
      if (isSelf) {
        const jar = await cookies();
        exceptToken = jar.get(SESSION_COOKIE)?.value ?? undefined;
      }
      await revokeUserSessions(target.id, exceptToken);
    }

    return workspaceResponse({ user: toSessionUser(row) });
  } catch (error) {
    return workspaceError(error);
  }
}
