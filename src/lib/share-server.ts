import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db, pool } from "@/db";
import { shares } from "@/db/schema";
import { getWorkspace, WorkspaceError } from "@/lib/workspace-server";
import { filterStateForRange, shareCreateSchema } from "@/lib/share";

/**
 * Tautan berbagi laporan tanpa login: pemilik login membuat tautan (id UUID +
 * kunci pendek 6 karakter alfanumerik); hanya sha256 kunci yang disimpan.
 * Pembuka tautan tanpa akun hanya melihat entri pada rentang yang dibagikan,
 * mengikuti data terkini.
 */

const SHARE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** Kunci 6 karakter alfanumerik (62^6 ≈ 57 miliar kombinasi); ID UUID di URL menambah ruang tebakan. */
const KEY_LENGTH = 6;
const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function generateShareKey(): string {
  let key = "";
  for (let i = 0; i < KEY_LENGTH; i += 1) key += KEY_ALPHABET[randomInt(KEY_ALPHABET.length)];
  return key;
}

function keyMatches(key: string, expectedHash: string): boolean {
  // Digest sha256 selalu 32 byte sehingga perbandingan konstan-waktu aman untuk kunci pendek.
  return key.length >= KEY_LENGTH && timingSafeEqual(Buffer.from(digest(key)), Buffer.from(expectedHash));
}

let tableReady: Promise<void> | null = null;
function ensureSharesTable(): Promise<void> {
  tableReady ??= pool.query(`
    create table if not exists standup_shares (
      id uuid primary key,
      token_hash text not null,
      "start" text not null,
      "end" text not null,
      group_by text not null default 'member',
      created_by text not null,
      created_at timestamptz not null default now()
    )`).then(() => undefined);
  return tableReady;
}

export async function createShare(body: unknown, createdBy: string): Promise<{ id: string; key: string; expiresAt: string }> {
  await ensureSharesTable();
  const parsed = shareCreateSchema.safeParse(body);
  if (!parsed.success) throw new WorkspaceError(parsed.error.issues[0]?.message ?? "Data berbagi tidak valid.");
  const key = generateShareKey();
  const id = randomUUID();
  const createdAt = new Date();
  // Bersihkan tautan lebih dari 180 hari secara oportunistik.
  await db.delete(shares).where(lt(shares.createdAt, new Date(createdAt.getTime() - SHARE_TTL_MS)));
  await db.insert(shares).values({
    id,
    tokenHash: digest(key),
    start: parsed.data.start,
    end: parsed.data.end,
    groupBy: parsed.data.groupBy,
    createdBy,
    createdAt,
  });
  return { id, key, expiresAt: new Date(createdAt.getTime() + SHARE_TTL_MS).toISOString() };
}

export async function readShare(id: string, key: string): Promise<{
  share: { start: string; end: string; groupBy: "member" | "project"; createdAt: string };
  state: ReturnType<typeof filterStateForRange>;
}> {
  await ensureSharesTable();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new WorkspaceError("Tautan berbagi tidak ditemukan.", 404);
  }
  const [row] = await db.select().from(shares).where(eq(shares.id, id)).limit(1);
  if (!row || !keyMatches(key, row.tokenHash)) {
    throw new WorkspaceError("Tautan berbagi tidak valid atau kunci salah.", 403);
  }
  if (Date.now() - row.createdAt.getTime() > SHARE_TTL_MS) {
    throw new WorkspaceError("Tautan berbagi sudah kedaluwarsa (maksimal 180 hari).", 410);
  }
  const { state } = await getWorkspace();
  const groupBy = row.groupBy === "project" ? "project" : "member";
  return {
    share: { start: row.start, end: row.end, groupBy, createdAt: row.createdAt.toISOString() },
    state: filterStateForRange(state, row.start, row.end),
  };
}
