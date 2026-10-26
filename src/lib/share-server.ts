import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, pool } from "@/db";
import { shares } from "@/db/schema";
import { getWorkspace, WorkspaceError } from "@/lib/workspace-server";
import { filterStateForRange, isValidShareId, shareCreateSchema, shareModeFor, shareWindowEnd, shareWindowStart, SHARE_ID_LENGTH } from "@/lib/share";

/**
 * Tautan berbagi laporan tanpa login: pemilik login membuat tautan (ID pendek
 * 8 karakter alfanumerik + kunci 6 karakter alfanumerik); hanya sha256 kunci
 * yang disimpan. Pembuka tautan tanpa akun hanya melihat entri pada rentang
 * yang dibagikan, mengikuti data terkini. Tautan lama ber-ID UUID tetap sah.
 */

const SHARE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** Kunci 6 karakter alfanumerik (62^6 ≈ 57 miliar kombinasi) + ID 8 karakter (62^8 ≈ 218 triliun). */
const KEY_LENGTH = 6;
const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Batasi percobaan tebakan (id, kunci) per klien — cermin pembatas gagal login. */
const READ_FAILURE_LIMIT = 40;
const READ_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const readFailures = new Map<string, { count: number; resetAt: number }>();

export function assertShareReadAllowed(clientId: string): void {
  const record = readFailures.get(clientId);
  if (record && Date.now() < record.resetAt && record.count >= READ_FAILURE_LIMIT) {
    throw new WorkspaceError("Terlalu banyak percobaan akses tautan. Coba lagi beberapa menit lagi.", 429);
  }
}

function recordShareReadFailure(clientId: string): void {
  const record = readFailures.get(clientId);
  if (!record || Date.now() >= record.resetAt) {
    readFailures.set(clientId, { count: 1, resetAt: Date.now() + READ_FAILURE_WINDOW_MS });
    return;
  }
  record.count += 1;
}

function randomToken(length: number): string {
  let token = "";
  for (let i = 0; i < length; i += 1) token += KEY_ALPHABET[randomInt(KEY_ALPHABET.length)];
  return token;
}

function keyMatches(key: string, expectedHash: string): boolean {
  // Digest sha256 selalu 32 byte sehingga perbandingan konstan-waktu aman untuk kunci pendek.
  return key.length >= KEY_LENGTH && timingSafeEqual(Buffer.from(digest(key)), Buffer.from(expectedHash));
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

let tableReady: Promise<void> | null = null;
function ensureSharesTable(): Promise<void> {
  tableReady ??= (async () => {
    await pool.query(`
      create table if not exists standup_shares (
        id text primary key,
        token_hash text not null,
        "start" text not null,
        "end" text not null,
        group_by text not null default 'member',
        created_by text not null,
        created_at timestamptz not null default now()
      )`);
    // Tabel lama memakai tipe uuid; samakan ke text agar ID pendek bisa disimpan
    // sambil tetap menampung baris UUID yang sudah ada.
    const { rows } = await pool.query<{ data_type: string }>(
      `select data_type from information_schema.columns where table_name = 'standup_shares' and column_name = 'id'`,
    );
    if (rows[0]?.data_type === "uuid") {
      await pool.query(`alter table standup_shares alter column id type text using id::text`);
    }
  })();
  return tableReady;
}

export async function createShare(body: unknown, createdBy: string): Promise<{ id: string; key: string; expiresAt: string }> {
  await ensureSharesTable();
  const parsed = shareCreateSchema.safeParse(body);
  if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Data berbagi tidak valid.");
  const key = randomToken(KEY_LENGTH);
  const createdAt = new Date();
  // Bersihkan tautan lebih dari 180 hari secara oportunistik.
  await db.delete(shares).where(lt(shares.createdAt, new Date(createdAt.getTime() - SHARE_TTL_MS)));
  // Tabrakan ID 8 karakter nyaris mustahil; ulangi beberapa kali bila primary key bentrok.
  let inserted: { id: string } | undefined;
  for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
    try {
      [inserted] = await db.insert(shares).values({
        id: randomToken(SHARE_ID_LENGTH),
        tokenHash: digest(key),
        start: parsed.data.start,
        end: parsed.data.end,
        groupBy: parsed.data.groupBy,
        createdBy,
        createdAt,
      }).returning({ id: shares.id });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  if (!inserted) throw new WorkspaceError("Gagal membuat ID tautan unik. Coba lagi.", 500);
  return { id: inserted.id, key, expiresAt: new Date(createdAt.getTime() + SHARE_TTL_MS).toISOString() };
}

export async function readShare(id: string, key: string, clientId = "unknown"): Promise<{
  share: { start: string; end: string; groupBy: "member" | "project"; createdAt: string; mode: "day" | "week"; windowStart: string; windowEnd: string };
  state: ReturnType<typeof filterStateForRange>;
}> {
  await ensureSharesTable();
  assertShareReadAllowed(clientId);
  if (!isValidShareId(id)) {
    recordShareReadFailure(clientId);
    throw new WorkspaceError("Tautan berbagi tidak ditemukan.", 404);
  }
  const [row] = await db.select().from(shares).where(eq(shares.id, id)).limit(1);
  if (!row || !keyMatches(key, row.tokenHash)) {
    recordShareReadFailure(clientId);
    throw new WorkspaceError("Tautan berbagi tidak valid atau kunci salah.", 403);
  }
  if (Date.now() - row.createdAt.getTime() > SHARE_TTL_MS) {
    throw new WorkspaceError("Tautan berbagi sudah kedaluwarsa (maksimal 180 hari).", 410);
  }
  const { state } = await getWorkspace();
  const groupBy = row.groupBy === "project" ? "project" : "member";
  // Kirim entri untuk rentang dibagikan + satu minggu sebelumnya — pembaca
  // hanya bisa berpindah di dalam jendela itu (bar tanggal dibatasi).
  const mode = shareModeFor(row.start, row.end);
  const windowStart = shareWindowStart(row.start);
  const windowEnd = shareWindowEnd(row.start, row.end);
  return {
    share: { start: row.start, end: row.end, groupBy, createdAt: row.createdAt.toISOString(), mode, windowStart, windowEnd },
    state: filterStateForRange(state, windowStart, windowEnd),
  };
}
