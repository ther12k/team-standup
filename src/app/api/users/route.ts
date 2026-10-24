import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, workspace } from "@/db/schema";
import { AuthError, ensureAuthReady, requireAdmin, toSessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { createUserSchema } from "@/lib/users-validation";
import { WorkspaceError, workspaceError, workspaceResponse } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

/** Daftar akun (koordinator saja). */
export async function GET() {
  try {
    await ensureAuthReady();
    await requireAdmin();
    const rows = await db.select().from(users);
    return workspaceResponse({ users: rows.map(toSessionUser) });
  } catch (error) {
    return workspaceError(error);
  }
}

/** Buat akun baru (koordinator saja). */
export async function POST(request: Request) {
  try {
    await ensureAuthReady();
    await requireAdmin();
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(await request.text());
    } catch {
      throw new WorkspaceError("Format permintaan tidak valid.");
    }
    const parsed = createUserSchema.safeParse(parsedBody);
    if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Isian akun tidak valid.");
    const { username, displayName, password, role, division, memberId } = parsed.data;
    if (memberId) {
      const [row] = await db.select({ state: workspace.state }).from(workspace).limit(1);
      if (!row.state.members.some(member => member.id === memberId)) {
        throw new WorkspaceError("Anggota tim tidak ditemukan di workspace.");
      }
    }
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (taken) throw new WorkspaceError(`Nama pengguna "${username}" sudah dipakai.`, 409);
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
    } catch (error) {
      // Insert bersamaan bisa menabrak constraint unik username walau sudah dicek.
      if (typeof (error as { code?: string }).code === "string" && (error as { code: string }).code === "23505") {
        throw new WorkspaceError(`Nama pengguna "${username}" sudah dipakai.`, 409);
      }
      throw error;
    }
    const row = inserted[0];
    if (!row) throw new AuthError("Gagal membuat akun. Coba lagi.", 503);
    return workspaceResponse({ user: toSessionUser(row) }, 201);
  } catch (error) {
    return workspaceError(error);
  }
}
