import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db, pool } from "@/db";
import { authSessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { WorkspaceError } from "@/lib/workspace-server";
import type { AuthRole, SessionUser } from "@/lib/types";

/**
 * Autentikasi internal: akun di tabel standup_users (koordinator = admin),
 * sesi cookie httpOnly yang hash-nya disimpan di standup_sessions.
 * Tabel dibuat bila belum ada (deploy baru cukup restart, tanpa migrasi manual),
 * dan admin pertama di-bootstrap dari env atau bawaan "admin".
 */

export const SESSION_COOKIE = "standup_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export class AuthError extends WorkspaceError {}

type UserRow = typeof users.$inferSelect;

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: (row.role === "admin" ? "admin" : "member") satisfies AuthRole,
    division: row.division,
    memberId: row.memberId ?? null,
    passwordChanged: row.passwordChanged,
    active: row.active,
  };
}

let readyPromise: Promise<void> | null = null;

/** Ciptakan tabel bila belum ada + bootstrap admin pertama sekali per proses. */
export function ensureAuthReady(): Promise<void> {
  readyPromise ??= (async () => {
    await pool.query(`
      create table if not exists standup_users (
        id text primary key,
        username text not null unique,
        display_name text not null,
        password_hash text not null,
        role text not null default 'member',
        division text not null default 'M2MPD',
        member_id text,
        active boolean not null default true,
        password_changed boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`);
    // Deploy lama: tambahkan kolom divisi tanpa migrasi manual (default M2MPD
    // untuk akun yang sudah ada).
    await pool.query(`alter table standup_users add column if not exists division text not null default 'M2MPD'`);
    await pool.query(`
      create table if not exists standup_sessions (
        token_hash text primary key,
        user_id text not null references standup_users(id) on delete cascade,
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
      )`);
    await pool.query(`create index if not exists standup_sessions_user_idx on standup_sessions(user_id)`);
    const [existing] = await db.select({ id: users.id }).from(users).limit(1);
    if (existing) return;
    // String kosong pada env dianggap tidak diisi agar admin bawaan tidak terkunci total.
    const envPassword = process.env.STANDUP_ADMIN_PASSWORD || undefined;
    await db.insert(users).values({
      id: `u-${randomUUID()}`,
      username: (process.env.STANDUP_ADMIN_USERNAME ?? "admin").toLowerCase(),
      displayName: "Koordinator",
      passwordHash: await hashPassword(envPassword ?? "standup123"),
      role: "admin",
      division: "M2MPD",
      memberId: null,
      active: true,
      // Akun bawaan dengan sandi default wajib mengganti sandi (banner di /pengguna).
      passwordChanged: Boolean(envPassword),
    }).onConflictDoNothing();
  })().catch(error => {
    readyPromise = null;
    throw error;
  });
  return readyPromise;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Sesi baru: token acak dikirim ke klien, hanya hash-nya disimpan. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  // Bersihkan sesi kedaluwarsa milik siapa pun secara oportunistik.
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  await db.insert(authSessions).values({ tokenHash: sha256(token), userId, expiresAt });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
}

/** Pengguna sesi cookie saat ini, atau null. Sesi kedaluwarsa/akun nonaktif = null. */
export async function getSessionUser(token?: string): Promise<SessionUser | null> {
  await ensureAuthReady();
  if (!token) return null;
  const [row] = await db
    .select({ session: authSessions, user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(eq(authSessions.tokenHash, sha256(token)))
    .limit(1);
  if (!row) return null;
  if (row.session.expiresAt.getTime() <= Date.now()) {
    await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
    return null;
  }
  if (!row.user.active) return null;
  return toSessionUser(row.user);
}

export async function requireSessionUser(token?: string): Promise<SessionUser> {
  const user = await getSessionUser(token);
  if (!user) throw new AuthError("Sesi berakhir. Silakan masuk kembali.", 401);
  return user;
}

/** Pemeriksaan admin yang sama untuk rute berbasis sesi maupun akses token skrip. */
export function assertAdminUser(user: SessionUser): void {
  if (user.role !== "admin") throw new AuthError("Aksi ini hanya untuk koordinator.", 403);
  // Admin bawaan dengan sandi default harus mengganti sandinya dulu (ubah sandi
  // sendiri di /pengguna tetap bisa karena jalur itu tidak lewat pemeriksaan ini).
  if (!user.passwordChanged) {
    throw new AuthError("Kata sandi bawaan belum diganti. Ubah kata sandi di menu Pengguna dulu.", 403);
  }
}

export async function requireAdmin(token?: string): Promise<SessionUser> {
  const user = await requireSessionUser(token);
  assertAdminUser(user);
  return user;
}

/**
 * Akses data workspace: sesi login yang sah, atau (untuk skrip/lama) Bearer
 * WORKSPACE_ACCESS_TOKEN bila env itu diatur. Mengembalikan null berautentikasi
 * via token skrip (tanpa identitas pengguna).
 */
export async function requireWorkspaceAccess(token?: string, authHeader?: string): Promise<SessionUser | null> {
  const user = await getSessionUser(token);
  if (user) return user;
  const expected = process.env.WORKSPACE_ACCESS_TOKEN;
  if (expected) {
    const header = authHeader ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    // Bandingkan digest supaya konstan-waktu seperti verifikasi kunci ruang Live.
    if (provided && timingSafeEqual(Buffer.from(sha256(provided)), Buffer.from(sha256(expected)))) return null;
  }
  throw new AuthError("Sesi berakhir. Silakan masuk kembali.", 401);
}

/**
 * Batas percobaan login per nama pengguna (di memori, cukup untuk aplikasi
 * internal): 8 kegagalan dalam jendela 5 menit -> terkunci 5 menit.
 */
const MAX_ATTEMPTS = 8;
const LOCK_MS = 5 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number; lastAttemptAt: number }>();

function evictStaleAttempts(): void {
  const now = Date.now();
  for (const [key, record] of attempts) {
    // Hitungan yang sudah lama tidak aktif direset (jendela geser), bukan menumpuk selamanya.
    if (record.lastAttemptAt < now - LOCK_MS && record.lockedUntil < now) attempts.delete(key);
  }
}

export function assertLoginAllowed(username: string): void {
  const record = attempts.get(username);
  if (!record || record.lockedUntil < Date.now()) return;
  const minutes = Math.max(1, Math.ceil((record.lockedUntil - Date.now()) / 60000));
  throw new AuthError(`Terlalu banyak percobaan gagal. Coba lagi dalam ${minutes} menit.`, 429);
}

export function recordLoginFailure(username: string): void {
  if (attempts.size > 500) evictStaleAttempts();
  const now = Date.now();
  const record = attempts.get(username);
  if (!record || record.lastAttemptAt < now - LOCK_MS) {
    attempts.set(username, { count: 1, lockedUntil: 0, lastAttemptAt: now });
    return;
  }
  record.count += 1;
  record.lastAttemptAt = now;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCK_MS;
    record.count = 0;
  }
  attempts.set(username, record);
}

export function clearLoginFailures(username: string): void {
  attempts.delete(username);
}

/** Autentikasi nama pengguna + kata sandi; null bila salah/nonaktif (pesan seragam). */
export async function authenticate(username: string, password: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  // Verifikasi tetap dijalankan untuk pengguna tak dikenal agar waktu respons seragam.
  const hash = row?.passwordHash ?? "scrypt$16384$8$1$00$00";
  const ok = await verifyPassword(password, hash);
  if (!row || !row.active || !ok) return null;
  return row;
}

/** Cari akun berdasarkan id; dipakai API pembaruan akun. */
export async function findUserById(id: string): Promise<UserRow | null> {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(id)) return null;
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** Jumlah admin aktif — melindungi admin terakhir dari demosi/nonaktifkan diri. */
export async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)));
  return rows.filter(row => row.id !== excludeUserId).length;
}

/**
 * Cabut sesi akun: dipanggil saat sandi diganti/di-reset atau akun dinonaktifkan
 * agar kuki lama (mis. milik penyerang) langsung mati. Sesi pemanggil boleh dipertahankan.
 */
export async function revokeUserSessions(userId: string, exceptToken?: string): Promise<void> {
  const exceptHash = exceptToken ? sha256(exceptToken) : null;
  const rows = await db.select({ tokenHash: authSessions.tokenHash }).from(authSessions).where(eq(authSessions.userId, userId));
  const stale = rows.filter(row => row.tokenHash !== exceptHash).map(row => row.tokenHash);
  if (stale.length === 0) return;
  await db.delete(authSessions).where(inArray(authSessions.tokenHash, stale));
}
